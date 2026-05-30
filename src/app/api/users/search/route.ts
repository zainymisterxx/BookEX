import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { levenshteinDistance } from '@/lib/utils';

const LEVENSHTEIN_THRESHOLD = 2;
const FUZZY_CANDIDATE_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ users: [], total: 0, page: 1, limit: 20, hasMore: false });
    }

    const MAX_LIMIT = 50;
    const DEFAULT_LIMIT = 20;
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const limit = Math.min(MAX_LIMIT, Math.max(1, isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit));
    const skip = (page - 1) * limit;

    const { db } = await connectToMongoDB();

    // Create case-insensitive regex for username/name search
    const searchRegex = new RegExp(query, 'i');

    // Search users by username or name, excluding current user
    const currentUserId = typeof session.user.id === 'string' ? new ObjectId(session.user.id) : session.user.id;

    const searchFilter = {
      $and: [
        {
          $or: [
            { username: searchRegex },
            { name: searchRegex }
          ]
        },
        { _id: { $ne: currentUserId } } // Exclude current user
      ]
    };

    const [users, total] = await Promise.all([
      db.collection('users')
        .find(searchFilter)
        .skip(skip)
        .limit(limit)
        .project({
          _id: 1,
          name: 1,
          username: 1,
          avatarUrl: 1,
          image: 1
        })
        .toArray(),
      db.collection('users').countDocuments(searchFilter),
    ]);

    // Levenshtein typo-tolerance fallback: when exact $regex returns nothing and
    // the query is long enough to have meaningful typos, scan up to 100 candidates
    // and filter client-side by edit distance ≤ 2 on name or username.
    let finalUsers = users;
    let finalTotal = total;
    if (total === 0 && query.length >= 4) {
      const candidates = await db.collection('users')
        .find({ _id: { $ne: currentUserId } })
        .limit(FUZZY_CANDIDATE_LIMIT)
        .project({ _id: 1, name: 1, username: 1, avatarUrl: 1, image: 1 })
        .toArray();

      const queryLower = query.toLowerCase();
      const fuzzyMatches = candidates.filter((u) => {
        const nameDist = u.name
          ? levenshteinDistance(queryLower, (u.name as string).toLowerCase())
          : Infinity;
        const usernameDist = u.username
          ? levenshteinDistance(queryLower, (u.username as string).toLowerCase())
          : Infinity;
        return Math.min(nameDist, usernameDist) <= LEVENSHTEIN_THRESHOLD;
      });

      finalUsers = fuzzyMatches.slice(0, 10);
      finalTotal = finalUsers.length;
    }

    return NextResponse.json({
      users: finalUsers.map(user => ({
        _id: user._id,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl || user.image
      })),
      total: finalTotal,
      page,
      limit,
      hasMore: skip + finalUsers.length < finalTotal,
    });

  } catch (error) {
    console.error('User search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}