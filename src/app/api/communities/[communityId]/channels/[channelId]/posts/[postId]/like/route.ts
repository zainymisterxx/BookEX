import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// POST /api/communities/[communityId]/channels/[channelId]/posts/[postId]/like - Toggle like on a post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string; channelId: string; postId: string }> }
) {
  try {
    const { communityId, channelId, postId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { liked } = body;

    const { db } = await connectToMongoDB();

    // Check if user is member of community
    const community = await db.collection('communities').findOne({ _id: new ObjectId(communityId) });
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const isMember = community.members?.some((m: any) => m.userId === session.user.id);
    if (!isMember) {
      return NextResponse.json({ error: 'Not a member of this community' }, { status: 403 });
    }

    // Get the post
    const post = await db.collection('posts').findOne({ 
      _id: new ObjectId(postId),
      communityId: new ObjectId(communityId),
      channelId 
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const userId = session.user.id;
    const likedBy = post.likedBy || [];

    let updateOperation;
    if (liked) {
      // Add like if not already liked
      if (!likedBy.includes(userId)) {
        updateOperation = {
          $addToSet: { likedBy: userId },
          $inc: { likes: 1 }
        };
      } else {
        return NextResponse.json({ success: true, message: 'Already liked' });
      }
    } else {
      // Remove like if already liked
      if (likedBy.includes(userId)) {
        updateOperation = {
          $pull: { likedBy: userId },
          $inc: { likes: -1 }
        };
      } else {
        return NextResponse.json({ success: true, message: 'Already unliked' });
      }
    }

    const result = await db.collection('posts').updateOne(
      { _id: new ObjectId(postId) },
      updateOperation
    );

    if (result.modifiedCount > 0) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to update like status' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error toggling post like:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
