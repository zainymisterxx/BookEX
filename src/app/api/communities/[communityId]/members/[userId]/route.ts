import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import {
  promoteMember,
  demoteMember,
  removeMemberFromCommunity,
  banMemberFromCommunity,
  unbanMemberFromCommunity,
} from '@/app/community-admin-actions';

/**
 * POST /api/communities/:communityId/members/:userId
 *
 * Unified member moderation endpoint. All business logic, permission checks,
 * rate limiting and audit logging are delegated to the server action layer.
 *
 * Body: { action: 'promote' | 'demote' | 'remove' | 'ban' | 'unban', reason?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string; userId: string }> }
) {
  try {
    const { communityId, userId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { action, reason } = (body as any) ?? {};

    if (!['promote', 'demote', 'remove', 'ban', 'unban'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be promote | demote | remove | ban | unban' }, { status: 400 });
    }

    let result: { success: boolean; message: string; newRole?: string };

    switch (action) {
      case 'promote':
        result = await promoteMember(communityId, userId);
        break;
      case 'demote':
        result = await demoteMember(communityId, userId);
        break;
      case 'remove':
        result = await removeMemberFromCommunity(communityId, userId, reason);
        break;
      case 'ban':
        result = await banMemberFromCommunity(communityId, { targetUserId: userId, reason: reason ?? 'Banned by moderator' });
        break;
      case 'unban':
        result = await unbanMemberFromCommunity(communityId, userId);
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    if (!result.success) {
      const status =
        result.message === 'Unauthenticated' ? 401
        : result.message.includes('permission') || result.message.includes('Only') || result.message.includes('Cannot') ? 403
        : result.message.includes('not a member') || result.message.includes('not found') ? 404
        : result.message.includes('Rate limit') ? 429
        : 400;
      return NextResponse.json({ error: result.message }, { status });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      ...(result.newRole ? { newRole: result.newRole } : {}),
    });
  } catch (error) {
    console.error('Error performing member action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
