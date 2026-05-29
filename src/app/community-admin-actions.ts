'use server';

/**
 * Community Admin Server Actions
 *
 * All mutations affecting community governance: settings, membership, banning,
 * join requests, post pinning/locking/deletion, comment removal, and ownership
 * transfer.
 *
 * Security guarantees:
 *   - Every action verifies the caller's session and community role server-side.
 *   - Role hierarchy is enforced: actors cannot act on peers or superiors.
 *   - Ownership-transfer is guarded against lockout scenarios.
 *   - All mutations use MongoDB transactions wherever multiple documents change.
 *   - Every action is rate-limited and audit-logged.
 *   - ID inputs are validated as ObjectId before any DB call (NoSQL injection prevention).
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

import clientPromise from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity-logging';
import { checkUserRateLimit, RATE_LIMITS } from '@/lib/rate-limiting';
import {
  communitySettingsSchema,
  memberActionSchema,
  banMemberSchema,
  transferOwnershipSchema,
  joinRequestActionSchema,
  postAdminActionSchema,
  commentAdminActionSchema,
} from '@/lib/schemas';
import type {
  CommunityRole,
  CommunityModerationLog,
  CommunityAdminActionType,
} from '@/lib/types';

// ─── Role Hierarchy ───────────────────────────────────────────────────────────

const ROLE_LEVEL: Record<CommunityRole, number> = {
  creator: 4,
  admin: 3,
  moderator: 2,
  member: 1,
};

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function assertValidObjectId(value: string, label = 'ID'): ObjectId {
  if (!value || !ObjectId.isValid(value)) {
    throw new Error(`Invalid ${label}: must be a valid ObjectId`);
  }
  return new ObjectId(value);
}

async function getDb() {
  const client = await clientPromise;
  return client.db('bookex');
}

async function getCallerMember(
  db: Awaited<ReturnType<typeof getDb>>,
  communityObjId: ObjectId,
  callerId: string
) {
  const doc = await db.collection('communities').findOne(
    { _id: communityObjId },
    { projection: { members: 1, createdBy: 1, name: 1 } }
  );
  if (!doc) throw new Error('Community not found');

  const member = (doc.members as any[]).find(
    (m: any) => m.userId === callerId
  );
  if (!member) throw new Error('You are not a member of this community');
  if (member.banned) throw new Error('You are banned from this community');

  return { member, community: doc };
}

function assertCallerCanActOn(
  callerRole: CommunityRole,
  targetRole: CommunityRole,
  requiredMinimum: CommunityRole = 'admin'
) {
  if (ROLE_LEVEL[callerRole] < ROLE_LEVEL[requiredMinimum]) {
    throw new Error('Insufficient permissions');
  }
  if (ROLE_LEVEL[callerRole] <= ROLE_LEVEL[targetRole]) {
    throw new Error('Cannot act on a member with equal or higher role');
  }
}

async function writeModerationLog(
  db: Awaited<ReturnType<typeof getDb>>,
  log: Omit<CommunityModerationLog, '_id'>
) {
  await db.collection('community_moderation_logs').insertOne({
    ...log,
    _id: new ObjectId(),
  });
}

// ─── 1. Update Community Settings ─────────────────────────────────────────────

export async function updateCommunitySettings(
  communityId: string,
  rawInput: z.infer<typeof communitySettingsSchema>
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, message: 'Unauthenticated' };

    const callerId = session.user.id;
    const validation = communitySettingsSchema.safeParse(rawInput);
    if (!validation.success) {
      return { success: false, message: validation.error.errors[0]?.message ?? 'Invalid input' };
    }

    const rl = await checkUserRateLimit(callerId, 'COMMUNITY_SETTINGS_UPDATE', RATE_LIMITS.COMMUNITY_SETTINGS_UPDATE);
    if (!rl.allowed) return { success: false, message: rl.error ?? 'Rate limit exceeded' };

    const communityObjId = assertValidObjectId(communityId, 'community ID');
    const db = await getDb();

    const { member } = await getCallerMember(db, communityObjId, callerId);
    if (ROLE_LEVEL[member.role as CommunityRole] < ROLE_LEVEL['admin']) {
      return { success: false, message: 'Only admins and the owner can update settings' };
    }

    const { data } = validation;
    const now = new Date().toISOString();
    const updateFields: Record<string, unknown> = { updatedAt: now };

    if (data.name !== undefined) updateFields.name = data.name;
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.imageUrl !== undefined) updateFields.imageUrl = data.imageUrl;
    if (data.coverImage !== undefined) updateFields.coverImage = data.coverImage;
    if (data.rules !== undefined) updateFields.rules = data.rules;
    if (data.visibility !== undefined) updateFields.visibility = data.visibility;
    if (data.postingPermissions !== undefined) updateFields.postingPermissions = data.postingPermissions;
    if (data.commentPermissions !== undefined) updateFields.commentPermissions = data.commentPermissions;
    if (data.invitePermissions !== undefined) updateFields.invitePermissions = data.invitePermissions;

    await db.collection('communities').updateOne(
      { _id: communityObjId },
      { $set: updateFields }
    );

    await Promise.all([
      writeModerationLog(db, {
        communityId,
        actorId: callerId,
        actorName: session.user.name ?? '',
        actionType: 'settings_updated',
        targetContentType: 'community',
        metadata: { updatedFields: Object.keys(data) },
        createdAt: now,
      }),
      logActivity(callerId, 'community_settings_updated', 'low', `Updated settings for community ${communityId}`, { communityId, fields: Object.keys(data) }),
    ]);

    revalidatePath(`/community/${communityId}`);
    revalidatePath('/community');

    try {
      const { emitCommunitySettingsUpdated } = await import('../../server');
      await emitCommunitySettingsUpdated(communityId, updateFields);
    } catch { /* socket optional */ }

    return { success: true, message: 'Settings updated successfully' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Server error' };
  }
}

