import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// DELETE /api/admin/communities/[communityId]/posts/[postId] - Delete post from community
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string; postId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { communityId, postId } = await params;

    if (!ObjectId.isValid(communityId) || !ObjectId.isValid(postId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const { db } = await connectToMongoDB();

    // Check if post exists and belongs to the community
    const post = await db.collection('posts').findOne({
      _id: new ObjectId(postId),
      communityId: new ObjectId(communityId)
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found in this community' }, { status: 404 });
    }

    // Start a session for transaction
    const mongoSession = await connectToMongoDB().then(({ client }) => client.startSession());

    try {
      await mongoSession.withTransaction(async () => {
        // Delete all comments on the post
        await db.collection('comments').deleteMany(
          { postId: new ObjectId(postId) },
          { session: mongoSession }
        );

        // Delete all likes on the post
        await db.collection('likes').deleteMany(
          { postId: new ObjectId(postId) },
          { session: mongoSession }
        );

        // Delete the post
        await db.collection('posts').deleteOne(
          { _id: new ObjectId(postId) },
          { session: mongoSession }
        );

        // Update community's post count
        await db.collection('communities').updateOne(
          { _id: new ObjectId(communityId) },
          { $inc: { postsCount: -1 } },
          { session: mongoSession }
        );
      });

      return NextResponse.json({ message: 'Post deleted successfully' });

    } finally {
      await mongoSession.endSession();
    }

  } catch (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
