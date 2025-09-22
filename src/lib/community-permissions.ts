import clientPromise from './mongodb';
import { ObjectId } from 'mongodb';
import type { CommunityRole, Community } from './types';

export interface CommunityMemberInfo {
  userId: string;
  role: CommunityRole;
  joinedAt: string;
  banned?: boolean;
}

export async function getUserCommunityRole(communityId: string, userId: string): Promise<CommunityRole | null> {
  const client = await clientPromise;
  const db = client.db('bookex');
  if (!ObjectId.isValid(communityId)) return null;
  const community = await db.collection('communities').findOne(
    { _id: new ObjectId(communityId), 'members.userId': userId },
    { projection: { members: 1, createdBy: 1 } }
  ) as any;
  if (!community) return null;
  const member = (community.members || []).find((m: CommunityMemberInfo) => m.userId === userId);
  return member?.role || (community.createdBy === userId ? 'admin' : null);
}

export function hasModerationPrivileges(role: CommunityRole | null): boolean {
  return role === 'admin' || role === 'moderator';
}

export function isAdmin(role: CommunityRole | null): boolean {
  return role === 'admin';
}

export async function assertCommunityMember(communityId: string, userId: string): Promise<void> {
  const client = await clientPromise;
  const db = client.db('bookex');
  if (!ObjectId.isValid(communityId)) throw new Error('Invalid community ID');
  const exists = await db.collection('communities').findOne({ _id: new ObjectId(communityId), 'members.userId': userId });
  if (!exists) throw new Error('Not a member of this community');
}

export async function assertCanModerate(communityId: string, userId: string): Promise<void> {
  const role = await getUserCommunityRole(communityId, userId);
  if (!hasModerationPrivileges(role)) throw new Error('Insufficient permissions');
}

/**
 * Centralized membership check function
 * Determines if a user is a member of a community and not banned
 */
export function isMember(userId: string, community: Community): boolean {
  if (!community.members || !Array.isArray(community.members)) {
    return false;
  }
  
  const member = community.members.find(m => m.userId === userId);
  return member !== undefined && !member.banned;
}

/**
 * Check if user is a member of a community by ID
 */
export async function isCommunityMember(communityId: string, userId: string): Promise<boolean> {
  const client = await clientPromise;
  const db = client.db('bookex');
  if (!ObjectId.isValid(communityId)) return false;
  
  const community = await db.collection('communities').findOne(
    { _id: new ObjectId(communityId) },
    { projection: { members: 1 } }
  ) as Community | null;
  
  if (!community) return false;
  return isMember(userId, community);
}

/**
 * Get member info for a user in a community
 */
export function getMemberInfo(userId: string, community: Community): CommunityMemberInfo | null {
  if (!community.members || !Array.isArray(community.members)) {
    return null;
  }
  
  return community.members.find(m => m.userId === userId) || null;
}

/**
 * Check if user can access a specific channel
 */
export function canAccessChannel(userId: string, community: Community, channelId: string): boolean {
  if (!isMember(userId, community)) {
    return false;
  }
  
  // For now, all members can access all channels
  // This can be extended for channel-specific permissions later
  return true;
}