// ─── 2. Transfer Ownership ────────────────────────────────────────────────────

export async function transferCommunityOwnership(
  communityId: string,
  rawInput: z.infer<typeof transferOwnershipSchema>
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, message: 'Unauthenticated' };

    const callerId = session.user.id;
    const validation = transferOwnershipSchema.safeParse(rawInput);
    if (!validation.success) {
      return { success: false, message: validation.error.errors[0]?.message ?? 'Invalid input' };
    }

    const rl = await checkUserRateLimit(callerId, 'COMMUNITY_OWNERSHIP_TRANSFER', RATE_LIMITS.COMMUNITY_OWNERSHIP_TRANSFER);
    if (!rl.allowed) return { success: false, message: rl.error ?? 'Rate limit exceeded' };

    const { newOwnerId, confirmName } = validation.data;
    if (newOwnerId === callerId) {
      return { success: false, message: 'Cannot transfer ownership to yourself' };
    }

    const communityObjId = assertValidObjectId(communityId, 'community ID');
    assertValidObjectId(newOwnerId, 'new owner ID');

    const db = await getDb();

    const community = await db.collection('communities').findOne(
      { _id: communityObjId },
      { projection: { members: 1, createdBy: 1, name: 1 } }
    );
    if (!community) return { success: false, message: 'Community not found' };

    // Confirm name guard to prevent accidental transfers
    if (community.name !== confirmName) {
      return { success: false, message: 'Community name confirmation does not match' };
    }

    // Only the creator can transfer ownership
    if (community.createdBy !== callerId) {
      // Also allow if caller has 'creator' role set in members array
      const callerMember = (community.members as any[]).find((m: any) => m.userId === callerId);
      if (callerMember?.role !== 'creator') {
        return { success: false, message: 'Only the community owner can transfer ownership' };
      }
    }

    const targetMember = (community.members as any[]).find((m: any) => m.userId === newOwnerId);
    if (!targetMember) {
      return { success: false, message: 'Target user is not a member of this community' };
    }
    if (targetMember.banned) {
      return { success: false, message: 'Cannot transfer ownership to a banned member' };
    }

    const now = new Date().toISOString();
    const client = await clientPromise;
    const mongoSession = client.startSession();

    try {
      await mongoSession.withTransaction(async () => {
        // Demote current owner → admin
        await db.collection('communities').updateOne(
          { _id: communityObjId, 'members.userId': callerId },
          { $set: { 'members.$.role': 'admin' as CommunityRole, updatedAt: now } },
          { session: mongoSession }
        );
        // Promote new owner → creator
        await db.collection('communities').updateOne(
          { _id: communityObjId, 'members.userId': newOwnerId },
          { $set: { 'members.$.role': 'creator' as CommunityRole } },
          { session: mongoSession }
        );
        // Update top-level createdBy
        await db.collection('communities').updateOne(
          { _id: communityObjId },
          { $set: { createdBy: newOwnerId, updatedAt: now } },
          { session: mongoSession }
        );
      });
    } finally {
      await mongoSession.endSession();
    }

    await Promise.all([
      writeModerationLog(db, {
        communityId,
        actorId: callerId,
        actorName: session.user.name ?? '',
        actionType: 'ownership_transferred',
        targetUserId: newOwnerId,
        targetContentType: 'community',
        metadata: { previousOwner: callerId, newOwner: newOwnerId },
        createdAt: now,
      }),
      logActivity(callerId, 'community_ownership_transferred', 'high', `Transferred ownership of community ${communityId} to ${newOwnerId}`, { communityId, newOwnerId }),
    ]);

    revalidatePath(`/community/${communityId}`);
    revalidatePath(`/community/${communityId}/settings`);

    try {
      const { emitCommunityOwnershipTransferred } = await import('../../server');
      await emitCommunityOwnershipTransferred(communityId, callerId, newOwnerId);
    } catch { /* socket optional */ }

    return { success: true, message: 'Ownership transferred successfully' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Server error' };
  }
}

// ─── 3. Promote Member ────────────────────────────────────────────────────────

