import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// DELETE /api/admin/communities/[communityId]/members/[userId] - Remove member from community
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string; userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { communityId, userId } = await params;

    if (!ObjectId.isValid(communityId) || !ObjectId.isValid(userId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const { db } = await connectToMongoDB();

    // Check if community exists
    const community = await db.collection('communities').findOne({
      _id: new ObjectId(communityId)
    });

    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    // Check if user exists
    const user = await db.collection('users').findOne({
      _id: new ObjectId(userId)
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Remove user from community members
    await db.collection('communities').updateOne(
      { _id: new ObjectId(communityId) },
      {
        $pull: { members: new ObjectId(userId) } as any,
        $inc: { memberCount: -1 }
      }
    );

    // Remove community from user's communities
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $pull: { communities: new ObjectId(communityId) } as any }
    );

    return NextResponse.json({ message: 'Member removed successfully' });

  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
