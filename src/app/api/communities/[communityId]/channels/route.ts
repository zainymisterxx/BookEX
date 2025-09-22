import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserCommunityRole, hasModerationPrivileges } from '@/lib/community-permissions';

// POST /api/communities/[communityId]/channels - Create a new channel
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    const { communityId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, description } = body;

    // Validate input
    if (!name || !type || !['forum', 'chat'].includes(type)) {
      return NextResponse.json({ error: 'Invalid channel data' }, { status: 400 });
    }

    const { db } = await connectToMongoDB();

    // Check if user has moderation privileges
    const userRole = await getUserCommunityRole(communityId, session.user.id);
    if (!hasModerationPrivileges(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get community to check existing channels
    const community = await db.collection('communities').findOne({ _id: new ObjectId(communityId) });
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    // Check if channel name already exists
    const existingChannel = community.channels?.find((c: any) => c.name.toLowerCase() === name.toLowerCase());
    if (existingChannel) {
      return NextResponse.json({ error: 'Channel name already exists' }, { status: 400 });
    }

    // Create new channel
    const newChannel = {
      _id: new ObjectId().toString(),
      name: name.trim(),
      type,
      description: description?.trim() || '',
      order: (community.channels?.length || 0),
      createdAt: new Date().toISOString()
    };

    // Add channel to community
    const result = await db.collection('communities').updateOne(
      { _id: new ObjectId(communityId) },
      { $push: { channels: newChannel } }
    );

    if (result.modifiedCount > 0) {
      return NextResponse.json({
        success: true,
        channel: newChannel
      });
    } else {
      return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error creating channel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/communities/[communityId]/channels - Get all channels for a community
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    const { communityId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToMongoDB();

    // Check if user is member of community
    const community = await db.collection('communities').findOne(
      { 
        _id: new ObjectId(communityId),
        'members.userId': session.user.id
      },
      { projection: { channels: 1 } }
    );

    if (!community) {
      return NextResponse.json({ error: 'Not a member of this community' }, { status: 403 });
    }

    return NextResponse.json({
      channels: community.channels || []
    });

  } catch (error) {
    console.error('Error fetching channels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
