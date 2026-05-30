import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const limit = Math.min(MAX_LIMIT, Math.max(1, isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit));
    const skip = (page - 1) * limit;

    const { db } = await connectToMongoDB();

    const baseFilter: Record<string, unknown> = {
      $or: [
        { visibility: 'public' },
        { deletedAt: { $exists: false } },
      ],
    };

    if (query && query.length >= 1) {
      baseFilter['name'] = { $regex: new RegExp(query, 'i') };
    }

    const [communities, total] = await Promise.all([
      db.collection('communities')
        .find(baseFilter)
        .skip(skip)
        .limit(limit)
        .project({
          _id: 1,
          name: 1,
          description: 1,
          memberCount: 1,
          imageUrl: 1,
          visibility: 1,
        })
        .toArray(),
      db.collection('communities').countDocuments(baseFilter),
    ]);

    return NextResponse.json({
      communities,
      total,
      page,
      limit,
      hasMore: skip + communities.length < total,
    });
  } catch (error) {
    console.error('Community search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