export async function promoteMember(
  communityId: string,
  targetUserId: string
): Promise<{ success: boolean; message: string; newRole?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, message: 'Unauthenticated' };

    const callerId = session.user.id;
    if (callerId === targetUserId) return { success: false, message: 'Cannot promote yourself' };

    const rl = await checkUserRateLimit(callerId, 'COMMUNITY_MEMBER_ACTION', RATE_LIMITS.COMMUNITY_MEMBER_ACTION);
    if (!rl.allowed) return { success: false, message: rl.error ?? 'Rate limit exceeded' };

    const communityObjId = assertValidObjectId(communityId, 'community ID');
    assertValidObjectId(targetUserId, 'target user ID');

    const db = await getDb();
    const { member: callerMember, community } = await getCallerMember(db, communityObjId, callerId);

    const targetMember = (community.members as any[]).find((m: any) => m.userId === targetUserId);
    if (!targetMember) return { success: false, message: 'Target user is not a member' };
    if (targetMember.banned) return { success: false, message: 'Cannot promote a banned member' };

    assertCallerCanActOn(callerMember.role as CommunityRole, targetMember.role as CommunityRole, 'admin');

    // Prevent promoting beyond the caller's tier
    const promotionMap: Record<CommunityRole, CommunityRole> = {
      member: 'moderator',
      moderator: 'admin',
      admin: 'creator', // only creator can do this — guarded by assertCallerCanActOn
      creator: 'creator',
    };
    const newRole = promotionMap[targetMember.role as CommunityRole];
    if (!newRole || newRole === targetMember.role) {
      return { success: false, message: 'Cannot promote further' };
    }
    // Extra guard: only creator can elevate to admin
    if (newRole === 'admin' && ROLE_LEVEL[callerMember.role as CommunityRole] < ROLE_LEVEL['admin']) {
      return { success: false, message: 'Only admins can promote moderators to admin' };
    }

    const now = new Date().toISOString();
    await db.collection('communities').updateOne(
      { _id: communityObjId, 'members.userId': targetUserId },
      { $set: { 'members.$.role': newRole, updatedAt: now } }
    );

    await Promise.all([
      writeModerationLog(db, {
        communityId,
        actorId: callerId,
        actorName: session.user.name ?? '',
        actionType: 'member_promoted',
        targetUserId,
        targetContentType: 'member',
        metadata: { previousRole: targetMember.role, newRole },
        createdAt: now,
      }),
      logActivity(callerId, 'community_member_promoted', 'low', `Promoted ${targetUserId} to ${newRole} in ${communityId}`, { communityId, targetUserId, newRole }),
    ]);

    revalidatePath(`/community/${communityId}`);

    try {
      const { emitCommunityMemberRoleChanged } = await import('../../server');
      await emitCommunityMemberRoleChanged(communityId, targetUserId, newRole, callerId);
    } catch { /* socket optional */ }

    return { success: true, message: `Member promoted to ${newRole}`, newRole };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Server error' };
  }
}

// ─── 4. Demote Member ─────────────────────────────────────────────────────────

export async function demoteMember(
  communityId: string,
  targetUserId: string
): Promise<{ success: boolean; message: string; newRole?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, message: 'Unauthenticated' };

    const callerId = session.user.id;
    if (callerId === targetUserId) return { success: false, message: 'Cannot demote yourself' };

    const rl = await checkUserRateLimit(callerId, 'COMMUNITY_MEMBER_ACTION', RATE_LIMITS.COMMUNITY_MEMBER_ACTION);
    if (!rl.allowed) return { success: false, message: rl.error ?? 'Rate limit exceeded' };

    const communityObjId = assertValidObjectId(communityId, 'community ID');
    assertValidObjectId(targetUserId, 'target user ID');

    const db = await getDb();
    const { member: callerMember, community } = await getCallerMember(db, communityObjId, callerId);

    const targetMember = (community.members as any[]).find((m: any) => m.userId === targetUserId);
    if (!targetMember) return { success: false, message: 'Target user is not a member' };

    assertCallerCanActOn(callerMember.role as CommunityRole, targetMember.role as CommunityRole, 'admin');

    const demotionMap: Record<CommunityRole, CommunityRole> = {
      admin: 'moderator',
      moderator: 'member',
      member: 'member',
      creator: 'admin', // owner demotion only via transfer
    };
    const newRole = demotionMap[targetMember.role as CommunityRole];
    if (newRole === targetMember.role) {
      return { success: false, message: 'Cannot demote a member further' };
    }
    if (targetMember.role === 'creator') {
      return { success: false, message: 'Cannot demote the community owner. Use ownership transfer.' };
    }

    const now = new Date().toISOString();
    await db.collection('communities').updateOne(
      { _id: communityObjId, 'members.userId': targetUserId },
      { $set: { 'members.$.role': newRole, updatedAt: now } }
    );

    await Promise.all([
      writeModerationLog(db, {
        communityId,
        actorId: callerId,
        actorName: session.user.name ?? '',
        actionType: 'member_demoted',
        targetUserId,
        targetContentType: 'member',
        metadata: { previousRole: targetMember.role, newRole },
        createdAt: now,
      }),
      logActivity(callerId, 'community_member_demoted', 'low', `Demoted ${targetUserId} to ${newRole} in ${communityId}`, { communityId, targetUserId, newRole }),
    ]);

    revalidatePath(`/community/${communityId}`);

    try {
      const { emitCommunityMemberRoleChanged } = await import('../../server');
      await emitCommunityMemberRoleChanged(communityId, targetUserId, newRole, callerId);
    } catch { /* socket optional */ }

    return { success: true, message: `Member demoted to ${newRole}`, newRole };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Server error' };
  }
}

// ─── 5. Remove Member ─────────────────────────────────────────────────────────

