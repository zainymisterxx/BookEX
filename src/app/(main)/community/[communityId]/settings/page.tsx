import { notFound, redirect } from 'next/navigation';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { AdminSettingsPanel } from '@/components/community/admin-settings-panel';
import type { CommunityRole, JoinRequest, CommunityModerationLog } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ communityId: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serialize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

const ROLE_LEVEL: Record<CommunityRole, number> = {
  creator: 4,
  admin: 3,
  moderator: 2,
  member: 1,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CommunitySettingsPage({ params }: PageProps) {
  const { communityId } = await params;

  // 1. Auth gate
  const session = await getSession();
  if (!session?.user?.id) {
    redirect(`/api/auth/signin?callbackUrl=/community/${communityId}/settings`);
  }
  const callerId = session.user.id;

  // 2. Validate ID
  if (!ObjectId.isValid(communityId)) {
    notFound();
  }

  const client = await clientPromise;
  const db = client.db('bookex');
  const communityObjId = new ObjectId(communityId);

  // 3. Fetch community
  const community = await db
    .collection('communities')
    .findOne({ _id: communityObjId, deletedAt: { $exists: false } });

  if (!community) {
    notFound();
  }

  // 4. Find caller's membership and verify admin+
  const callerMembership = Array.isArray(community.members)
    ? community.members.find(
        (m: { userId: string | ObjectId; role: CommunityRole }) =>
          String(m.userId) === callerId
      )
    : null;

  if (!callerMembership) {
    // Not a member — bounce to community page
    redirect(`/community/${communityId}`);
  }

  const callerRole: CommunityRole = callerMembership.role ?? 'member';
  if (ROLE_LEVEL[callerRole] < ROLE_LEVEL['admin']) {
    // Members and moderators cannot access settings
    redirect(`/community/${communityId}`);
  }

  // 5. Hydrate member list with user details (one aggregation)
  const membersRaw: Array<{ userId: string | ObjectId; role: CommunityRole; joinedAt?: string; banned?: boolean; banReason?: string }> =
    Array.isArray(community.members) ? community.members : [];

  const memberUserIds = membersRaw
    .map(m => {
      try {
        return new ObjectId(String(m.userId));
      } catch {
        return null;
      }
    })
    .filter((id): id is ObjectId => id !== null);

  const userDocs = await db
    .collection('users')
    .find({ _id: { $in: memberUserIds } }, { projection: { _id: 1, name: 1, email: 1, avatarUrl: 1 } })
    .toArray();

  const userMap = new Map(userDocs.map(u => [String(u._id), u]));

  const membersWithDetails = membersRaw.map(m => ({
    userId: String(m.userId),
    role: m.role,
    joinedAt: m.joinedAt ?? new Date().toISOString(),
    banned: m.banned ?? false,
    banReason: m.banReason,
    user: userMap.get(String(m.userId))
      ? {
          _id: String(userMap.get(String(m.userId))!._id),
          name: userMap.get(String(m.userId))!.name as string,
          email: userMap.get(String(m.userId))!.email as string,
          avatarUrl: userMap.get(String(m.userId))!.avatarUrl as string | undefined,
        }
      : undefined,
  }));

  // 6. Pending join requests (if private)
  let pendingRequests: JoinRequest[] = [];
  if (community.visibility === 'private' && Array.isArray(community.pendingRequests)) {
    const reqUserIds = (community.pendingRequests as Array<{ userId: string | ObjectId; requestedAt?: string; message?: string }>)
      .map(r => {
        try { return new ObjectId(String(r.userId)); } catch { return null; }
      })
      .filter((id): id is ObjectId => id !== null);

    const reqUserDocs = reqUserIds.length
      ? await db
          .collection('users')
          .find({ _id: { $in: reqUserIds } }, { projection: { _id: 1, name: 1, avatarUrl: 1 } })
          .toArray()
      : [];
    const reqUserMap = new Map(reqUserDocs.map(u => [String(u._id), u]));

    pendingRequests = (community.pendingRequests as Array<{ userId: string | ObjectId; requestedAt?: string; message?: string }>).map(r => ({
      userId: String(r.userId),
      communityId,
      status: 'pending' as const,
      requestedAt: r.requestedAt ?? new Date().toISOString(),
      message: r.message,
      userName: (reqUserMap.get(String(r.userId))?.name as string | undefined) ?? '',
      userAvatarUrl: reqUserMap.get(String(r.userId))?.avatarUrl as string | undefined,
    }));
  }

  // 7. First page of moderation log (10 entries)
  const MOD_LOG_LIMIT = 10;
  const [moderationLogs, moderationLogsTotal] = await Promise.all([
    db
      .collection('community_moderation_logs')
      .find({ communityId: communityObjId })
      .sort({ createdAt: -1 })
      .limit(MOD_LOG_LIMIT)
      .toArray() as Promise<CommunityModerationLog[]>,
    db
      .collection('community_moderation_logs')
      .countDocuments({ communityId: communityObjId }),
  ]);

  // 8. Serialize everything (ObjectIds → strings)
  const safeCommunity = serialize({
    ...community,
    _id: String(community._id),
    createdBy: String(community.createdBy),
    createdAt: community.createdAt instanceof Date ? community.createdAt.toISOString() : community.createdAt,
    updatedAt: community.updatedAt instanceof Date ? community.updatedAt?.toISOString() : community.updatedAt,
    members: undefined, // passed separately
    posts: undefined,
    pendingRequests: undefined,
  });

  const safeLogs = serialize(
    moderationLogs.map(l => ({
      ...l,
      _id: String((l as any)._id),
      communityId: String((l as any).communityId),
      actorId: String((l as any).actorId),
      targetContentId: l.targetContentId ? String(l.targetContentId) : undefined,
    }))
  );

  return (
    <main className="container max-w-5xl py-8">
      <AdminSettingsPanel
        community={safeCommunity as any}
        membersWithDetails={serialize(membersWithDetails)}
        pendingRequests={serialize(pendingRequests)}
        moderationLogs={safeLogs}
        moderationLogsTotal={moderationLogsTotal}
        callerId={callerId}
        callerRole={callerRole}
      />
    </main>
  );
}
