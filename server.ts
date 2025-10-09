
import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import { Server } from 'socket.io';
import { ObjectId } from 'mongodb';
import clientPromise from './src/lib/mongodb';
import redisCache from './src/lib/redis-cache';
import jwt from 'jsonwebtoken';

// Extend Socket type to include userId
declare module 'socket.io' {
  interface Socket {
    userId: string | null;
  }
}

// Initialize Redis connection (non-blocking)
redisCache.connect().catch(() => {
  console.log('Redis not available - caching disabled');
});

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:9002", "http://127.0.0.1:9002"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  allowEIO3: true
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  console.log('Socket transport:', socket.conn.transport.name);
  
  // Store user ID in socket for authorization
  socket.userId = null;

  // Handle authentication
  socket.on('authenticate', (token) => {
    try {
      if (token && process.env.NEXTAUTH_SECRET) {
        const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET) as any;
        socket.userId = decoded.sub || decoded.id;
        console.log(`User ${socket.userId} authenticated`);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('error', { message: 'Authentication failed' });
    }
  });

  socket.on('joinChat', (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.id} joined chat ${chatId}`);
  });

  socket.on('sendMessage', async (data) => {
    const { chatId, senderId, text } = data;
    
    try {
        const client = await clientPromise;
        const db = client.db("bookex");

        const newMessage = {
            _id: new ObjectId(),
            senderId: senderId,
            text,
            createdAt: new Date().toISOString(),
        };

        const result = await db.collection("chats").updateOne(
            { _id: new ObjectId(chatId) },
            { 
                $push: { messages: newMessage },
                $set: { 
                    lastMessage: text,
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

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.SOCKET_PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
  console.log(`CORS configured for: http://localhost:9002`);
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
