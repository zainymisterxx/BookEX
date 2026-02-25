/**
 * POST /api/communities/:communityId/transfer-ownership
 *
 * Transfers community ownership to another member.
 * Requires the caller to be the current owner (creator role).
 * Requires typing the community name as a confirmation safeguard.
 *
 * Body: { newOwnerId: string, confirmName: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { transferCommunityOwnership } from '@/app/community-admin-actions';
import { transferOwnershipSchema } from '@/lib/schemas';

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = transferOwnershipSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 422 }
      );
    }

    const result = await transferCommunityOwnership(communityId, validation.data);

    if (!result.success) {
      const status =
        result.message === 'Unauthenticated' ? 401
        : result.message.includes('Only the community owner') ? 403
        : result.message.includes('not a member') || result.message === 'Community not found' ? 404
        : result.message.includes('Rate limit') ? 429
        : 400;
      return NextResponse.json({ error: result.message }, { status });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (err) {
    console.error('POST /api/communities/[communityId]/transfer-ownership error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
