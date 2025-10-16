
import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import { Server } from 'socket.io';
import { ObjectId } from 'mongodb';
import clientPromise from './src/lib/mongodb';
import redisCache from './src/lib/redis-cache';
import { presenceManager } from './src/lib/presence';
import { getCorsOrigins } from './src/lib/url-utils';
import jwt from 'jsonwebtoken';
import { createMessageNotification, emitNotification } from './src/lib/notification-utils';
import { createChatId } from './src/lib/chat-utils';

// Extend Socket type to include userId and active chat
declare module 'socket.io' {
  interface Socket {
    userId: string | null;
    activeChatId: string | null;
  }
}

// Initialize Redis connection (non-blocking)
redisCache.connect().catch(() => {
  console.log('Redis not available - caching disabled');
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

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  console.log('Socket transport:', socket.conn.transport.name);
  
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
    const { chatId, senderId, text, imageUrl } = data;
    
    try {
        const client = await clientPromise;
        const db = client.db("bookex");

        const newMessage = {
            _id: new ObjectId(),
            senderId: senderId,
            text: text || '',
            createdAt: new Date().toISOString(),
            ...(imageUrl && { imageUrl }) // Include imageUrl if provided
        };

        // Use imageUrl or text for lastMessage preview
        const lastMessagePreview = imageUrl ? '📷 Image' : text;

        const result = await db.collection("chats").updateOne(
            { _id: new ObjectId(chatId) },
            { 
                $push: { messages: newMessage },
                $set: { 
                    lastMessage: lastMessagePreview,
                    updatedAt: new Date().toISOString()
                }
            } as any
        );
        
        if (result.modifiedCount > 0) {
            // Broadcast the message to all clients in the chat room
            io.to(chatId).emit('receiveMessage', newMessage);
        } else {
            // Handle error: chat not found or update failed
            console.error(`Failed to save message for chat ${chatId}`);
        }

    } catch (error) {
        console.error("Error sending message:", error);
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
    const { receiverId, content } = data; // ✅ SECURITY FIX: Ignore client senderName
    
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      if (!receiverId || !content) {
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
        .trim()
        .replace(/[<>]/g, '')     // Remove HTML tags
        .slice(0, 2000);          // Limit length

      if (!sanitizedContent) {
        socket.emit('error', { message: 'Message content cannot be empty' });
        return;
      }
      
      const messageDoc = {
        senderId: socket.userId,
        receiverId,
        content: sanitizedContent,
        createdAt: new Date().toISOString(),
        read: false
      };
      
      const result = await db.collection('personalMessages').insertOne(messageDoc);
      
      // ✅ SECURITY FIX: Use server-validated sender info
      const responseMessage = {
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
            await emitNotification(notification, receiverId);
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
