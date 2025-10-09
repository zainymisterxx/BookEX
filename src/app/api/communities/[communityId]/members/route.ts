import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/communities/[communityId]/members - Get community members with user details
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

    if (!ObjectId.isValid(communityId)) {
      return NextResponse.json({ error: 'Invalid community ID' }, { status: 400 });
    }

    const { db } = await connectToMongoDB();

    // Get community and check if user is a member
    const community = await db.collection('communities').findOne({
      _id: new ObjectId(communityId),
      'members.userId': session.user.id
    });

    if (!community) {
      return NextResponse.json({ error: 'Community not found or not a member' }, { status: 404 });
    }

    // Get member user IDs
    const memberUserIds = community.members?.map((member: any) => new ObjectId(member.userId)) || [];

    if (memberUserIds.length === 0) {
      return NextResponse.json({ members: [] });
    }

    // Fetch user details for all members
    const users = await db.collection('users').find({
      _id: { $in: memberUserIds }
    }, {
      projection: {
        _id: 1,
        name: 1,
        email: 1,
        avatarUrl: 1,
        city: 1,
        bio: 1,
        createdAt: 1
      }
    }).toArray();

    // Create a map of user details
    const userMap = new Map();
    users.forEach(user => {
      userMap.set(user._id.toString(), user);
    });

    // Combine member data with user details
    const membersWithDetails = community.members?.map((member: any) => {
      const userDetails = userMap.get(member.userId);
      return {
        ...member,
        user: userDetails ? {
          _id: userDetails._id,
          name: userDetails.name,
          email: userDetails.email,
          avatarUrl: userDetails.avatarUrl,
          city: userDetails.city,
          bio: userDetails.bio,
          createdAt: userDetails.createdAt
        } : null
      };
    }) || [];

    return NextResponse.json({
      members: membersWithDetails,
      totalCount: membersWithDetails.length
    });

  } catch (error) {
    console.error('Error fetching community members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