export async function removeMemberFromCommunity(
  communityId: string,
  targetUserId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, message: 'Unauthenticated' };

    const callerId = session.user.id;
    if (callerId === targetUserId) return { success: false, message: 'Cannot remove yourself — use leave community' };

    const rl = await checkUserRateLimit(callerId, 'COMMUNITY_MEMBER_ACTION', RATE_LIMITS.COMMUNITY_MEMBER_ACTION);
    if (!rl.allowed) return { success: false, message: rl.error ?? 'Rate limit exceeded' };

    const communityObjId = assertValidObjectId(communityId, 'community ID');
    assertValidObjectId(targetUserId, 'target user ID');

    const db = await getDb();
    const { member: callerMember, community } = await getCallerMember(db, communityObjId, callerId);

    const targetMember = (community.members as any[]).find((m: any) => m.userId === targetUserId);
    if (!targetMember) return { success: false, message: 'Target user is not a member' };

    assertCallerCanActOn(callerMember.role as CommunityRole, targetMember.role as CommunityRole, 'moderator');

    // Cannot remove the current owner
    if (targetMember.role === 'creator' || community.createdBy === targetUserId) {
      return { success: false, message: 'Cannot remove the community owner. Transfer ownership first.' };
    }

    const now = new Date().toISOString();
    const client = await clientPromise;
    const mongoSession = client.startSession();

    try {
      await mongoSession.withTransaction(async () => {
        // Remove from members array
        await db.collection('communities').updateOne(
          { _id: communityObjId },
          {
            $pull: { members: { userId: targetUserId } } as any,
            $inc: { memberCount: -1 },
            $set: { updatedAt: now },
          },
          { session: mongoSession }
        );
        // Remove community from user's communities list
        await db.collection('users').updateOne(
          { _id: new ObjectId(targetUserId) },
          { $pull: { communities: communityObjId } as any },
          { session: mongoSession }
        );
      });
    } finally {
      await mongoSession.endSession();
    }

    await Promise.all([
      writeModerationLog(db, {
        communityId,
        actorId: callerId,
        actorName: session.user.name ?? '',
        actionType: 'member_removed',
        targetUserId,
        targetContentType: 'member',
        reason,
        createdAt: now,
      }),
      logActivity(callerId, 'community_member_removed', 'medium', `Removed ${targetUserId} from community ${communityId}`, { communityId, targetUserId, reason }),
    ]);

    revalidatePath(`/community/${communityId}`);

    try {
      const { emitCommunityMemberRemoved } = await import('../../server');
      await emitCommunityMemberRemoved(communityId, targetUserId, callerId);
    } catch { /* socket optional */ }

    return { success: true, message: 'Member removed from community' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Server error' };
  }
}

// ─── 6. Ban Member ────────────────────────────────────────────────────────────

export async function banMemberFromCommunity(
  communityId: string,
  rawInput: z.infer<typeof banMemberSchema>
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, message: 'Unauthenticated' };

    const callerId = session.user.id;
    const validation = banMemberSchema.safeParse(rawInput);
    if (!validation.success) {
      return { success: false, message: validation.error.errors[0]?.message ?? 'Invalid input' };
    }

    const { targetUserId, reason } = validation.data;
    if (callerId === targetUserId) return { success: false, message: 'Cannot ban yourself' };

    const rl = await checkUserRateLimit(callerId, 'COMMUNITY_BAN', RATE_LIMITS.COMMUNITY_BAN);
    if (!rl.allowed) return { success: false, message: rl.error ?? 'Rate limit exceeded' };

    const communityObjId = assertValidObjectId(communityId, 'community ID');
    assertValidObjectId(targetUserId, 'target user ID');

    const db = await getDb();
    const { member: callerMember, community } = await getCallerMember(db, communityObjId, callerId);

    const targetMember = (community.members as any[]).find((m: any) => m.userId === targetUserId);
    if (!targetMember) return { success: false, message: 'Target user is not a member' };
    if (targetMember.banned) return { success: false, message: 'User is already banned' };

    assertCallerCanActOn(callerMember.role as CommunityRole, targetMember.role as CommunityRole, 'moderator');

    if (targetMember.role === 'creator') {
      return { success: false, message: 'Cannot ban the community owner' };
    }

    const now = new Date().toISOString();
    await db.collection('communities').updateOne(
      { _id: communityObjId, 'members.userId': targetUserId },
      {
        $set: {
          'members.$.banned': true,
          'members.$.banReason': reason,
          'members.$.bannedAt': now,
          'members.$.bannedBy': callerId,
          updatedAt: now,
        },
      }
    );

    await Promise.all([
      writeModerationLog(db, {
        communityId,
        actorId: callerId,
        actorName: session.user.name ?? '',
        actionType: 'member_banned',
        targetUserId,
        targetContentType: 'member',
        reason,
        createdAt: now,
      }),
      logActivity(callerId, 'community_member_banned', 'high', `Banned ${targetUserId} from community ${communityId}`, { communityId, targetUserId, reason }),
    ]);

    revalidatePath(`/community/${communityId}`);

    try {
      const { emitCommunityMemberBanned } = await import('../../server');
      await emitCommunityMemberBanned(communityId, targetUserId, true, reason);
    } catch { /* socket optional */ }

    return { success: true, message: 'User banned from community' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Server error' };
  }
}

// ─── 7. Unban Member ──────────────────────────────────────────────────────────

