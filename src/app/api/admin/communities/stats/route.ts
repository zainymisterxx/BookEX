import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';

// GET /api/admin/communities/stats - Get community statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToMongoDB();

    // Get total communities
    const totalCommunities = await db.collection('communities').countDocuments();

    // Get total members across all communities
    const communities = await db.collection('communities').find({}).toArray();
    const totalMembers = communities.reduce((sum, community) => sum + (community.memberCount || 0), 0);

    // Get active communities (with posts in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeCommunities = await db.collection('communities').countDocuments({
      _id: {
        $in: await db.collection('posts')
          .distinct('communityId', { createdAt: { $gte: thirtyDaysAgo } })
      }
    });

    // Get communities with reported content
    const reportedCommunities = await db.collection('communities').countDocuments({
      _id: {
        $in: await db.collection('posts')
          .distinct('communityId', { reported: true })
      }
    });

    return NextResponse.json({
      totalCommunities,
      totalMembers,
      activeCommunities,
      reportedCommunities
    });

  } catch (error) {
    console.error('Error fetching community stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
