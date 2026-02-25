/**
 * GET  /api/communities/:communityId/join-requests  — list pending requests
 * POST /api/communities/:communityId/join-requests  — submit a join request
 *
 * GET requires moderator+ role.
 * POST is open to any authenticated user for private communities.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { getPendingJoinRequests, requestToJoinCommunity } from '@/app/community-admin-actions';
import { z } from 'zod';

const joinRequestBodySchema = z.object({
  message: z.string().max(500).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { communityId } = await params;
    const result = await getPendingJoinRequests(communityId);

    if (!result.success) {
      const status =
        result.message === 'Unauthenticated' ? 401
        : result.message.includes('permission') ? 403
        : 400;
      return NextResponse.json({ error: result.message }, { status });
    }

    return NextResponse.json({ requests: result.requests ?? [], total: result.requests?.length ?? 0 });
  } catch (err) {
    console.error('GET /api/communities/[communityId]/join-requests error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { communityId } = await params;

    let body: unknown = {};
    try {
      body = await request.json();
    } catch { /* body is optional */ }

    const validation = joinRequestBodySchema.safeParse(body);
    const message = validation.success ? validation.data.message : undefined;

    const result = await requestToJoinCommunity(communityId, message);

    if (!result.success) {
      const status =
        result.message === 'Unauthenticated' ? 401
        : result.message.includes('already') ? 409
        : 400;
      return NextResponse.json({ error: result.message }, { status });
    }

    return NextResponse.json({ success: true, message: result.message }, { status: 201 });
  } catch (err) {
    console.error('POST /api/communities/[communityId]/join-requests error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