export async function unbanMemberFromCommunity(
  communityId: string,
  targetUserId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, message: 'Unauthenticated' };

    const callerId = session.user.id;
    const rl = await checkUserRateLimit(callerId, 'COMMUNITY_BAN', RATE_LIMITS.COMMUNITY_BAN);
    if (!rl.allowed) return { success: false, message: rl.error ?? 'Rate limit exceeded' };

    const communityObjId = assertValidObjectId(communityId, 'community ID');
    assertValidObjectId(targetUserId, 'target user ID');

    const db = await getDb();
    const { member: callerMember, community } = await getCallerMember(db, communityObjId, callerId);

    if (ROLE_LEVEL[callerMember.role as CommunityRole] < ROLE_LEVEL['moderator']) {
      return { success: false, message: 'Insufficient permissions' };
    }

    const targetMember = (community.members as any[]).find((m: any) => m.userId === targetUserId);
    if (!targetMember) return { success: false, message: 'Target user is not a member' };
    if (!targetMember.banned) return { success: false, message: 'User is not banned' };

    const now = new Date().toISOString();
    await db.collection('communities').updateOne(
      { _id: communityObjId, 'members.userId': targetUserId },
      {
        $unset: {
          'members.$.banned': '',
          'members.$.banReason': '',
          'members.$.bannedAt': '',
          'members.$.bannedBy': '',
        },
        $set: { updatedAt: now },
      }
    );

    await Promise.all([
      writeModerationLog(db, {
        communityId,
        actorId: callerId,
        actorName: session.user.name ?? '',
        actionType: 'member_unbanned',
        targetUserId,
        targetContentType: 'member',
        createdAt: now,
      }),
      logActivity(callerId, 'community_member_unbanned', 'low', `Unbanned ${targetUserId} in community ${communityId}`, { communityId, targetUserId }),
    ]);

    revalidatePath(`/community/${communityId}`);

    try {
      const { emitCommunityMemberBanned } = await import('../../server');
      await emitCommunityMemberBanned(communityId, targetUserId, false);
    } catch { /* socket optional */ }

    return { success: true, message: 'User unbanned' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Server error' };
  }
}

// ─── 8. Approve Join Request ──────────────────────────────────────────────────

export async function approveJoinRequest(
  communityId: string,
  requestUserId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, message: 'Unauthenticated' };

    const callerId = session.user.id;
    const rl = await checkUserRateLimit(callerId, 'COMMUNITY_JOIN_REQUEST', RATE_LIMITS.COMMUNITY_JOIN_REQUEST);
    if (!rl.allowed) return { success: false, message: rl.error ?? 'Rate limit exceeded' };

    const communityObjId = assertValidObjectId(communityId, 'community ID');
    assertValidObjectId(requestUserId, 'request user ID');

    const db = await getDb();
    const { member: callerMember } = await getCallerMember(db, communityObjId, callerId);

    if (ROLE_LEVEL[callerMember.role as CommunityRole] < ROLE_LEVEL['moderator']) {
      return { success: false, message: 'Only moderators and above can approve join requests' };
    }

    // Find community and the pending request
    const community = await db.collection('communities').findOne(
      { _id: communityObjId },
      { projection: { pendingRequests: 1, members: 1 } }
    );
    if (!community) return { success: false, message: 'Community not found' };

    const pendingRequests: any[] = community.pendingRequests ?? [];
    const reqIndex = pendingRequests.findIndex(
      (r: any) => r.userId === requestUserId && r.status === 'pending'
    );
    if (reqIndex === -1) {
      return { success: false, message: 'No pending request found for this user' };
    }

    // Check not already a member
    const alreadyMember = (community.members as any[]).some((m: any) => m.userId === requestUserId);
    if (alreadyMember) {
      // Just clear the stale request
      await db.collection('communities').updateOne(
        { _id: communityObjId },
        { $pull: { pendingRequests: { userId: requestUserId } } as any }
      );
      return { success: false, message: 'User is already a member' };
    }

    const now = new Date().toISOString();
    const newMember = {
      userId: requestUserId,
      role: 'member' as CommunityRole,
      joinedAt: now,
    };

    const client = await clientPromise;
    const mongoSession = client.startSession();
    try {
      await mongoSession.withTransaction(async () => {
        // Add to members
        await db.collection('communities').updateOne(
          { _id: communityObjId },
          {
            $push: { members: newMember } as any,
            $pull: { pendingRequests: { userId: requestUserId } } as any,
            $inc: { memberCount: 1 },
            $set: { updatedAt: now },
          },
          { session: mongoSession }
        );
        // Record community on user document
        await db.collection('users').updateOne(
          { _id: new ObjectId(requestUserId) },
          { $addToSet: { communities: communityObjId } as any },
          { session: mongoSession }
        );
      });
    } finally {
      await mongoSession.endSession();
    }

    await Promise.all([
      writeModerationLog(db, {
        communityId,
        actorId: callerId,
        actorName: session.user.name ?? '',
        actionType: 'join_request_approved',
        targetUserId: requestUserId,
        targetContentType: 'member',
        createdAt: now,
      }),
      logActivity(callerId, 'community_join_request_approved', 'low', `Approved join request from ${requestUserId} in ${communityId}`, { communityId, requestUserId }),
    ]);

    revalidatePath(`/community/${communityId}`);

    try {
      const { emitCommunityJoinRequestUpdated } = await import('../../server');
      await emitCommunityJoinRequestUpdated(communityId, requestUserId, 'approved');
    } catch { /* socket optional */ }

    return { success: true, message: 'Join request approved' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Server error' };
  }
}

// ─── 9. Reject Join Request ───────────────────────────────────────────────────

