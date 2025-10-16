import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/messages/chats - Get user's chat conversations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToMongoDB();

    // Get all chats where user is a participant
    const chats = await db.collection('personalMessages').aggregate([
      {
        $match: {
          $or: [
            { senderId: session.user.id },
            { receiverId: session.user.id }
          ]
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$senderId', session.user.id] },
              '$receiverId',
              '$senderId'
            ]
          },
          lastMessage: { $last: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    { $ne: ['$senderId', session.user.id] },
                    { $ne: ['$read', true] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { otherUserId: '$_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $eq: ['$_id', { $toObjectId: '$$otherUserId' }] 
                } 
              } 
            },
            { $project: { name: 1, username: 1, avatarUrl: 1, image: 1 } }
          ],
          as: 'otherParticipant'
        }
      },
      {
        $unwind: {
          path: '$otherParticipant',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          otherUserId: '$_id',
          participantIds: ['$_id', session.user.id],
          lastMessage: {
            _id: '$lastMessage._id',
            senderId: '$lastMessage.senderId',
            receiverId: '$lastMessage.receiverId',
            content: '$lastMessage.content',
            createdAt: '$lastMessage.createdAt',
            read: '$lastMessage.read'
          },
          otherParticipant: {
            _id: '$otherParticipant._id',
            name: '$otherParticipant.name',
            username: '$otherParticipant.username',
            avatarUrl: { 
              $ifNull: ['$otherParticipant.avatarUrl', '$otherParticipant.image'] 
            }
          },
          unreadCount: 1
        }
      },
      { $sort: { 'lastMessage.createdAt': -1 } }
    ]).toArray();

    // Format chats with proper composite chatId
    const formattedChats = chats.map(chat => {
      const otherUserId = chat.otherUserId || chat._id;
      const chatId = [session.user.id, otherUserId].sort().join('_');
      
      // Ensure otherParticipant._id is a string
      if (chat.otherParticipant && chat.otherParticipant._id) {
        chat.otherParticipant._id = chat.otherParticipant._id.toString();
      }
      
      return {
        ...chat,
        _id: chatId,
        participantIds: [session.user.id, otherUserId]
      };
    });

    return NextResponse.json({ chats: formattedChats });

  } catch (error) {
    console.error('Error fetching chats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/messages/chats - Create a new chat
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { receiverId, content } = await request.json();

    if (!receiverId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { db } = await connectToMongoDB();

    // Create new message
    const message = {
      senderId: session.user.id,
      receiverId,
      content,
      createdAt: new Date().toISOString(),
      read: false
    };

    const result = await db.collection('personalMessages').insertOne(message);

    return NextResponse.json({
      success: true,
      message: {
        ...message,
        _id: result.insertedId
      }
    });

  } catch (error) {
    console.error('Error creating chat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
