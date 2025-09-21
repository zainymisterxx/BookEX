import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface Community {
  _id: ObjectId;
  name: string;
  description: string;
  createdAt: Date;
  memberCount: number;
  reportedPosts?: number;
}

// GET /api/admin/communities - Get all communities with stats
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all';

    const { db } = await connectToMongoDB();

    // Build query
    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (filter === 'reported') {
      query.reportedPosts = { $gt: 0 };
    }

    // Get communities with pagination
    const communities = await db.collection('communities')
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Get total count
    const total = await db.collection('communities').countDocuments(query);

    // Enrich communities with additional data
    const enrichedCommunities = await Promise.all(
      communities.map(async (community) => {
        const communityData = community as Community;

        const postsCount = await db.collection('posts').countDocuments({
          communityId: community._id
        });

        const reportedPosts = await db.collection('posts').countDocuments({
          communityId: community._id,
          reported: true
        });

        const recentActivity = await db.collection('posts')
          .find({ communityId: community._id })
          .sort({ createdAt: -1 })
          .limit(1)
          .toArray();

        return {
          ...communityData,
          postsCount,
          reportedPosts,
          recentActivity: recentActivity[0]?.createdAt || communityData.createdAt
        };
      })
    );

    return NextResponse.json({
      communities: enrichedCommunities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching communities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
