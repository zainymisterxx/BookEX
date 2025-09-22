import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/communities/[communityId]/channels/[channelId]/posts - Get posts for a channel
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string; channelId: string }> }
) {
  try {
    const { communityId, channelId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

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

    // Get posts for this channel
    const skip = (page - 1) * limit;
    const [posts, totalPosts] = await Promise.all([
      db.collection('posts')
        .find({ communityId: new ObjectId(communityId), channelId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('posts').countDocuments({ communityId: new ObjectId(communityId), channelId })
    ]);

    const totalPages = Math.ceil(totalPosts / limit);

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total: totalPosts,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching channel posts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/communities/[communityId]/channels/[channelId]/posts - Create a new post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string; channelId: string }> }
) {
  try {
    const { communityId, channelId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { authorId, content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (authorId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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

    // Create new post
    const newPost = {
      _id: new ObjectId(),
      authorId,
      communityId: new ObjectId(communityId),
      channelId,
      content: content.trim(),
      likes: 0,
      likedBy: [],
      comments: [],
      createdAt: new Date().toISOString()
    };

    await db.collection('posts').insertOne(newPost);

    return NextResponse.json({
      success: true,
      newPost
    });

  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
