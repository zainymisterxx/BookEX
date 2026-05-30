import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';

// Simple module-level rate limiter: max 10 requests per second per IP
const RATE_WINDOW_MS = 1000;
const RATE_MAX_REQUESTS = 10;
const ipTimestamps = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (ipTimestamps.get(ip) ?? []).filter(
    (ts) => now - ts < RATE_WINDOW_MS
  );
  if (timestamps.length >= RATE_MAX_REQUESTS) return true;
  timestamps.push(now);
  ipTimestamps.set(ip, timestamps);
  return false;
}

const SUGGESTION_LIMIT = 5;

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0';

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const type = searchParams.get('type') ?? 'books';

  if (!q) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const { db } = await connectToMongoDB();
    // NOTE: $regex with ^ uses the index prefix scan when an index on the field exists.
    const prefixRegex = new RegExp(`^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    let suggestions: string[] = [];

    if (type === 'users') {
      const rows = await db
        .collection('users')
        .aggregate([
          {
            $match: {
              $or: [{ username: prefixRegex }, { name: prefixRegex }],
            },
          },
          { $limit: SUGGESTION_LIMIT },
          {
            $project: {
              _id: 0,
              value: { $ifNull: ['$username', '$name'] },
            },
          },
        ])
        .toArray();
      suggestions = rows.map((r) => r.value as string).filter(Boolean);
    } else if (type === 'communities') {
      const rows = await db
        .collection('communities')
        .aggregate([
          { $match: { name: prefixRegex } },
          { $limit: SUGGESTION_LIMIT },
          { $project: { _id: 0, value: '$name' } },
        ])
        .toArray();
      suggestions = rows.map((r) => r.value as string).filter(Boolean);
    } else {
      // default: books — distinct titles starting with q
      const rows = await db
        .collection('books')
        .aggregate([
          {
            $match: {
              title: prefixRegex,
              status: 'active',
            },
          },
          { $group: { _id: '$title' } },
          { $limit: SUGGESTION_LIMIT },
          { $project: { _id: 0, value: '$_id' } },
        ])
        .toArray();
      suggestions = rows.map((r) => r.value as string).filter(Boolean);
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Suggestions error:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