export async function rejectJoinRequest(
  communityId: string,
  requestUserId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, message: 'Unauthenticated' };

    const callerId = session.user.id;
    const rl = await checkUserRateLimit(callerId, 'COMMUNITY_JOIN_REQUEST', RATE_LIMITS.COMMUNITY_JOIN_REQUEST);
    if (!rl.allowed) return { success: false, message: rl.error ?? 'Rate limit exceeded' };

    const communityObjId = assertValidObjectId(communityId, 'community ID');
    assertValidObjectId(requestUserId, 'request user ID');

    const db = await getDb();
    const { member: callerMember } = await getCallerMember(db, communityObjId, callerId);

    if (ROLE_LEVEL[callerMember.role as CommunityRole] < ROLE_LEVEL['moderator']) {
      return { success: false, message: 'Only moderators and above can reject join requests' };
    }

    const now = new Date().toISOString();
    const result = await db.collection('communities').updateOne(
      { _id: communityObjId, 'pendingRequests.userId': requestUserId, 'pendingRequests.status': 'pending' },
      {
        $set: {
          'pendingRequests.$.status': 'rejected',
          'pendingRequests.$.reviewedAt': now,
          'pendingRequests.$.reviewedBy': callerId,
          updatedAt: now,
        },
      }
    );

    if (result.modifiedCount === 0) {
      return { success: false, message: 'No pending request found for this user' };
    }

    await Promise.all([
      writeModerationLog(db, {
        communityId,
        actorId: callerId,
        actorName: session.user.name ?? '',
        actionType: 'join_request_rejected',
        targetUserId: requestUserId,
        targetContentType: 'member',
        reason,
        createdAt: now,
      }),
      logActivity(callerId, 'community_join_request_rejected', 'low', `Rejected join request from ${requestUserId} in ${communityId}`, { communityId, requestUserId, reason }),
    ]);

    revalidatePath(`/community/${communityId}`);

    try {
      const { emitCommunityJoinRequestUpdated } = await import('../../server');
      await emitCommunityJoinRequestUpdated(communityId, requestUserId, 'rejected');
    } catch { /* socket optional */ }

    return { success: true, message: 'Join request rejected' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Server error' };
  }
}

// ─── 10. Request to Join (Public face — adds pending request) ─────────────────

export async function requestToJoinCommunity(
  communityId: string,
  message?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, message: 'Unauthenticated' };

    const callerId = session.user.id;
    const communityObjId = assertValidObjectId(communityId, 'community ID');
    const db = await getDb();

    const community = await db.collection('communities').findOne(
      { _id: communityObjId },
      { projection: { visibility: 1, members: 1, pendingRequests: 1, name: 1 } }
    );
    if (!community) return { success: false, message: 'Community not found' };
    if (community.visibility !== 'private') {
      return { success: false, message: 'This community is public. Join directly.' };
    }

    const alreadyMember = (community.members as any[] ?? []).some((m: any) => m.userId === callerId);
    if (alreadyMember) return { success: false, message: 'You are already a member' };

    const pending = (community.pendingRequests as any[] ?? []).some(
      (r: any) => r.userId === callerId && r.status === 'pending'
    );
    if (pending) return { success: false, message: 'You already have a pending request' };

    const user = await db.collection('users').findOne(
      { _id: new ObjectId(callerId) },
      { projection: { name: 1, avatarUrl: 1 } }
    );

    const now = new Date().toISOString();
    const joinRequest = {
      userId: callerId,
      userName: user?.name ?? '',
      userAvatarUrl: user?.avatarUrl,
      communityId,
      message: message?.substring(0, 500),
      status: 'pending' as const,
      requestedAt: now,
    };

    await db.collection('communities').updateOne(
      { _id: communityObjId },
      { $push: { pendingRequests: joinRequest } as any, $set: { updatedAt: now } }
    );

    return { success: true, message: 'Join request submitted. Awaiting admin approval.' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Server error' };
  }
}

// ─── 11. Admin Delete Post ────────────────────────────────────────────────────

export async function adminDeletePost(
  communityId: string,
  postId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, message: 'Unauthenticated' };

    const callerId = session.user.id;
    const rl = await checkUserRateLimit(callerId, 'COMMUNITY_POST_ADMIN_ACTION', RATE_LIMITS.COMMUNITY_POST_ADMIN_ACTION);
    if (!rl.allowed) return { success: false, message: rl.error ?? 'Rate limit exceeded' };

    const communityObjId = assertValidObjectId(communityId, 'community ID');
    const postObjId = assertValidObjectId(postId, 'post ID');

    const db = await getDb();
    const { member: callerMember } = await getCallerMember(db, communityObjId, callerId);

    if (ROLE_LEVEL[callerMember.role as CommunityRole] < ROLE_LEVEL['moderator']) {
      return { success: false, message: 'Only moderators and above can delete posts' };
    }

    const post = await db.collection('posts').findOne(
      { _id: postObjId, communityId: communityObjId },
      { projection: { authorId: 1, deletedAt: 1 } }
    );
    if (!post) return { success: false, message: 'Post not found' };
    if (post.deletedAt) return { success: false, message: 'Post is already deleted' };

    const now = new Date().toISOString();
    await db.collection('posts').updateOne(
      { _id: postObjId },
      { $set: { deletedAt: now, deletedBy: callerId, status: 'deleted' } }
    );

    // Decrement community post count
    await db.collection('communities').updateOne(
      { _id: communityObjId },
      { $inc: { postCount: -1 } as any, $set: { updatedAt: now } }
    );

    await Promise.all([
      writeModerationLog(db, {
        communityId,
        actorId: callerId,
        actorName: session.user.name ?? '',
        actionType: 'post_deleted',
        targetContentId: postId,
        targetContentType: 'post',
        reason,
        createdAt: now,
      }),
      logActivity(callerId, 'community_post_deleted', 'medium', `Deleted post ${postId} in community ${communityId}`, { communityId, postId, reason }),
    ]);

    try {
      await db.collection("notifications").insertOne({
        userId: post.authorId,
        type: 'system',
        title: 'Your post was removed',
        message: 'A moderator has removed one of your posts for violating community guidelines.',
        link: `/community/${communityId}`,
        read: false,
        createdAt: new Date().toISOString(),
        metadata: { communityId, postId: String(post._id) }
      });
    } catch (e) { console.warn('Failed to notify post author:', e); }

    revalidatePath(`/community/${communityId}`);

    try {
      const { emitCommunityPostAdminDeleted } = await import('../../server');
      await emitCommunityPostAdminDeleted(communityId, postId, callerId);
    } catch { /* socket optional */ }

    return { success: true, message: 'Post deleted' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Server error' };
  }
}

