import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// POST /api/communities/[communityId]/channels/[channelId]/posts/[postId]/comments - Add a comment to a post
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
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

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

    // Check if post exists
    const post = await db.collection('posts').findOne({ 
      _id: new ObjectId(postId),
      communityId: new ObjectId(communityId),
      channelId 
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Get user details for comment author
    const user = await db.collection('users').findOne({ _id: new ObjectId(session.user.id) });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create new comment
    const newComment = {
      _id: new ObjectId(),
      postId: new ObjectId(postId),
      author: {
        _id: user._id,
        name: user.name,
        avatarUrl: user.avatarUrl
      },
      content: content.trim(),
      createdAt: new Date().toISOString()
    };

    // Insert comment
    await db.collection('comments').insertOne(newComment);

    return NextResponse.json({
      success: true,
      newComment
    });

  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
