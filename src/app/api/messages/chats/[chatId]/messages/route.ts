import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/messages/chats/[chatId]/messages - Get messages for a chat
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db, client } = await connectToMongoDB();

    // Check if this is a new ObjectId-based chat or legacy composite format
    const isObjectIdChat = ObjectId.isValid(chatId) && chatId.length === 24;
    
    if (isObjectIdChat) {
      // NEW SYSTEM: Fetch from chats collection
      const chat = await db.collection('chats').findOne({ _id: new ObjectId(chatId) });
      
      if (!chat) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
      }
      
      // Verify user is a participant or organization representative
      const isParticipant = chat.participantIds?.includes(session.user.id);
      let isOrgRep = false;
      
      if (chat.organizationId && !isParticipant) {
        const org = await db.collection('organizations').findOne({
          _id: chat.organizationId,
          'representatives.userId': session.user.id
        });
        isOrgRep = !!org;
      }
      
      if (!isParticipant && !isOrgRep) {
        return NextResponse.json({ error: 'Forbidden: Not a participant in this chat' }, { status: 403 });
      }
      
      // Get messages from chat document
      const messages = chat.messages || [];
      
      // Mark unread messages as read
      const unreadMessageIds = messages
        .filter((msg: any) => msg.senderId !== session.user.id && !msg.read)
        .map((msg: any) => msg._id);
      
      if (unreadMessageIds.length > 0) {
        await db.collection('chats').updateOne(
          { _id: new ObjectId(chatId) },
          { $set: { 'messages.$[msg].read': true } },
          { arrayFilters: [{ 'msg._id': { $in: unreadMessageIds } }] }
        );
      }
      
      return NextResponse.json({ messages });
    }
    
    // LEGACY SYSTEM: Handle composite chatId format
    // ✅ SECURITY FIX: Verify user is a participant in this chat
    // chatId is composite format: "userId1_userId2" (sorted)
    // Extract participant IDs from composite chatId
    const participantIds = chatId.split('_');
    
    // Verify current user is one of the participants
    if (!participantIds.includes(session.user.id)) {
      return NextResponse.json({ error: 'Forbidden: Not a participant in this chat' }, { status: 403 });
    }
    
    // Get the other participant's ID
    const otherUserId = participantIds.find(id => id !== session.user.id);
    
    if (!otherUserId) {
      return NextResponse.json({ error: 'Invalid chat ID format' }, { status: 400 });
    }

    // Get messages with user details using aggregation
    const { cursor, limit = "50" } = Object.fromEntries(
      new URL(request.url).searchParams
    );

    // Build pagination query
    const paginationQuery = cursor
      ? {
          $or: [
            { createdAt: { $lt: new Date(cursor) } },
            {
              createdAt: cursor,
              _id: { $lt: new ObjectId(cursor.split('-')[1]) }
            }
          ]
        }
      : {};

    // Combine with chat filter
    const messages = await db.collection('personalMessages').aggregate([
      {
        $match: {
          $and: [
            {
              $or: [
                { senderId: session.user.id, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: session.user.id }
              ]
            },
            paginationQuery
          ]
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { senderId: { $toObjectId: '$senderId' } },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$senderId'] } } },
            { $project: { name: 1, avatarUrl: 1, username: 1 } }
          ],
          as: 'sender'
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { receiverId: { $toObjectId: '$receiverId' } },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$receiverId'] } } },
            { $project: { name: 1, avatarUrl: 1, username: 1 } }
          ],
          as: 'receiver'
        }
      },
      {
        $addFields: {
          sender: { $arrayElemAt: ['$sender', 0] },
          receiver: { $arrayElemAt: ['$receiver', 0] }
        }
      },
      { $sort: { createdAt: 1 } }
    ]).toArray();

    // Mark messages as read
    await db.collection('personalMessages').updateMany(
      {
        senderId: otherUserId,
        receiverId: session.user.id,
        read: { $ne: true }
      },
      { $set: { read: true } }
    );

    return NextResponse.json({ messages });

  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/messages/chats/[chatId]/messages - Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, attachments } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    const { db, client } = await connectToMongoDB();

    // Check if this is a new ObjectId-based chat or legacy composite format
    const isObjectIdChat = ObjectId.isValid(chatId) && chatId.length === 24;
    
    if (isObjectIdChat) {
      // NEW SYSTEM: Add message to chats collection
      const chat = await db.collection('chats').findOne({ _id: new ObjectId(chatId) });
      
      if (!chat) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
      }
      
      // Verify user is a participant
      if (!chat.participantIds?.includes(session.user.id)) {
        return NextResponse.json({ error: 'Forbidden: Not a participant in this chat' }, { status: 403 });
      }
      
      // Get the other participant
      const receiverId = chat.participantIds.find((id: string) => id !== session.user.id);
      
      if (!receiverId) {
        return NextResponse.json({ error: 'Receiver not found' }, { status: 400 });
      }
      
      // Sanitize message content
      const sanitizedContent = content
        .trim()
        .replace(/[<>]/g, '')
        .slice(0, 2000);
      
      // Create new message
      const newMessage = {
        _id: new ObjectId(),
        senderId: session.user.id,
        receiverId: receiverId,
        content: sanitizedContent,
        createdAt: new Date().toISOString(),
        read: false,
        attachments: attachments || []
      };
      
      // Add message to chat
      await db.collection('chats').updateOne(
        { _id: new ObjectId(chatId) },
        {
          $push: { messages: newMessage } as any,
          $set: {
            lastMessage: {
              _id: newMessage._id,
              content: sanitizedContent,
              createdAt: newMessage.createdAt
            },
            updatedAt: new Date().toISOString()
          }
        } as any
      );
      
      return NextResponse.json({
        success: true,
        message: newMessage
      });
    }
    
    // LEGACY SYSTEM: Handle composite chatId format
    // Extract the other participant's ID from the composite chatId
    const [userId1, userId2] = chatId.split('_');
    const otherUserId = userId1 === session.user.id ? userId2 : userId1;

    // ✅ SECURITY FIX: Check if users have blocked each other
    const [senderUser, receiverUser] = await Promise.all([
      db.collection('users').findOne(
        { _id: new ObjectId(session.user.id) },
        { projection: { blockedUsers: 1 } }
      ),
      db.collection('users').findOne(
        { _id: new ObjectId(otherUserId) },
        { projection: { blockedUsers: 1 } }
      )
    ]);

    const senderBlockedReceiver = senderUser?.blockedUsers?.includes(otherUserId);
    const receiverBlockedSender = receiverUser?.blockedUsers?.includes(session.user.id);

    if (senderBlockedReceiver || receiverBlockedSender) {
      return NextResponse.json(
        { error: 'Cannot send message due to blocking restrictions' }, 
        { status: 403 }
      );
    }

    // Sanitize message content
    const sanitizedContent = content
      .trim()
      .replace(/[<>]/g, '') // Basic HTML tag prevention
      .slice(0, 2000);  // Limit message length

    // Create new message
    const message = {
      senderId: session.user.id,
      receiverId: otherUserId,
      content: sanitizedContent,
      createdAt: new Date().toISOString(),
      read: false
    };

    // Start a MongoDB session for atomicity
    const mongoSession = await client.startSession();
    let messageId;

    try {
      const result = await mongoSession.withTransaction(async () => {
        // Insert the message
        const insertResult = await db.collection('personalMessages').insertOne(message, { session: mongoSession });
        messageId = insertResult.insertedId;
        
        // Update last message in chats collection if needed
        await db.collection('chats').updateOne(
          {
            $or: [
              { participantIds: [message.senderId, message.receiverId] },
              { participantIds: [message.receiverId, message.senderId] }
            ]
          },
          {
            $set: {
              lastMessage: {
                _id: messageId,
                content: sanitizedContent,
                createdAt: message.createdAt
              }
            }
          },
          { session: mongoSession, upsert: true }
        );

        return { ...message, _id: messageId };
      });

      return NextResponse.json({
        success: true,
        message: result
      });
    } catch (error) {
      console.error('Transaction error:', error);
      throw error;
    } finally {
      await mongoSession.endSession();
    }

  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
