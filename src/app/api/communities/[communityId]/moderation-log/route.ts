/**
 * GET /api/communities/:communityId/moderation-log
 *
 * Returns a paginated audit trail of all admin/moderator actions taken in
 * this community (role changes, bans, post deletions, pinning, etc.).
 *
 * Authorization: moderator+ role required.
 * Query params: page (default 1), limit (default 20, max 50)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { getCommunityModerationLog } from '@/app/community-admin-actions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { communityId } = await params;
    const { searchParams } = new URL(request.url);

    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));

    const result = await getCommunityModerationLog(communityId, page, limit);

    if (!result.success) {
      const status =
        result.message === 'Unauthenticated' ? 401
        : result.message.includes('permission') || result.message.includes('Only') ? 403
        : 400;
      return NextResponse.json({ error: result.message }, { status });
    }

    return NextResponse.json({
      logs: result.logs ?? [],
      total: result.total ?? 0,
      page,
      limit,
      pages: Math.ceil((result.total ?? 0) / limit),
    });
  } catch (err) {
    console.error('GET /api/communities/[communityId]/moderation-log error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
