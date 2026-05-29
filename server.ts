
import dotenv from 'dotenv';
dotenv.config();

// Validate environment variables before starting the server
import { validateEnv } from './src/lib/env-validation';
validateEnv();

import { createServer } from 'http';
import { Server } from 'socket.io';
import { ObjectId } from 'mongodb';
import clientPromise from './src/lib/mongodb';
import redisCache from './src/lib/redis-cache';
import { presenceManager } from './src/lib/presence';
import { getCorsOrigins } from './src/lib/url-utils';
import jwt from 'jsonwebtoken';
import { createMessageNotification } from './src/lib/notification-utils';
import { createChatId } from './src/lib/chat-utils';
import { logger } from './src/lib/logger';

// Create a child logger for socket server
const socketLogger = logger.child({ service: 'socket-server' });

// Extend Socket type to include userId and active chat
declare module 'socket.io' {
  interface Socket {
    userId: string | null;
    activeChatId: string | null;
  }
}

// Initialize Redis connection (non-blocking)
redisCache.connect().catch(() => {
  socketLogger.warn('Redis not available - caching disabled');
});

// Store active chats for each user (userId -> Set of chatIds they're viewing)
const activeChats = new Map<string, Set<string>>();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: getCorsOrigins(),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  allowEIO3: true
});

/**
 * Emit exchange status update to all participants
 * This function is used by server actions to notify clients of exchange status changes
 */
export async function emitExchangeStatusUpdate(exchangeId: string, exchangeData: {
  status?: string;
  updatedAt?: string;
  proposerId?: string;
  responderId?: string;
  [key: string]: unknown;
}) {
  try {
    const client = await clientPromise;
    const db = client.db("bookex");
    
    // Get exchange details to find participants
    const exchange = await db.collection("exchanges").findOne({ _id: new ObjectId(exchangeId) });
    if (!exchange) return;
    
    // Emit to exchange room
    io.to(`exchange_${exchangeId}`).emit('exchangeStatusUpdate', {
      exchangeId,
      ...exchangeData
    });
    
    // Also emit to individual user rooms for broader updates
    const participants = [exchange.proposerId, exchange.responderId];
    participants.forEach(userId => {
      io.to(`user_${userId}`).emit('exchangeStatusUpdate', {
        exchangeId,
        ...exchangeData
      });
    });
    
    socketLogger.info('Emitted exchange status update', { exchangeId });
  } catch (error) {
    socketLogger.error('Error emitting exchange status update', error as Error, { exchangeId });
  }
}

