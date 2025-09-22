import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { isCommunityMember } from '@/lib/community-permissions';

// GET /api/communities/[communityId]/channels/[channelId]/messages - Get chat messages for a channel
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
    const limit = parseInt(searchParams.get('limit') || '50');

    const { db } = await connectToMongoDB();

    // Check if user is member of community
    const isMember = await isCommunityMember(communityId, session.user.id);
    if (!isMember) {
      return NextResponse.json({ error: 'Not a member of this community' }, { status: 403 });
    }

    // Get messages for this channel
    const skip = (page - 1) * limit;
    const [messages, totalMessages] = await Promise.all([
      db.collection('chatMessages')
        .find({ channelId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('chatMessages').countDocuments({ channelId })
    ]);

    // Reverse to get chronological order
    messages.reverse();

    const totalPages = Math.ceil(totalMessages / limit);

    return NextResponse.json({
      messages,
      pagination: {
        page,
        limit,
        total: totalMessages,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching channel messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/communities/[communityId]/channels/[channelId]/messages - Send a chat message
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
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const { db } = await connectToMongoDB();

    // Check if user is member of community and get member info
    const community = await db.collection('communities').findOne({ _id: new ObjectId(communityId) });
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const member = community.members?.find((m: any) => m.userId === session.user.id);
    if (!member || member.banned) {
      return NextResponse.json({ error: 'Not a member of this community' }, { status: 403 });
    }

    // Get user details for message author
    const user = await db.collection('users').findOne({ _id: new ObjectId(session.user.id) });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create new chat message
    const newMessage = {
      _id: new ObjectId(),
      channelId,
      author: {
        _id: user._id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: member.role
      },
      content: content.trim(),
      createdAt: new Date().toISOString()
    };

    // Insert message
    await db.collection('chatMessages').insertOne(newMessage);

    return NextResponse.json({
      success: true,
      newMessage
    });

  } catch (error) {
    console.error('Error creating chat message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
