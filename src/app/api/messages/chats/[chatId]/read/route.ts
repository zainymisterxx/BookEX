import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { parseChatId, getOtherParticipant } from '@/lib/chat-utils';

// POST /api/messages/chats/[chatId]/read - Mark all messages from a user as read
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

    // Parse composite chatId to get the other user's ID
    const otherUserId = getOtherParticipant(chatId, session.user.id);
    
    if (!otherUserId) {
      return NextResponse.json({ error: 'Invalid chat ID' }, { status: 400 });
    }

    const { db } = await connectToMongoDB();

    // Mark all unread messages from the other user as read
    const result = await db.collection('personalMessages').updateMany(
      {
        senderId: otherUserId,
        receiverId: session.user.id,
        read: false
      },
      {
        $set: { read: true, readAt: new Date().toISOString() }
      }
    );

    // Emit socket event to notify all connected clients that messages were read
    if (result.modifiedCount > 0) {
      try {
        const socketUrl = process.env.SOCKET_URL || 'http://localhost:3001';
        await fetch(`${socketUrl}/emit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'messagesRead',
            room: `user_${session.user.id}`,
            data: {
              chatId: chatId,
              userId: session.user.id
            }
          })
        });
      } catch (socketError) {
        console.error('Error emitting socket event:', socketError);
        // Don't fail the request if socket emission fails
      }
    }

    return NextResponse.json({
      success: true,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Error marking messages as read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}