import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await request.json();

    if (!userId || userId === session.user.id) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const { db } = await connectToMongoDB();
    
    // Convert IDs to ObjectId if they're strings
    const targetUserId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const currentUserId = typeof session.user.id === 'string' ? new ObjectId(session.user.id) : session.user.id;

    // Check if user exists
    const targetUser = await db.collection('users').findOne(
      { _id: targetUserId },
      { projection: { _id: 1, name: 1, username: 1, avatarUrl: 1, image: 1 } }
    );

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if a conversation already exists between these users
    const existingMessage = await db.collection('personalMessages')
      .findOne({
        $or: [
          { senderId: session.user.id, receiverId: userId },
          { senderId: userId, receiverId: session.user.id }
        ]
      });

    if (existingMessage) {
      // Return existing chat ID (we'll use a consistent format)
      const chatId = [session.user.id, userId].sort().join('_');
      return NextResponse.json({ 
        chatId,
        otherParticipant: {
          _id: targetUser._id,
          name: targetUser.name,
          username: targetUser.username,
          avatarUrl: targetUser.avatarUrl || targetUser.image
        },
        existing: true
      });
    }

    // Create a new chat by creating an initial system message or placeholder
    // This ensures the chat appears in the list
    const chatId = [session.user.id, userId].sort().join('_');
    
    return NextResponse.json({ 
      chatId,
      otherParticipant: {
        _id: targetUser._id,
        name: targetUser.name,
        username: targetUser.username,
        avatarUrl: targetUser.avatarUrl || targetUser.image
      },
      existing: false
    });

  } catch (error) {
    console.error('Start chat error:', error);
    return NextResponse.json({ error: 'Failed to start chat' }, { status: 500 });
  }
}