io.on('connection', (socket) => {
  socketLogger.info('User connected', { socketId: socket.id, transport: socket.conn.transport.name });
  
  // Store user ID and active chat in socket for authorization
  socket.userId = null;
  socket.activeChatId = null;

  // Handle user room joining (simpler authentication)
  socket.on('joinUserRoom', async (userId) => {
    try {
      if (userId) {
        socket.userId = userId;
        socket.join(`user_${userId}`);
        console.log(`User ${userId} joined user room ${userId}`);
        
        // Set user as online in presence system
        await presenceManager.setUserOnline(userId);
        
        // Broadcast presence update to all connected clients
        console.log(`[PRESENCE] Broadcasting user ${userId} is online`);
        io.emit('presenceUpdate', {
          userId: userId,
          online: true,
          timestamp: new Date().toISOString()
        });
        
        // Notify all communities the user is in
        const client = await clientPromise;
        const db = client.db('bookex');
        const communities = await db.collection('communities').find({
          'members.userId': userId
        }, { projection: { _id: 1 } }).toArray();
        
        communities.forEach(community => {
          socket.to(`community_${community._id}`).emit('userOnline', {
            userId: userId,
            communityId: community._id.toString()
          });
        });
      }
    } catch (error) {
      console.error('User room join error:', error);
      socket.emit('error', { message: 'Failed to join user room' });
    }
  });

  // Keep the old authenticate method for backward compatibility
  socket.on('authenticate', async (token) => {
    try {
      if (token && process.env.NEXTAUTH_SECRET) {
        const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET) as any;
        socket.userId = decoded.sub || decoded.id;
        console.log(`User ${socket.userId} authenticated via token`);
        
        // Set user as online in presence system
        await presenceManager.setUserOnline(socket.userId!);
        
        // Notify all communities the user is in
        const client = await clientPromise;
        const db = client.db('bookex');
        const communities = await db.collection('communities').find({
          'members.userId': socket.userId
        }, { projection: { _id: 1 } }).toArray();
        
        communities.forEach(community => {
          socket.to(`community_${community._id}`).emit('userOnline', {
            userId: socket.userId,
            communityId: community._id.toString()
          });
        });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('error', { message: 'Authentication failed' });
    }
  });

  socket.on('joinChat', (chatId) => {
    socket.join(chatId);
    socket.activeChatId = chatId;
    
    // Track active chat for notification logic
    if (socket.userId) {
      if (!activeChats.has(socket.userId)) {
        activeChats.set(socket.userId, new Set());
      }
      activeChats.get(socket.userId)!.add(chatId);
    }
    
    console.log(`User ${socket.id} joined chat ${chatId}`);
  });

  socket.on('leaveChat', (chatId) => {
    socket.leave(chatId);
    if (socket.activeChatId === chatId) {
      socket.activeChatId = null;
    }
    
    // Remove from active chats tracking
    if (socket.userId) {
      const userChats = activeChats.get(socket.userId);
      if (userChats) {
        userChats.delete(chatId);
        if (userChats.size === 0) {
          activeChats.delete(socket.userId);
        }
      }
    }
    
    console.log(`User ${socket.id} left chat ${chatId}`);
  });

  socket.on('sendMessage', async (data) => {
    const { chatId, senderId, text, attachments } = data;
    
    try {
        const client = await clientPromise;
        const db = client.db("bookex");

        // Fetch the chat to get participants
        const chat = await db.collection("chats").findOne({ _id: new ObjectId(chatId) });
        
        if (!chat) {
            console.error(`Chat ${chatId} not found`);
            socket.emit('error', { message: 'Chat not found' });
            return;
        }

        // Verify sender is a participant
        if (!chat.participantIds || !chat.participantIds.includes(senderId)) {
            console.error(`User ${senderId} is not a participant in chat ${chatId}`);
            socket.emit('error', { message: 'Not authorized to send messages in this chat' });
            return;
        }

        const newMessage = {
            _id: new ObjectId(),
            senderId: senderId,
            receiverId: chat.participantIds.find((id: string) => id !== senderId),
            content: text,
            createdAt: new Date().toISOString(),
            read: false,
            attachments: attachments || []
        };

        const result = await db.collection("chats").updateOne(
            { _id: new ObjectId(chatId) },
            { 
                $push: { messages: newMessage },
                $set: { 
                    lastMessage: {
                        _id: newMessage._id,
                        content: text,
                        createdAt: newMessage.createdAt
                    },
                    updatedAt: new Date().toISOString()
                }
            } as any
        );
        
        if (result.modifiedCount > 0) {
            console.log(`[CHAT] Message saved to chat ${chatId}, broadcasting...`);
            
            // Broadcast to everyone in the chat room (including sender for confirmation)
            io.to(chatId).emit('receiveMessage', newMessage);
            
            // Also emit to user rooms for notifications
            chat.participantIds.forEach((participantId: string) => {
                io.to(`user_${participantId}`).emit('newChatMessage', {
                    chatId,
                    message: newMessage
                });
            });
            
            console.log(`[CHAT] Message broadcast complete`);
        } else {
            console.error(`Failed to save message for chat ${chatId}`);
            socket.emit('error', { message: 'Failed to save message' });
        }

    } catch (error) {
        console.error("Error sending message:", error);
        socket.emit('error', { message: 'Error sending message' });
    }
  });

  // Community real-time events
  socket.on('joinCommunity', (communityId) => {
    socket.join(`community_${communityId}`);
    console.log(`User ${socket.id} joined community ${communityId}`);
  });

  socket.on('leaveCommunity', (communityId) => {
    socket.leave(`community_${communityId}`);
    console.log(`User ${socket.id} left community ${communityId}`);
  });

  socket.on('joinExchange', async (exchangeId) => {
    if (!socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }
    try {
      const client = await clientPromise;
      const db = client.db('bookex');
      const exchange = await db.collection('exchanges').findOne({ _id: new ObjectId(exchangeId) });
      if (!exchange || (exchange.proposerId !== socket.userId && exchange.responderId !== socket.userId)) {
        socket.emit('error', { message: 'Not a participant in this exchange' });
        return;
      }
      socket.join(`exchange_${exchangeId}`);
    } catch {
      socket.emit('error', { message: 'Failed to join exchange room' });
    }
  });

  socket.on('leaveExchange', (exchangeId) => {
    socket.leave(`exchange_${exchangeId}`);
  });

  // Channel events with authorization
  socket.on('joinChannel', async (data) => {
    const { channelId, communityId } = data;
    
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Verify user is member of community
      const client = await clientPromise;
      const db = client.db('bookex');
      const community = await db.collection('communities').findOne({
        _id: new ObjectId(communityId),
        'members.userId': socket.userId
      });

      if (!community) {
        socket.emit('error', { message: 'Not a member of this community' });
        return;
      }

      // Check if channel exists in community
      const channel = community.channels?.find((c: any) => c._id === channelId);
      if (!channel) {
        socket.emit('error', { message: 'Channel not found' });
        return;
      }

      socket.join(`channel_${channelId}`);
      console.log(`User ${socket.id} joined channel ${channelId}`);
    } catch (error) {
      console.error('Error joining channel:', error);
      socket.emit('error', { message: 'Failed to join channel' });
    }
  });

  socket.on('leaveChannel', (channelId) => {
    socket.leave(`channel_${channelId}`);
    console.log(`User ${socket.id} left channel ${channelId}`);
  });

  socket.on('joinUserRoom', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${socket.id} joined user room ${userId}`);
  });

  // Handle presence check requests
  socket.on('checkPresence', async (data: { userIds: string[] }) => {
    try {
      const { userIds } = data;
      console.log(`[PRESENCE] Checking presence for:`, userIds);
      
      const presenceStatuses = userIds.map(userId => ({
        userId,
        online: presenceManager.isUserOnline(userId)
      }));
      
      console.log('[PRESENCE] Sending statuses:', presenceStatuses);
      socket.emit('presenceStatuses', presenceStatuses);
    } catch (error) {
      console.error('[PRESENCE] Error:', error);
    }
  });

  socket.on('postCreated', async (data) => {
    const { communityId, post } = data;
    
    try {
        // Broadcast new post to all community members
        io.to(`community_${communityId}`).emit('newPost', {
            communityId,
            post,
            timestamp: new Date().toISOString()
        });

        // Also emit member count update
        const client = await clientPromise;
        const db = client.db("bookex");
        const community = await db.collection("communities").findOne(
            { _id: new ObjectId(communityId) },
            { projection: { memberCount: 1 } }
        );

        if (community) {
            io.to(`community_${communityId}`).emit('memberCountUpdate', {
                communityId,
                memberCount: community.memberCount
            });
        }

    } catch (error) {
        console.error("Error broadcasting new post:", error);
    }
  });

  socket.on('commentCreated', async (data) => {
    const { communityId, postId, comment } = data;
    
    try {
        // Broadcast new comment to all community members
        io.to(`community_${communityId}`).emit('newComment', {
            communityId,
            postId,
            comment,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("Error broadcasting new comment:", error);
    }
  });

  socket.on('postLiked', async (data) => {
    const { communityId, postId, userId, liked } = data;
    
    try {
        // Broadcast like update to all community members
        io.to(`community_${communityId}`).emit('postLikeUpdate', {
            communityId,
            postId,
            userId,
            liked,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("Error broadcasting like update:", error);
    }
  });

  // Chat message events
  socket.on('chatMessage', async (data) => {
    const { channelId, message } = data;
    
    try {
        // Broadcast new chat message to all channel members
        io.to(`channel_${channelId}`).emit('newChatMessage', {
            channelId,
            message,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("Error broadcasting chat message:", error);
    }
  });

  // Personal messaging events
  socket.on('personalMessage', async (data) => {
    const { receiverId, content, attachments } = data; // Added attachments support
    
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      if (!receiverId || (!content && (!attachments || attachments.length === 0))) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      const client = await clientPromise;
      const db = client.db('bookex');
      
      // ✅ SECURITY FIX: Fetch sender info from database (prevent impersonation)
      const sender = await db.collection('users').findOne(
        { _id: new ObjectId(socket.userId) },
        { projection: { name: 1, avatarUrl: 1, username: 1 } }
      );

      if (!sender) {
        socket.emit('error', { message: 'Sender not found' });
        return;
      }

      // ✅ SECURITY FIX: Check if users have blocked each other
      const [senderUser, receiverUser] = await Promise.all([
        db.collection('users').findOne(
          { _id: new ObjectId(socket.userId) },
          { projection: { blockedUsers: 1 } }
        ),
        db.collection('users').findOne(
          { _id: new ObjectId(receiverId) },
          { projection: { blockedUsers: 1 } }
        )
      ]);

      const senderBlockedReceiver = senderUser?.blockedUsers?.includes(receiverId);
      const receiverBlockedSender = receiverUser?.blockedUsers?.includes(socket.userId);

      if (senderBlockedReceiver || receiverBlockedSender) {
        socket.emit('error', { 
          message: 'Cannot send message due to blocking restrictions' 
        });
        return;
      }

      // ✅ SECURITY FIX: Sanitize content (prevent XSS)
      const sanitizedContent = content 
        ? content.trim().replace(/[<>]/g, '').slice(0, 2000)
        : '';

      // Validate attachments if present
      const validatedAttachments = attachments && Array.isArray(attachments)
        ? attachments.slice(0, 5).map((att: any) => ({
            id: att.id || `${Date.now()}-${Math.random()}`,
            type: att.type || 'other',
            fileName: att.fileName?.slice(0, 255) || 'file',
            fileSize: Math.min(att.fileSize || 0, 10 * 1024 * 1024), // Max 10MB
            mimeType: att.mimeType || 'application/octet-stream',
            url: att.url || '',
            thumbnailUrl: att.thumbnailUrl,
            uploadedAt: att.uploadedAt || new Date().toISOString()
          }))
        : undefined;

      if (!sanitizedContent && (!validatedAttachments || validatedAttachments.length === 0)) {
        socket.emit('error', { message: 'Message must have content or attachments' });
        return;
      }
      
      const messageDoc: any = {
        senderId: socket.userId,
        receiverId,
        content: sanitizedContent,
        createdAt: new Date().toISOString(),
        read: false
      };

      // Add attachments if present
      if (validatedAttachments && validatedAttachments.length > 0) {
        messageDoc.attachments = validatedAttachments;
      }
      
      const result = await db.collection('personalMessages').insertOne(messageDoc);
      
      // ✅ SECURITY FIX: Use server-validated sender info
      const responseMessage: any = {
        _id: result.insertedId,
        senderId: socket.userId,
        receiverId,
        content: sanitizedContent,
        createdAt: messageDoc.createdAt,
        read: false,
        sender: {
          _id: socket.userId,
          name: sender.name,
          avatarUrl: sender.avatarUrl,
          username: sender.username
        }
      };

      // Include attachments in response if present
      if (validatedAttachments && validatedAttachments.length > 0) {
        responseMessage.attachments = validatedAttachments;
      }
      
      // Send confirmation to sender
      socket.emit('messageConfirmed', {
        message: responseMessage,
        timestamp: new Date().toISOString()
      });
      
      // Send to receiver if online (find by user room)
      socket.to(`user_${receiverId}`).emit('newPersonalMessage', {
        message: responseMessage,
        timestamp: new Date().toISOString()
      });
      
      console.log(`Personal message sent from ${socket.userId} to ${receiverId}`);
      
      // Create and emit notification for the receiver (only if not viewing the chat)
      try {
        const chatId = createChatId(socket.userId, receiverId);
        
        // Check if receiver is currently viewing this chat
        const userChats = activeChats.get(receiverId);
        const isViewingChat = userChats && userChats.has(chatId);
        
        if (!isViewingChat) {
          const notification = await createMessageNotification(
            receiverId,
            socket.userId,
            sender.name,
            sanitizedContent,
            chatId
          );
          
          if (notification) {
            // Emit notification directly through socket (we're already in the socket server!)
            io.to(receiverId).emit('newNotification', notification);
            console.log(`Notification sent to user ${receiverId} for new message`);
          }
        } else {
          console.log(`User ${receiverId} is viewing chat ${chatId}, skipping notification`);
        }
      } catch (notificationError) {
        console.error('Error creating message notification:', notificationError);
        // Don't fail the message send if notification fails
      }
      
    } catch (error) {
      console.error('Error handling personal message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.userId) {
      // Clean up active chats tracking
      if (socket.activeChatId) {
        const userChats = activeChats.get(socket.userId);
        if (userChats) {
          userChats.delete(socket.activeChatId);
          if (userChats.size === 0) {
            activeChats.delete(socket.userId);
          }
        }
      }
      
      // Set user as offline in presence system
      await presenceManager.setUserOffline(socket.userId);
      
      // Broadcast presence update to all connected clients
      console.log(`[PRESENCE] Broadcasting user ${socket.userId} is offline`);
      io.emit('presenceUpdate', {
        userId: socket.userId,
        online: false,
        timestamp: new Date().toISOString()
      });
      
      // Notify all communities the user was in
      try {
        const client = await clientPromise;
        const db = client.db('bookex');
        const communities = await db.collection('communities').find({
          'members.userId': socket.userId
        }, { projection: { _id: 1 } }).toArray();
        
        communities.forEach(community => {
          socket.to(`community_${community._id}`).emit('userOffline', {
            userId: socket.userId,
            communityId: community._id.toString()
          });
        });
      } catch (error) {
        console.error('Error notifying communities of user offline:', error);
      }
    }
  });
});

const PORT = process.env.SOCKET_PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
  console.log(`CORS configured for:`, getCorsOrigins());
});

httpServer.on('error', (error) => {
  console.error('Socket server error:', error);
});

// Export functions to emit community events from actions
export async function emitCommunityPostCreated(communityId: string, post: any) {
  try {
    io.to(`community_${communityId}`).emit('newPost', {
      communityId,
      post,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error emitting community post created:", error);
  }
}

export async function emitCommunityCommentCreated(communityId: string, postId: string, comment: any) {
  try {
    io.to(`community_${communityId}`).emit('newComment', {
      communityId,
      postId,
      comment,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error emitting community comment created:", error);
  }
}

export async function emitCommunityPostLiked(communityId: string, postId: string, userId: string, liked: boolean) {
  try {
    io.to(`community_${communityId}`).emit('postLikeUpdate', {
      communityId,
      postId,
      userId,
      liked,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error emitting community post liked:", error);
  }
}

export async function emitUserNotification(userId: string, notification: any) {
  try {
    io.to(`user_${userId}`).emit('newNotification', notification);
  } catch (error) {
    console.error("Error emitting user notification:", error);
  }
}

export async function emitCommunityUpdate(communityId: string, action: 'join' | 'leave' | 'new_community', data: any) {
  try {
    // Broadcast to all users who might be viewing community lists
    io.emit('communityUpdate', { communityId, action, ...data });
  } catch (error) {
    console.error("Error emitting community update:", error);
  }
}

export async function emitNewCommunity(community: any) {
  try {
    io.emit('newCommunity', { community });
  } catch (error) {
    console.error("Error emitting new community:", error);
  }
}

// ─── Community Admin Real-Time Events ─────────────────────────────────────────

/**
 * Emit when community settings (name, description, visibility, permissions) change.
 * Clients in the community room reload settings; listed views update metadata.
 */
export async function emitCommunitySettingsUpdated(
  communityId: string,
  updatedFields: Record<string, unknown>
) {
  try {
    const payload = {
      communityId,
      updatedFields,
      timestamp: new Date().toISOString(),
    };
    io.to(`community_${communityId}`).emit('communitySettingsUpdated', payload);
    // Also broadcast globally so community list cards update
    io.emit('communityMetaUpdated', { communityId, ...updatedFields });
  } catch (error) {
    console.error('Error emitting communitySettingsUpdated:', error);
  }
}

/**
 * Emit when a member's role changes (promote/demote).
 * Notifies the community room and the affected user's personal room so their
 * UI permissions are refreshed immediately.
 */
export async function emitCommunityMemberRoleChanged(
  communityId: string,
  targetUserId: string,
  newRole: string,
  actorId: string
) {
  try {
    const payload = {
      communityId,
      targetUserId,
      newRole,
      actorId,
      timestamp: new Date().toISOString(),
    };
    io.to(`community_${communityId}`).emit('communityMemberRoleChanged', payload);
    io.to(`user_${targetUserId}`).emit('communityRoleChanged', payload);
  } catch (error) {
    console.error('Error emitting communityMemberRoleChanged:', error);
  }
}

/**
 * Emit when a member is removed from a community.
 * The removed user's client can then redirect them out of the community view.
 */
export async function emitCommunityMemberRemoved(
  communityId: string,
  removedUserId: string,
  actorId: string
) {
  try {
    const payload = {
      communityId,
      removedUserId,
      actorId,
      timestamp: new Date().toISOString(),
    };
    io.to(`community_${communityId}`).emit('communityMemberRemoved', payload);
    io.to(`user_${removedUserId}`).emit('communityRemoved', payload);
  } catch (error) {
    console.error('Error emitting communityMemberRemoved:', error);
  }
}

/**
 * Emit when a member is banned or unbanned.
 * Banned user's client session is invalidated for this community in real-time.
 */
export async function emitCommunityMemberBanned(
  communityId: string,
  targetUserId: string,
  banned: boolean,
  reason?: string
) {
  try {
    const payload = {
      communityId,
      targetUserId,
      banned,
      reason,
      timestamp: new Date().toISOString(),
    };
    io.to(`community_${communityId}`).emit('communityMemberBanned', payload);
    io.to(`user_${targetUserId}`).emit(banned ? 'communityBanned' : 'communityUnbanned', payload);
  } catch (error) {
    console.error('Error emitting communityMemberBanned:', error);
  }
}

/**
 * Emit when a post is pinned or unpinned.
 */
export async function emitCommunityPostPinStatusChanged(
  communityId: string,
  postId: string,
  isPinned: boolean,
  actorId: string
) {
  try {
    const payload = {
      communityId,
      postId,
      isPinned,
      actorId,
      timestamp: new Date().toISOString(),
    };
    io.to(`community_${communityId}`).emit('postPinStatusChanged', payload);
  } catch (error) {
    console.error('Error emitting postPinStatusChanged:', error);
  }
}

/**
 * Emit when a post is locked or unlocked (prevents/allows new comments).
 */
export async function emitCommunityPostLockStatusChanged(
  communityId: string,
  postId: string,
  isLocked: boolean,
  actorId: string
) {
  try {
    const payload = {
      communityId,
      postId,
      isLocked,
      actorId,
      timestamp: new Date().toISOString(),
    };
    io.to(`community_${communityId}`).emit('postLockStatusChanged', payload);
  } catch (error) {
    console.error('Error emitting postLockStatusChanged:', error);
  }
}

/**
 * Emit when a post is deleted by an admin/moderator.
 */
export async function emitCommunityPostAdminDeleted(
  communityId: string,
  postId: string,
  actorId: string
) {
  try {
    const payload = {
      communityId,
      postId,
      actorId,
      timestamp: new Date().toISOString(),
    };
    io.to(`community_${communityId}`).emit('postAdminDeleted', payload);
  } catch (error) {
    console.error('Error emitting postAdminDeleted:', error);
  }
}

/**
 * Emit when ownership is transferred to a different member.
 */
export async function emitCommunityOwnershipTransferred(
  communityId: string,
  previousOwnerId: string,
  newOwnerId: string
) {
  try {
    const payload = {
      communityId,
      previousOwnerId,
      newOwnerId,
      timestamp: new Date().toISOString(),
    };
    io.to(`community_${communityId}`).emit('communityOwnershipTransferred', payload);
    io.to(`user_${previousOwnerId}`).emit('communityOwnershipLost', payload);
    io.to(`user_${newOwnerId}`).emit('communityOwnershipGained', payload);
  } catch (error) {
    console.error('Error emitting communityOwnershipTransferred:', error);
  }
}

/**
 * Emit when a join request status changes (approved / rejected).
 */
export async function emitCommunityJoinRequestUpdated(
  communityId: string,
  requestUserId: string,
  status: 'approved' | 'rejected'
) {
  try {
    const payload = {
      communityId,
      requestUserId,
      status,
      timestamp: new Date().toISOString(),
    };
    io.to(`community_${communityId}`).emit('communityJoinRequestUpdated', payload);
    io.to(`user_${requestUserId}`).emit('joinRequestStatusChanged', payload);
  } catch (error) {
    console.error('Error emitting communityJoinRequestUpdated:', error);
  }
}

// ─── End Community Admin Real-Time Events ─────────────────────────────────────
