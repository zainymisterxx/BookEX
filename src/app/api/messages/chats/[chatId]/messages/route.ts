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

    const { db } = await connectToMongoDB();

    // Get messages between current user and the other participant
    const messages = await db.collection('personalMessages').find({
      $or: [
        { senderId: session.user.id, receiverId: chatId },
        { senderId: chatId, receiverId: session.user.id }
      ]
    }).sort({ createdAt: 1 }).toArray();

    // Mark messages as read
    await db.collection('personalMessages').updateMany(
      {
        senderId: chatId,
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

    const { content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    const { db } = await connectToMongoDB();

    // Create new message
    const message = {
      senderId: session.user.id,
      receiverId: chatId,
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
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
