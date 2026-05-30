import { NextRequest, NextResponse } from 'next/server';
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
      status: 'approved',
    };

    if (query && query.length >= 1) {
      baseFilter['name'] = { $regex: new RegExp(query, 'i') };
    }

    const [organizations, total] = await Promise.all([
      db.collection('organizations')
        .find(baseFilter)
        .skip(skip)
        .limit(limit)
        .project({
          _id: 1,
          name: 1,
          description: 1,
          category: 1,
          imageUrl: 1,
          memberCount: 1,
        })
        .toArray(),
      db.collection('organizations').countDocuments(baseFilter),
    ]);

    return NextResponse.json({
      organizations,
      total,
      page,
      limit,
      hasMore: skip + organizations.length < total,
    });
  } catch (error) {
    console.error('Organization search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