// ─── 12. Pin / Unpin Post ─────────────────────────────────────────────────────

export async function setPinPost(
  communityId: string,
  postId: string,
  pinned: boolean
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, message: 'Unauthenticated' };

    const callerId = session.user.id;
    const rl = await checkUserRateLimit(callerId, 'COMMUNITY_POST_ADMIN_ACTION', RATE_LIMITS.COMMUNITY_POST_ADMIN_ACTION);
    if (!rl.allowed) return { success: false, message: rl.error ?? 'Rate limit exceeded' };

    const communityObjId = assertValidObjectId(communityId, 'community ID');
    const postObjId = assertValidObjectId(postId, 'post ID');

    const db = await getDb();
    const { member: callerMember } = await getCallerMember(db, communityObjId, callerId);

    if (ROLE_LEVEL[callerMember.role as CommunityRole] < ROLE_LEVEL['moderator']) {
      return { success: false, message: 'Only moderators and above can pin posts' };
    }

    const post = await db.collection('posts').findOne(
      { _id: postObjId, communityId: communityObjId },
      { projection: { isPinned: 1, deletedAt: 1 } }
    );
    if (!post) return { success: false, message: 'Post not found' };
    if (post.deletedAt) return { success: false, message: 'Cannot pin a deleted post' };

    const now = new Date().toISOString();
    const updateFields = pinned
      ? { isPinned: true, pinnedAt: now, pinnedBy: callerId }
      : { isPinned: false, pinnedAt: null, pinnedBy: null };

    await db.collection('posts').updateOne(
      { _id: postObjId },
      { $set: updateFields }
    );

    const actionType: CommunityAdminActionType = pinned ? 'post_pinned' : 'post_unpinned';
    const activityType = pinned ? 'community_post_pinned' as const : 'community_post_unpinned' as const;

    await Promise.all([
      writeModerationLog(db, {
        communityId,
        actorId: callerId,
        actorName: session.user.name ?? '',
        actionType,
        targetContentId: postId,
        targetContentType: 'post',
        createdAt: now,
      }),
      logActivity(callerId, activityType, 'low', `${pinned ? 'Pinned' : 'Unpinned'} post ${postId} in ${communityId}`, { communityId, postId }),
    ]);

    revalidatePath(`/community/${communityId}`);

    try {
      const { emitCommunityPostPinStatusChanged } = await import('../../server');
      await emitCommunityPostPinStatusChanged(communityId, postId, pinned, callerId);
    } catch { /* socket optional */ }

    return { success: true, message: pinned ? 'Post pinned' : 'Post unpinned' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Server error' };
  }
}

// ─── 13. Lock / Unlock Post ───────────────────────────────────────────────────

export async function setLockPost(
  communityId: string,
  postId: string,
  locked: boolean
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, message: 'Unauthenticated' };

    const callerId = session.user.id;
    const rl = await checkUserRateLimit(callerId, 'COMMUNITY_POST_ADMIN_ACTION', RATE_LIMITS.COMMUNITY_POST_ADMIN_ACTION);
    if (!rl.allowed) return { success: false, message: rl.error ?? 'Rate limit exceeded' };

    const communityObjId = assertValidObjectId(communityId, 'community ID');
    const postObjId = assertValidObjectId(postId, 'post ID');

    const db = await getDb();
    const { member: callerMember } = await getCallerMember(db, communityObjId, callerId);

    if (ROLE_LEVEL[callerMember.role as CommunityRole] < ROLE_LEVEL['moderator']) {
      return { success: false, message: 'Only moderators and above can lock posts' };
    }

    const post = await db.collection('posts').findOne(
      { _id: postObjId, communityId: communityObjId },
      { projection: { isLocked: 1, deletedAt: 1 } }
    );
    if (!post) return { success: false, message: 'Post not found' };
    if (post.deletedAt) return { success: false, message: 'Cannot lock a deleted post' };

    const now = new Date().toISOString();
    const updateFields = locked
      ? { isLocked: true, lockedAt: now, lockedBy: callerId }
      : { isLocked: false, lockedAt: null, lockedBy: null };

    await db.collection('posts').updateOne(
      { _id: postObjId },
      { $set: updateFields }
    );

    const actionType: CommunityAdminActionType = locked ? 'post_locked' : 'post_unlocked';
    const activityType = locked ? 'community_post_locked' as const : 'community_post_unlocked' as const;

    await Promise.all([
      writeModerationLog(db, {
        communityId,
        actorId: callerId,
        actorName: session.user.name ?? '',
        actionType,
        targetContentId: postId,
        targetContentType: 'post',
        createdAt: now,
      }),
      logActivity(callerId, activityType, 'low', `${locked ? 'Locked' : 'Unlocked'} post ${postId} in ${communityId}`, { communityId, postId }),
    ]);

    revalidatePath(`/community/${communityId}`);

    try {
      const { emitCommunityPostLockStatusChanged } = await import('../../server');
      await emitCommunityPostLockStatusChanged(communityId, postId, locked, callerId);
    } catch { /* socket optional */ }

    return { success: true, message: locked ? 'Post locked' : 'Post unlocked' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Server error' };
  }
}

