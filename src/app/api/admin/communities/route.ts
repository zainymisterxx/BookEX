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
    const sort: any = filter === 'high_moderation' ? { reportedPosts: -1 } : { createdAt: -1 };
    const communities = await db.collection('communities')
      .find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Get total count
    const total = await db.collection('communities').countDocuments(query);

    // Enrich communities with additional data
    const enrichedCommunities = await Promise.all(
      communities.map(async (community) => {
        const communityData = community as Community;

        const postsCount = await db.collection('posts').countDocuments({ communityId: community._id });

        const reportedPosts = await db.collection('posts').countDocuments({ communityId: community._id, reported: true });

        const members = (community as any).members || [];
        const roleDistribution = members.reduce((acc: any, m: any) => {
          const role = m?.role || 'member';
          acc[role] = (acc[role] || 0) + 1;
          if (m?.banned) acc.banned = (acc.banned || 0) + 1;
          return acc;
        }, { admin: 0, moderator: 0, member: 0, banned: 0 });

        const recentActivity = await db.collection('posts')
          .find({ communityId: community._id })
          .sort({ createdAt: -1 })
          .limit(1)
          .toArray();

        // Get channel information
        const channels = (community as any).channels || [];
        const forumChannels = channels.filter((c: any) => c.type === 'forum').length;
        const chatChannels = channels.filter((c: any) => c.type === 'chat').length;

        // Get recent chat messages count
        const recentChatMessages = await db.collection('chatMessages')
          .countDocuments({ 
            channelId: { $in: channels.map((c: any) => c._id) },
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
          });

        return {
          ...communityData,
          postsCount,
          reportedPosts,
          roleDistribution,
          recentActivity: recentActivity[0]?.createdAt || communityData.createdAt,
          channelsInfo: {
            total: channels.length,
            forum: forumChannels,
            chat: chatChannels
          },
          recentChatMessages
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
