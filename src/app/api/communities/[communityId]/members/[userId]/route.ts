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


// POST /api/communities/[communityId]/members/[userId] - Perform member moderation actions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string; userId: string }> }
) {
  try {
    const { communityId, userId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (!['promote', 'demote', 'ban', 'unban'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { db } = await connectToMongoDB();

    // Get community and check permissions
    const community = await db.collection('communities').findOne({ _id: new ObjectId(communityId) });
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const currentMember = community.members?.find((m: any) => m.userId === session.user.id);
    if (!currentMember) {
      return NextResponse.json({ error: 'Not a member of this community' }, { status: 403 });
    }

    const targetMember = community.members?.find((m: any) => m.userId === userId);
    if (!targetMember) {
      return NextResponse.json({ error: 'Target member not found' }, { status: 404 });
    }

    // Check permissions
    const canModerate = currentMember.role === 'admin' || currentMember.role === 'moderator';
    const isAdmin = currentMember.role === 'admin';

    if (!canModerate) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (action === 'promote' && !isAdmin) {
      return NextResponse.json({ error: 'Only admins can promote members' }, { status: 403 });
    }

    if (action === 'demote' && !isAdmin) {
      return NextResponse.json({ error: 'Only admins can demote moderators' }, { status: 403 });
    }

    // Can't moderate yourself
    if (userId === session.user.id) {
      return NextResponse.json({ error: 'Cannot moderate yourself' }, { status: 400 });
    }

    // Can't moderate other admins unless you're also an admin
    if (targetMember.role === 'admin' && !isAdmin) {
      return NextResponse.json({ error: 'Cannot moderate admins' }, { status: 403 });
    }

    let updateOperation: any;
    let updatedMember: any;

    switch (action) {
      case 'promote':
        if (targetMember.role !== 'member') {
          return NextResponse.json({ error: 'Can only promote members to moderators' }, { status: 400 });
        }
        updateOperation = {
          $set: { 'members.$.role': 'moderator' }
        };
        updatedMember = { ...targetMember, role: 'moderator' };
        break;

      case 'demote':
        if (targetMember.role !== 'moderator') {
          return NextResponse.json({ error: 'Can only demote moderators to members' }, { status: 400 });
        }
        updateOperation = {
          $set: { 'members.$.role': 'member' }
        };
        updatedMember = { ...targetMember, role: 'member' };
        break;

      case 'ban':
        if (targetMember.banned) {
          return NextResponse.json({ error: 'Member is already banned' }, { status: 400 });
        }
        updateOperation = {
          $set: { 
            'members.$.banned': true,
            'members.$.banReason': 'Banned by moderator',
            'members.$.bannedAt': new Date().toISOString()
          }
        };
        updatedMember = { 
          ...targetMember, 
          banned: true, 
          banReason: 'Banned by moderator',
          bannedAt: new Date().toISOString()
        };
        break;

      case 'unban':
        if (!targetMember.banned) {
          return NextResponse.json({ error: 'Member is not banned' }, { status: 400 });
        }
        updateOperation = {
          $unset: { 
            'members.$.banned': '',
            'members.$.banReason': '',
            'members.$.bannedAt': ''
          }
        };
        updatedMember = { 
          ...targetMember, 
          banned: false,
          banReason: undefined,
          bannedAt: undefined
        };
        break;
    }

    const result = await db.collection('communities').updateOne(
      { 
        _id: new ObjectId(communityId),
        'members.userId': userId
      },
      updateOperation
    );

    if (result.modifiedCount > 0) {
      return NextResponse.json({
        success: true,
        message: `Successfully ${action}d member`,
        updatedMember
      });
    } else {
      return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error performing member action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
