// Client-safe MongoDB utilities
// This file provides client-safe alternatives to server-only MongoDB operations

export const CLIENT_SAFE_MONGODB = {
  // Client-safe ObjectId validation
  isValidObjectId: (id: string): boolean => {
    return /^[0-9a-fA-F]{24}$/.test(id);
  },
  
  // Client-safe ObjectId creation (for form validation, etc.)
  createObjectId: (): string => {
    // Generate a random 24-character hex string that looks like an ObjectId
    // This is only for client-side validation, not actual database operations
    return Array.from({ length: 24 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  },
  
  // Client-safe database connection check (always returns false on client)
  isConnected: (): boolean => {
    return false; // Always false on client side
  }
};

// Re-export types that are safe for client use
export type { ObjectId } from 'mongodb';
