/**
 * PATCH /api/communities/:communityId/join-requests/:requestUserId
 *
 * Approve or reject a pending join request.
 * Body: { action: 'approve' | 'reject', reason?: string }
 *
 * Authorization: moderator+ role required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { approveJoinRequest, rejectJoinRequest } from '@/app/community-admin-actions';
import { joinRequestActionSchema } from '@/lib/schemas';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string; requestUserId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { communityId, requestUserId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = joinRequestActionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 422 }
      );
    }

    const { action, reason } = validation.data;

    const result =
      action === 'approve'
        ? await approveJoinRequest(communityId, requestUserId)
        : await rejectJoinRequest(communityId, requestUserId, reason);

    if (!result.success) {
      const status =
        result.message === 'Unauthenticated' ? 401
        : result.message.includes('permission') || result.message.includes('Only') ? 403
        : result.message === 'No pending request found' ? 404
        : result.message.includes('Rate limit') ? 429
        : 400;
      return NextResponse.json({ error: result.message }, { status });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (err) {
    console.error('PATCH /api/communities/[communityId]/join-requests/[requestUserId] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
