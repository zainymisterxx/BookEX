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
          localField: '_id',
          foreignField: '_id',
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
            avatarUrl: '$otherParticipant.avatarUrl'
          },
          unreadCount: 1
        }
      },
      { $sort: { 'lastMessage.createdAt': -1 } }
    ]).toArray();

    return NextResponse.json({ chats });

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