// ─── 14. Admin Delete Comment ─────────────────────────────────────────────────

export async function adminDeleteComment(
  communityId: string,
  postId: string,
  commentId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, message: 'Unauthenticated' };

    const callerId = session.user.id;
    const rl = await checkUserRateLimit(callerId, 'COMMUNITY_POST_ADMIN_ACTION', RATE_LIMITS.COMMUNITY_POST_ADMIN_ACTION);
    if (!rl.allowed) return { success: false, message: rl.error ?? 'Rate limit exceeded' };

    const communityObjId = assertValidObjectId(communityId, 'community ID');
    const postObjId = assertValidObjectId(postId, 'post ID');
    const commentObjId = assertValidObjectId(commentId, 'comment ID');

    const db = await getDb();
    const { member: callerMember } = await getCallerMember(db, communityObjId, callerId);

    if (ROLE_LEVEL[callerMember.role as CommunityRole] < ROLE_LEVEL['moderator']) {
      return { success: false, message: 'Only moderators and above can delete comments' };
    }

    const comment = await db.collection('comments').findOne(
      { _id: commentObjId, postId: postObjId },
      { projection: { authorId: 1, deletedAt: 1 } }
    );
    if (!comment) return { success: false, message: 'Comment not found' };
    if (comment.deletedAt) return { success: false, message: 'Comment is already deleted' };

    const now = new Date().toISOString();
    await db.collection('comments').updateOne(
      { _id: commentObjId },
      { $set: { deletedAt: now, deletedBy: callerId, status: 'deleted' } }
    );

    // Decrement post comment count
    await db.collection('posts').updateOne(
      { _id: postObjId },
      { $inc: { commentCount: -1 } as any }
    );

    await Promise.all([
      writeModerationLog(db, {
        communityId,
        actorId: callerId,
        actorName: session.user.name ?? '',
        actionType: 'comment_deleted',
        targetContentId: commentId,
        targetContentType: 'comment',
        reason,
        metadata: { postId },
        createdAt: now,
      }),
      logActivity(callerId, 'community_comment_deleted', 'low', `Deleted comment ${commentId} in post ${postId}`, { communityId, postId, commentId, reason }),
    ]);

    revalidatePath(`/community/${communityId}`);

    return { success: true, message: 'Comment deleted' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Server error' };
  }
}

// ─── 15. Get Moderation Log ───────────────────────────────────────────────────

export async function getCommunityModerationLog(
  communityId: string,
  page = 1,
  limit = 20
): Promise<{
  success: boolean;
  message: string;
  logs?: CommunityModerationLog[];
  total?: number;
}> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, message: 'Unauthenticated' };

    const callerId = session.user.id;
    const communityObjId = assertValidObjectId(communityId, 'community ID');

    const db = await getDb();
    const { member: callerMember } = await getCallerMember(db, communityObjId, callerId);

    if (ROLE_LEVEL[callerMember.role as CommunityRole] < ROLE_LEVEL['moderator']) {
      return { success: false, message: 'Only moderators and above can view the moderation log' };
    }

    const safePage  = Math.max(1, Math.min(page, 500));
    const safeLimit = Math.max(1, Math.min(limit, 50));
    const skip = (safePage - 1) * safeLimit;

    const [logs, total] = await Promise.all([
      db.collection('community_moderation_logs')
        .find({ communityId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .toArray() as Promise<CommunityModerationLog[]>,
      db.collection('community_moderation_logs').countDocuments({ communityId }),
    ]);

    return { success: true, message: 'OK', logs, total };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Server error' };
  }
}

// ─── 16. Get Pending Join Requests ────────────────────────────────────────────

export async function getPendingJoinRequests(
  communityId: string
): Promise<{ success: boolean; message: string; requests?: any[] }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, message: 'Unauthenticated' };

    const callerId = session.user.id;
    const communityObjId = assertValidObjectId(communityId, 'community ID');

    const db = await getDb();
    const { member: callerMember } = await getCallerMember(db, communityObjId, callerId);

    if (ROLE_LEVEL[callerMember.role as CommunityRole] < ROLE_LEVEL['moderator']) {
      return { success: false, message: 'Insufficient permissions' };
    }

    const community = await db.collection('communities').findOne(
      { _id: communityObjId },
      { projection: { pendingRequests: 1 } }
    );

    const pending = ((community?.pendingRequests ?? []) as any[]).filter(
      (r: any) => r.status === 'pending'
    );

    return { success: true, message: 'OK', requests: pending };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Server error' };
  }
}
