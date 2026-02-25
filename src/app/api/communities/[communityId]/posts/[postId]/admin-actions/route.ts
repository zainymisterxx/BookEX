/**
 * POST /api/communities/:communityId/posts/:postId/admin-actions
 *
 * Single endpoint for all admin-level post moderation:
 *   - pin / unpin
 *   - lock / unlock
 *   - delete (soft delete)
 *
 * Body: { action: 'pin' | 'unpin' | 'lock' | 'unlock' | 'delete', reason?: string }
 * Authorization: moderator+ role required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { setPinPost, setLockPost, adminDeletePost } from '@/app/community-admin-actions';
import { postAdminActionSchema } from '@/lib/schemas';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string; postId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { communityId, postId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = postAdminActionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 422 }
      );
    }

    const { action, reason } = validation.data;

    let result: { success: boolean; message: string };

    switch (action) {
      case 'pin':
        result = await setPinPost(communityId, postId, true);
        break;
      case 'unpin':
        result = await setPinPost(communityId, postId, false);
        break;
      case 'lock':
        result = await setLockPost(communityId, postId, true);
        break;
      case 'unlock':
        result = await setLockPost(communityId, postId, false);
        break;
      case 'delete':
        result = await adminDeletePost(communityId, postId, reason);
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    if (!result.success) {
      const status =
        result.message === 'Unauthenticated' ? 401
        : result.message.includes('permission') || result.message.includes('Only') ? 403
        : result.message.includes('not found') ? 404
        : result.message.includes('Rate limit') ? 429
        : 400;
      return NextResponse.json({ error: result.message }, { status });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (err) {
    console.error('POST /api/communities/[communityId]/posts/[postId]/admin-actions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
