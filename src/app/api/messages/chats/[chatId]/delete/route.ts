import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// DELETE /api/messages/chats/[chatId] - Delete chat for current user (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { chatId } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToMongoDB();

    // Check if this is a valid ObjectId (new chat format) or composite ID (old format)
    let result;
    if (ObjectId.isValid(chatId) && chatId.length === 24) {
      // New chat format - direct ObjectId
      result = await db.collection('chats').updateOne(
        { _id: new ObjectId(chatId) },
        { $addToSet: { deletedBy: session.user.id } }
      );
    } else {
      // Old personal message format - composite ID (userId1_userId2)
      // For old format, we don't have a chats collection entry, so this is a no-op
      // The frontend will handle hiding it
      return NextResponse.json({ success: true, legacy: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 });
  }
}
