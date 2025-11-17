
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ObjectId } from 'mongodb';
import clientPromise from './lib/mongodb';
import type { Notification } from './lib/types';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9002",
    methods: ["GET", "POST"]
  },
  // Add connection optimizations
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e6, // 1MB
  allowEIO3: true
});

// Track user sessions to prevent duplicate room joins
const userSessions = new Map<string, Set<string>>();

// Rate limiting for socket events
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_MESSAGES_PER_MINUTE = 30;

function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimits.get(socketId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimits.set(socketId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (userLimit.count >= MAX_MESSAGES_PER_MINUTE) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

// Emit exchange status update to all participants
async function emitExchangeStatusUpdate(exchangeId: string, exchangeData: any) {
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
      io.to(userId).emit('exchangeStatusUpdate', {
        exchangeId,
        ...exchangeData
      });
    });
    
    console.log(`Emitted exchange status update for exchange ${exchangeId}`);
  } catch (error) {
    console.error('Error emitting exchange status update:', error);
  }
}

// Export the function for use in actions
export { emitExchangeStatusUpdate };

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle user room joining to track userId
  socket.on('joinUserRoom', (userId: string) => {
    if (userId && typeof userId === 'string') {
      (socket as any).userId = userId;
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined personal room with socket ${socket.id}`);
      
      // Broadcast to all that this user is online
      io.emit('presenceUpdate', {
        userId,
        online: true,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('joinChat', (chatId) => {
    // Input validation
    if (!chatId || typeof chatId !== 'string' || !ObjectId.isValid(chatId)) {
      socket.emit('error', { message: 'Invalid chat ID' });
      return;
    }
    
    socket.join(chatId);
    console.log(`User ${socket.id} joined chat ${chatId}`);
  });

  socket.on('joinExchange', (exchangeId) => {
    // Input validation
    if (!exchangeId || typeof exchangeId !== 'string' || !ObjectId.isValid(exchangeId)) {
      socket.emit('error', { message: 'Invalid exchange ID' });
      return;
    }
    
    socket.join(`exchange_${exchangeId}`);
    console.log(`User ${socket.id} joined exchange ${exchangeId}`);
  });

  socket.on('leaveExchange', (exchangeId) => {
    if (exchangeId && typeof exchangeId === 'string') {
      socket.leave(`exchange_${exchangeId}`);
      console.log(`User ${socket.id} left exchange ${exchangeId}`);
    }
  });

  socket.on('sendMessage', async (data) => {
    // Rate limiting
    if (!checkRateLimit(socket.id)) {
      socket.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
      return;
    }
    
    const { chatId, senderId, text } = data;
    
    // Input validation
    if (!chatId || !senderId || !text || 
        typeof chatId !== 'string' || typeof senderId !== 'string' || typeof text !== 'string') {
      socket.emit('error', { message: 'Invalid message data' });
      return;
    }
    
    if (!ObjectId.isValid(chatId) || !ObjectId.isValid(senderId)) {
      socket.emit('error', { message: 'Invalid ID format' });
      return;
    }
    
    if (text.trim().length === 0 || text.length > 1000) {
      socket.emit('error', { message: 'Message must be between 1 and 1000 characters' });
      return;
    }
    
    try {
        const client = await clientPromise;
        const db = client.db("bookex");

        // Use transaction for data consistency
        const session = client.startSession();
        
        try {
          await session.withTransaction(async () => {
            const newMessage = {
                _id: new ObjectId(),
                senderId: senderId,
                text: text.trim(),
                createdAt: new Date().toISOString(),
            };

            // Verify chat exists and user has access
            const chat = await db.collection("chats").findOne(
              { 
                _id: new ObjectId(chatId),
                participantIds: senderId 
              },
              { session }
            );
            
            if (!chat) {
                throw new Error(`Chat not found or access denied for id ${chatId}`);
            }

            const result = await db.collection("chats").updateOne(
                { _id: new ObjectId(chatId) },
                { 
                    $push: { messages: newMessage },
                    $set: { 
                        lastMessage: text.trim(),
                        updatedAt: new Date().toISOString()
                    }
                } as any,
                { session }
            );
            
            if (result.modifiedCount > 0) {
                // Broadcast the message to all clients in the chat room
                const messageWithChatId = { ...newMessage, chatId };
                io.to(chatId).emit('receiveMessage', messageWithChatId);

                // Also emit to user rooms for chat list updates
                chat.participantIds.forEach((participantId: string) => {
                    io.to(participantId).emit('receiveMessage', messageWithChatId);
                });

                // Create and send notification for the other participant
                const otherParticipantId = chat.participantIds.find((id: string) => id !== senderId);
                if (otherParticipantId) {
                    // Efficient user lookup with projection
                    const sender = await db.collection("users").findOne(
                      { _id: new ObjectId(senderId) },
                      { projection: { name: 1 }, session }
                    );
                    
                    const notification: Omit<Notification, '_id'> = {
                        userId: otherParticipantId,
                        type: 'message' as const,
                        title: 'New Message',
                        message: `You have a new message from ${sender?.name ? sender.name.replace(/[<>\"&]/g, '') : 'someone'}.`,
                        link: `/messages/${chatId}`,
                        read: false,
                        createdAt: new Date().toISOString(),
                        metadata: {
                            chatId,
                            senderId
                        }
                    };
                    
                    await db.collection("notifications").insertOne(notification, { session });
                    
                    // Emit a notification event to the recipient's personal room only if they're online
                    const activeRooms = io.sockets.adapter.rooms.get(otherParticipantId);
                    if (activeRooms && activeRooms.size > 0) {
                        io.to(otherParticipantId).emit('newNotification');
                    }
                }
                
                // Acknowledge successful message
                socket.emit('messageAck', { messageId: newMessage._id });
            } else {
                throw new Error(`Failed to save message for chat ${chatId}`);
            }
          });
        } finally {
          await session.endSession();
        }

    } catch (error) {
        console.error("Error sending message:", error);
        socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle presence check requests
  socket.on('checkPresence', async (data: { userIds: string[] }) => {
    try {
      const { userIds } = data;
      console.log(`[PRESENCE] Socket ${socket.id} checking presence for:`, userIds);
      
      // Get all connected sockets
      const sockets = await io.fetchSockets();
      console.log(`[PRESENCE] Total connected sockets: ${sockets.length}`);
      
      const onlineUserIds = new Set<string>();
      
      // Check which users are online
      sockets.forEach(s => {
        const userId = (s as any).userId;
        console.log(`[PRESENCE] Socket ${s.id} has userId:`, userId);
        if (userId && userIds.includes(userId)) {
          onlineUserIds.add(userId);
          console.log(`[PRESENCE] User ${userId} is ONLINE`);
        }
      });
      
      const presenceStatuses = userIds.map(userId => ({
        userId,
        online: onlineUserIds.has(userId)
      }));
      
      console.log('[PRESENCE] Sending presenceStatuses:', presenceStatuses);
      socket.emit('presenceStatuses', presenceStatuses);
    } catch (error) {
      console.error('[PRESENCE] Error checking presence:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Broadcast user offline if they had a userId
    const userId = (socket as any).userId;
    if (userId) {
      io.emit('presenceUpdate', {
        userId,
        online: false,
        timestamp: new Date().toISOString()
      });
      console.log(`User ${userId} is now offline`);
    }
    
    // Clean up user sessions
    for (const [userId, sessionSet] of userSessions.entries()) {
      sessionSet.delete(socket.id);
      if (sessionSet.size === 0) {
        userSessions.delete(userId);
      }
    }
    
    // Clean up rate limits
    rateLimits.delete(socket.id);
  });

  // Handle connection errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Periodic cleanup of expired rate limits
setInterval(() => {
  const now = Date.now();
  for (const [socketId, limit] of rateLimits.entries()) {
    if (now > limit.resetTime) {
      rateLimits.delete(socketId);
    }
  }
}, RATE_LIMIT_WINDOW);

const PORT = process.env.SOCKET_PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
