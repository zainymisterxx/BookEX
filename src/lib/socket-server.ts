import { Server as SocketIOServer, type Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { presenceManager } from './presence';
import { connectToMongoDB } from './mongodb';
import { ObjectId } from 'mongodb';
import { getCorsOrigins } from './url-utils';

// Note: Socket type extension is declared in root server.ts
// which defines userId as string | null

interface AuthenticatedSocket extends Socket {
  userCommunities?: string[];
}

export function setupSocketServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: getCorsOrigins(),
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      // In a real implementation, you'd verify the JWT token here
      // For now, we'll use a simple approach with session data
      const token = socket.handshake.auth.token;
      
      console.log('Socket auth attempt with token:', token ? `${token.substring(0, 10)}...` : 'none');
      
      if (!token) {
        console.error('No auth token provided');
        return next(new Error('Authentication error'));
      }

      // Verify token and get user info
      // This is a simplified version - in production, verify JWT properly
      const { db } = await connectToMongoDB();
      const user = await db.collection('users').findOne({ _id: new ObjectId(token) });
      
      if (!user) {
        console.error('User not found for token:', token);
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      console.log('Socket authenticated for user:', socket.userId);
      
      // Get user's communities
      const communities = await db.collection('communities').find({
        'members.userId': user._id.toString()
      }, { projection: { _id: 1 } }).toArray();
      
      socket.userCommunities = communities.map(c => c._id.toString());
      console.log(`User ${socket.userId} is member of ${socket.userCommunities.length} communities`);
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    console.log(`User ${socket.userId} connected with socket ${socket.id}`);

    if (!socket.userId) {
      socket.disconnect();
      return;
    }

  // Set user as online (let presenceManager fetch communities if none provided)
  await presenceManager.setUserOnline(socket.userId!);

    // Join user to their personal room for direct messages and presence
    socket.join(`user:${socket.userId}`);
    
    // Broadcast to all connected sockets that this user is online
    console.log(`Broadcasting presenceUpdate: User ${socket.userId} is online`);
    io.emit('presenceUpdate', {
      userId: socket.userId,
      online: true,
      timestamp: new Date().toISOString()
    });

    // Join user to their community rooms
    socket.userCommunities?.forEach(communityId => {
      socket.join(`community:${communityId}`);
      socket.emit('joinedCommunity', { communityId });
    });

    // Handle joining a specific community
    socket.on('joinCommunity', async (data: { communityId: string }) => {
      try {
        const { communityId } = data;
        
        // Verify user is member of this community
        if (socket.userCommunities?.includes(communityId)) {
          socket.join(`community:${communityId}`);
          socket.emit('joinedCommunity', { communityId });
          
          // Update presence
          await presenceManager.setUserOnline(socket.userId!, communityId);
          
          // Notify others in the community
          socket.to(`community:${communityId}`).emit('userOnline', {
            userId: socket.userId,
            communityId
          });
        }
      } catch (error) {
        console.error('Error joining community:', error);
      }
    });

    // Handle leaving a community
    socket.on('leaveCommunity', async (data: { communityId: string }) => {
      try {
        const { communityId } = data;
        socket.leave(`community:${communityId}`);
        
        // Notify others in the community
        socket.to(`community:${communityId}`).emit('userOffline', {
          userId: socket.userId,
          communityId
        });
      } catch (error) {
        console.error('Error leaving community:', error);
      }
    });

    // Handle joining a channel
    socket.on('joinChannel', (data: { channelId: string; communityId?: string }) => {
      const { channelId } = data;
      socket.join(`channel:${channelId}`);
      socket.emit('joinedChannel', { channelId });
    });

    // Handle leaving a channel
    socket.on('leaveChannel', (data: { channelId: string }) => {
      const { channelId } = data;
      socket.leave(`channel:${channelId}`);
    });

    // Handle chat messages
    socket.on('chatMessage', async (data: { channelId: string; message: any }) => {
      try {
        const { channelId, message } = data;
        
        if (!socket.userId) {
          return;
        }

        const { db } = await connectToMongoDB();
        
        // ✅ SECURITY FIX: Fetch author from database (prevent impersonation)
        const author = await db.collection('users').findOne(
          { _id: new ObjectId(socket.userId) },
          { projection: { name: 1, avatarUrl: 1, username: 1 } }
        );

        if (!author) {
          return;
        }

        // ✅ SECURITY FIX: Sanitize content (prevent XSS)
        const sanitizedContent = message.content
          ?.trim()
          ?.replace(/[<>]/g, '')     // Remove HTML tags
          ?.slice(0, 2000);          // Limit length

        if (!sanitizedContent) {
          return;
        }
        
        // Save message to database
        const messageDoc = {
          channelId,
          authorId: socket.userId,
          content: sanitizedContent,
          createdAt: new Date().toISOString()
        };
        
        const result = await db.collection('chatMessages').insertOne(messageDoc);
        
        // Broadcast to channel with server-validated author info
        io.to(`channel:${channelId}`).emit('newChatMessage', {
          channelId,
          message: {
            _id: result.insertedId,
            ...messageDoc,
            author: {
              _id: socket.userId,
              name: author.name,           // ✅ Server-validated
              avatarUrl: author.avatarUrl, // ✅ Server-validated
              username: author.username    // ✅ Server-validated
            }
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error handling chat message:', error);
      }
    });

    // Handle personal messages
    socket.on('personalMessage', async (data: { receiverId: string; message: any }) => {
      try {
        const { receiverId, message } = data;
        
        // Save message to database
        const { db } = await connectToMongoDB();
        const messageDoc = {
          senderId: socket.userId,
          receiverId,
          content: message.content,
          createdAt: new Date().toISOString()
        };
        
        await db.collection('personalMessages').insertOne(messageDoc);
        
        // Send to receiver if online
        const receiverSocket = Array.from(io.sockets.sockets.values())
          .find(s => (s as AuthenticatedSocket).userId === receiverId);
        
        if (receiverSocket) {
          receiverSocket.emit('newPersonalMessage', {
            message: {
              ...messageDoc,
              sender: {
                _id: socket.userId,
                name: message.senderName || 'Unknown User'
              }
            },
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error handling personal message:', error);
      }
    });

    // Handle typing indicators
    socket.on('typing', (data: { channelId: string; isTyping: boolean }) => {
      const { channelId, isTyping } = data;
      socket.to(`channel:${channelId}`).emit('userTyping', {
        userId: socket.userId,
        isTyping,
        channelId
      });
    });

    // Handle presence check requests
    socket.on('checkPresence', async (data: { userIds: string[] }) => {
      try {
        const { userIds } = data;
        console.log(`User ${socket.userId} checking presence for:`, userIds);
        const presenceStatuses = userIds.map(userId => {
          const isOnline = presenceManager.isUserOnline(userId);
          console.log(`  - User ${userId}: ${isOnline ? 'online' : 'offline'}`);
          return {
            userId,
            online: isOnline
          };
        });
        console.log('Sending presenceStatuses:', presenceStatuses);
        socket.emit('presenceStatuses', presenceStatuses);
      } catch (error) {
        console.error('Error checking presence:', error);
      }
    });

    // Handle single user presence check
    socket.on('getUserPresence', (data: { userId: string }) => {
      try {
        const presence = presenceManager.getUserPresence(data.userId);
        socket.emit('userPresence', {
          userId: data.userId,
          online: presence?.isOnline || false,
          lastSeen: presence?.lastSeen
        });
      } catch (error) {
        console.error('Error getting user presence:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async (reason) => {
      console.log(`User ${socket.userId} disconnected: ${reason}`);
      
      // Set user as offline
      await presenceManager.setUserOffline(socket.userId!);
      
      // Broadcast to all that user is offline
      console.log(`Broadcasting presenceUpdate: User ${socket.userId} is offline`);
      io.emit('presenceUpdate', {
        userId: socket.userId,
        online: false,
        timestamp: new Date().toISOString()
      });
      
      // Notify all communities the user was in
      socket.userCommunities?.forEach(communityId => {
        socket.to(`community:${communityId}`).emit('userOffline', {
          userId: socket.userId,
          communityId
        });
      });
    });
  });

  return io;
}
