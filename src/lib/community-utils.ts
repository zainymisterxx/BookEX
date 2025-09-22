/**
 * Utility functions for community operations
 * Provides consistent handling of community member data structures
 */

/**
 * Checks if a user is a member of a community
 * Handles both old (string array) and new (object array) member data structures
 * @param members The members array from a community
 * @param userId The user ID to check
 * @returns true if the user is a member, false otherwise
 */
export function isUserMember(members: any[] | undefined, userId: string): boolean {
  if (!Array.isArray(members) || !userId) return false;
  
  return members.some((m: any) => 
    (typeof m === 'string' && m === userId) || 
    (typeof m === 'object' && m.userId === userId)
  );
}

/**
 * Gets the user's role in a community
 * @param members The members array from a community
 * @param userId The user ID to check
 * @returns The user's role or null if not a member
 */
export function getUserRole(members: any[] | undefined, userId: string): string | null {
  if (!Array.isArray(members) || !userId) return null;
  
  const member = members.find((m: any) => 
    (typeof m === 'string' && m === userId) || 
    (typeof m === 'object' && m.userId === userId)
  );
  
  return member && typeof member === 'object' ? member.role : 'member';
}

/**
 * Creates a member object for adding to a community
 * @param userId The user ID
 * @param role The user's role (default: 'member')
 * @returns A member object
 */
export function createMemberObject(userId: string, role: string = 'member') {
  return {
    userId,
    role,
    joinedAt: new Date().toISOString()
  };
}

/**
 * Removes a user from a members array
 * Handles both old (string array) and new (object array) member data structures
 * @param members The current members array
 * @param userId The user ID to remove
 * @returns A new members array with the user removed
 */
export function removeMember(members: any[], userId: string): any[] {
  if (!Array.isArray(members)) return [];
  
  return members.filter((m: any) => 
    (typeof m === 'string' && m !== userId) || 
    (typeof m === 'object' && m.userId !== userId)
  );
}

/**
 * Adds a user to a members array
 * @param members The current members array
 * @param userId The user ID to add
 * @param role The user's role (default: 'member')
 * @returns A new members array with the user added
 */
export function addMember(members: any[], userId: string, role: string = 'member'): any[] {
  const currentMembers = Array.isArray(members) ? members : [];
  const memberData = createMemberObject(userId, role);
  
  // Check if user is already a member
  if (isUserMember(currentMembers, userId)) {
    return currentMembers;
  }
  
  return [...currentMembers, memberData];
}

/**
 * Updates member count based on membership change
 * @param currentCount The current member count
 * @param isJoining Whether the user is joining (true) or leaving (false)
 * @returns The new member count
 */
export function updateMemberCount(currentCount: number, isJoining: boolean): number {
  return currentCount + (isJoining ? 1 : -1);
}
