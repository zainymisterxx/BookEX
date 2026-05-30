import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { parseChatId, getOtherParticipant } from '@/lib/chat-utils';
import { ObjectId } from 'mongodb';

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

    const { db } = await connectToMongoDB();

    // Check if this is a new-style chat (MongoDB ObjectId) or old-style (userId1_userId2)
    const isNewStyleChat = ObjectId.isValid(chatId) && !chatId.includes('_');
    
    if (isNewStyleChat) {
      // New chat format - mark messages in the chat document as read
      const chat = await db.collection('chats').findOne({ _id: new ObjectId(chatId) });
      
      if (!chat) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
      }

      // Check if user is a participant or an organization representative
      let hasAccess = chat.participantIds.includes(session.user.id);
      
      if (!hasAccess && chat.organizationId) {
        // Check if user is a representative of this organization
        const organization = await db.collection('organizations').findOne({
          _id: new ObjectId(chat.organizationId),
          'representatives.userId': session.user.id
        });
        hasAccess = !!organization;
      }

      if (!hasAccess) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Mark all messages in the chat as read for this user
      const result = await db.collection('chats').updateOne(
        { _id: new ObjectId(chatId) },
        {
          $set: {
            'messages.$[elem].read': true,
            'messages.$[elem].readAt': new Date().toISOString()
          }
        },
        {
          arrayFilters: [
            {
              'elem.senderId': { $ne: session.user.id },
              'elem.read': { $ne: true }
            }
          ]
        }
      );

      // Notify the other participant that their messages were read
      if (result.modifiedCount > 0) {
        const otherUserId = chat.participantIds.find((id: string) => id !== session.user.id);
        if (otherUserId) {
          try {
            const { emitMessagesRead } = await import('../../../../../../../server');
            await emitMessagesRead(chatId, session.user.id, otherUserId);
          } catch {
            // Don't fail the request if socket emission fails
          }
        }
      }

      return NextResponse.json({
        success: true,
        messagesMarkedRead: result.modifiedCount > 0 ? 'updated' : 'no_unread'
      });
    } else {
      // Old personal message format - use existing logic
      const otherUserId = getOtherParticipant(chatId, session.user.id);
      
      if (!otherUserId) {
        return NextResponse.json({ error: 'Invalid chat ID' }, { status: 400 });
      }

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
    }

  } catch (error) {
    console.error('Error marking messages as read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}