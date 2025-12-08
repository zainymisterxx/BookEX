import { getSession } from '@/lib/auth';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId, type Db } from 'mongodb';
import { createAppError, ErrorType, logError, normalizeError } from '@/lib/error-handling';
import type { AuthorizedUser } from '@/lib/resource-authorization';
import type { User } from '@/lib/types';

/**
 * Wrapper function that handles common authentication and database connection patterns
 * for server actions. Eliminates repetitive boilerplate code.
 * 
 * @param action - The action function to execute with authenticated user and DB access
 * @param requiredRole - Optional role requirement ('user' | 'admin')
 * @returns Promise with the action result or error response
 */
export async function withAuthenticatedAction<T>(
  action: (params: { db: Db; user: AuthorizedUser; userId: ObjectId }) => Promise<T>,
  requiredRole?: 'user' | 'admin'
): Promise<{ success: true; data: T } | { success: false; message: string; errors?: Record<string, unknown> }> {
  try {
    // Get the current session
    const session = await getSession();
    if (!session?.user?.id) {
      throw createAppError(ErrorType.AUTHENTICATION, "You must be logged in to perform this action.");
    }

    // Create userId as ObjectId
    const userId = new ObjectId(session.user.id);

    // Connect to MongoDB
    const { db } = await connectToMongoDB();

    // Create user object with required properties
    const user: AuthorizedUser = {
      id: session.user.id,
      role: ('role' in session.user && (session.user.role === 'admin' || session.user.role === 'user')) 
        ? session.user.role 
        : 'user',
      status: 'active'
    };

    // Check role requirement if specified
    if (requiredRole && user.role !== requiredRole) {
      throw createAppError(ErrorType.AUTHORIZATION, `This action requires ${requiredRole} privileges.`);
    }

    // Execute the action with authenticated context
    const result = await action({ db, user, userId });

    return { success: true, data: result };
  } catch (error) {
    // Log the error for debugging
    logError(normalizeError(error, 'withAuthenticatedAction'));

    // Return standardized error response
    if (error instanceof Error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return { 
      success: false, 
      message: 'An unexpected error occurred' 
    };
  }
}

/**
 * Wrapper for actions that need full user data (not just session data)
 * This fetches the complete user document from the database
 * Note: user object returned has both _id (from DB) and id (string) properties for convenience
 */
export async function withAuthenticatedUserFull<T>(
  action: (params: { db: Db; user: User & { id: string }; userId: ObjectId }) => Promise<T>,
  requiredRole?: 'user' | 'admin'
): Promise<{ success: true; data: T } | { success: false; message: string; errors?: Record<string, unknown> }> {
  try {
    // Get the current session
    const session = await getSession();
    if (!session?.user?.id) {
      throw createAppError(ErrorType.AUTHENTICATION, "You must be logged in to perform this action.");
    }

    // Create userId as ObjectId
    const userId = new ObjectId(session.user.id);

    // Connect to MongoDB
    const { db } = await connectToMongoDB();

    // Fetch full user data from database
    const userData = await db.collection('users').findOne({ _id: userId }) as User | null;
    if (!userData) {
      throw createAppError(ErrorType.AUTHENTICATION, "User not found in database.");
    }

    // Check role requirement if specified
    if (requiredRole && userData.role !== requiredRole) {
      throw createAppError(ErrorType.AUTHORIZATION, `This action requires ${requiredRole} privileges.`);
    }

    // Execute the action with full user context
    const result = await action({ db, user: { ...userData, id: userId.toString() }, userId });

    return { success: true, data: result };
  } catch (error) {
    // Log the error for debugging
    logError(normalizeError(error, 'withAuthenticatedUserFull'));

    // Return standardized error response
    if (error instanceof Error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return { 
      success: false, 
      message: 'An unexpected error occurred' 
    };
  }
}
