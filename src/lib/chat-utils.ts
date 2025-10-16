/**
 * Chat Utilities
 * 
 * Helper functions for working with composite chatIds in the format: "userId1_userId2"
 * where userId1 and userId2 are sorted alphabetically to ensure consistency.
 */

/**
 * Parse a composite chatId into its constituent user IDs
 * @param chatId - Composite chatId in format "userId1_userId2"
 * @returns Object with userId1 and userId2
 * @throws Error if chatId format is invalid
 */
export function parseChatId(chatId: string): { userId1: string; userId2: string } {
  const parts = chatId.split('_');
  
  if (parts.length !== 2) {
    throw new Error(`Invalid chatId format: "${chatId}". Expected format: "userId1_userId2"`);
  }
  
  const [userId1, userId2] = parts;
  
  if (!userId1 || !userId2) {
    throw new Error(`Invalid chatId format: "${chatId}". Both user IDs must be non-empty`);
  }
  
  return { userId1, userId2 };
}

/**
 * Get the other participant's ID from a composite chatId
 * @param chatId - Composite chatId in format "userId1_userId2"
 * @param currentUserId - The current user's ID
 * @returns The other participant's user ID
 * @throws Error if current user is not a participant
 */
export function getOtherParticipant(chatId: string, currentUserId: string): string {
  const { userId1, userId2 } = parseChatId(chatId);
  
  if (userId1 === currentUserId) {
    return userId2;
  } else if (userId2 === currentUserId) {
    return userId1;
  } else {
    throw new Error(`User ${currentUserId} is not a participant in chat ${chatId}`);
  }
}

/**
 * Check if a user is a participant in a chat
 * @param chatId - Composite chatId in format "userId1_userId2"
 * @param userId - The user ID to check
 * @returns True if user is a participant, false otherwise
 */
export function isParticipant(chatId: string, userId: string): boolean {
  try {
    const { userId1, userId2 } = parseChatId(chatId);
    return userId1 === userId || userId2 === userId;
  } catch {
    return false;
  }
}

/**
 * Get both participant IDs from a composite chatId
 * @param chatId - Composite chatId in format "userId1_userId2"
 * @returns Array of [userId1, userId2]
 */
export function getParticipants(chatId: string): [string, string] {
  const { userId1, userId2 } = parseChatId(chatId);
  return [userId1, userId2];
}

/**
 * Create a composite chatId from two user IDs
 * User IDs are sorted alphabetically to ensure consistency
 * @param userId1 - First user ID
 * @param userId2 - Second user ID
 * @returns Composite chatId in format "userId1_userId2" (sorted)
 */
export function createChatId(userId1: string, userId2: string): string {
  if (!userId1 || !userId2) {
    throw new Error('Both user IDs must be provided and non-empty');
  }
  
  if (userId1 === userId2) {
    throw new Error('Cannot create chat with the same user');
  }
  
  // Sort to ensure consistency
  return [userId1, userId2].sort().join('_');
}

/**
 * Validate that a string is a valid composite chatId format
 * @param chatId - String to validate
 * @returns True if valid, false otherwise
 */
export function isValidChatId(chatId: string): boolean {
  try {
    parseChatId(chatId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard to check if a value is a valid chatId
 */
export function assertChatId(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`Expected chatId to be a string, got ${typeof value}`);
  }
  
  if (!isValidChatId(value)) {
    throw new Error(`Invalid chatId format: "${value}"`);
  }
}
