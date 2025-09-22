// Client-safe community permissions utilities
// These functions work with data that's already been fetched from the server

import type { CommunityRole, Community } from './types';

export interface CommunityMemberInfo {
  userId: string;
  role: CommunityRole;
  joinedAt: string;
  banned?: boolean;
}

/**
 * Client-safe membership check function
 * Determines if a user is a member of a community and not banned
 * This works with data that's already been fetched from the server
 */
export function isMember(userId: string, community: Community): boolean {
  if (!community?.members) return false;
  
  const member = community.members.find(m => m.userId === userId);
  return member ? !member.banned : false;
}

/**
 * Client-safe function to get member information
 * Returns member info if user is a member of the community
 */
export function getMemberInfo(userId: string, community: Community): CommunityMemberInfo | null {
  if (!community?.members) return null;
  
  const member = community.members.find(m => m.userId === userId);
  return member || null;
}

/**
 * Client-safe function to check if user has moderation privileges
 */
export function hasModerationPrivileges(role: CommunityRole | null): boolean {
  return role === 'admin' || role === 'moderator';
}

/**
 * Client-safe function to check if user is admin
 */
export function isAdmin(role: CommunityRole | null): boolean {
  return role === 'admin';
}

/**
 * Client-safe function to get user's role in a community
 */
export function getUserRole(userId: string, community: Community): CommunityRole | null {
  if (!community?.members) return null;
  
  const member = community.members.find(m => m.userId === userId);
  return member?.role || (community.createdBy === userId ? 'admin' : null);
}

/**
 * Client-safe function to check if user can moderate
 */
export function canModerate(userId: string, community: Community): boolean {
  const role = getUserRole(userId, community);
  return hasModerationPrivileges(role);
}
