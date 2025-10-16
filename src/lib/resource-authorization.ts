/**
 * Resource-level authorization utilities
 * Implements fine-grained access control for data protection
 */

import { ObjectId } from 'mongodb';
import clientPromise from './mongodb';
import type { User, Book, Community, Chat, Report, Organization } from './types';
import { createAppError, ErrorType } from './error-handling';

export interface AuthorizedUser {
  id: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended' | 'deactivated';
}

/**
 * Resource ownership and permission checks
 */
export class ResourceAuthority {
  
  /**
   * Checks if user can access/modify a book listing
   */
  static async canAccessBook(user: AuthorizedUser, bookId: string, operation: 'read' | 'update' | 'delete'): Promise<boolean> {
    if (!ObjectId.isValid(bookId)) return false;
    
    const client = await clientPromise;
    const db = client.db('bookex');
    
    const book = await db.collection<Book>('books').findOne({ _id: new ObjectId(bookId) });
    if (!book) return false;
    
    switch (operation) {
      case 'read':
        return true; // Anyone can read book listings
      case 'update':
      case 'delete':
        return book.sellerId === user.id || user.role === 'admin';
      default:
        return false;
    }
  }
  
  /**
   * Checks if user can access/modify user profile data
   */
  static async canAccessUser(user: AuthorizedUser, targetUserId: string, operation: 'read' | 'update' | 'delete'): Promise<boolean> {
    if (!ObjectId.isValid(targetUserId)) return false;
    
    switch (operation) {
      case 'read':
        return true; // Anyone can read public profile data
      case 'update':
        return user.id === targetUserId || user.role === 'admin';
      case 'delete':
        return user.role === 'admin'; // Only admins can delete users
      default:
        return false;
    }
  }
  
  /**
   * Checks if user can access private user data (email, phone, etc.)
   */
  static canAccessPrivateUserData(user: AuthorizedUser, targetUserId: string): boolean {
    return user.id === targetUserId || user.role === 'admin';
  }
  
  /**
   * Checks if user can access/modify a chat
   */
  static async canAccessChat(user: AuthorizedUser, chatId: string, operation: 'read' | 'update' | 'delete'): Promise<boolean> {
    if (!ObjectId.isValid(chatId)) return false;
    
    const client = await clientPromise;
    const db = client.db('bookex');
    
    const chat = await db.collection<Chat>('chats').findOne({ _id: new ObjectId(chatId) });
    if (!chat) return false;
    
    switch (operation) {
      case 'read':
      case 'update':
        return chat.participantIds.includes(user.id) || user.role === 'admin';
      case 'delete':
        return user.role === 'admin';
      default:
        return false;
    }
  }
  
  /**
   * Checks if user can access/modify a community
   */
  static async canAccessCommunity(user: AuthorizedUser, communityId: string, operation: 'read' | 'update' | 'delete' | 'moderate'): Promise<boolean> {
    if (!ObjectId.isValid(communityId)) return false;
    
    const client = await clientPromise;
    const db = client.db('bookex');
    
    const community = await db.collection<Community>('communities').findOne({ _id: new ObjectId(communityId) });
    if (!community) return false;
    
    switch (operation) {
      case 'read':
        return true; // Anyone can read community content
      case 'update':
      case 'moderate':
        return community.createdBy === user.id || user.role === 'admin';
      case 'delete':
        return community.createdBy === user.id || user.role === 'admin';
      default:
        return false;
    }
  }
  
  /**
   * Checks if user can access/modify organization data
   */
  static async canAccessOrganization(user: AuthorizedUser, orgId: string, operation: 'read' | 'update' | 'delete' | 'approve'): Promise<boolean> {
    if (!ObjectId.isValid(orgId)) return false;
    
    const client = await clientPromise;
    const db = client.db('bookex');
    
    const org = await db.collection<Organization>('organizations').findOne({ _id: new ObjectId(orgId) });
    if (!org) return false;
    
    switch (operation) {
      case 'read':
        return org.status === 'approved' || org.submittedBy === user.id || user.role === 'admin';
      case 'update':
        return org.submittedBy === user.id || user.role === 'admin';
      case 'delete':
      case 'approve':
        return user.role === 'admin';
      default:
        return false;
    }
  }
  
  /**
   * Checks admin-only operations
   */
  static canPerformAdminAction(user: AuthorizedUser, _action: 'view_reports' | 'manage_users' | 'system_settings'): boolean {
    return user.role === 'admin' && user.status === 'active';
  }
  
  /**
   * Checks if user can create content (not suspended/deactivated)
   */
  static canCreateContent(user: AuthorizedUser): boolean {
    return user.status === 'active';
  }
  
  /**
   * Validates that a user owns a resource before modification
   */
  static async validateResourceOwnership(user: AuthorizedUser, resourceType: 'book' | 'community' | 'organization', resourceId: string): Promise<void> {
    if (!ObjectId.isValid(resourceId)) {
      throw createAppError(ErrorType.VALIDATION, 'Invalid resource ID');
    }
    
    const client = await clientPromise;
    const db = client.db('bookex');
    
    let resource: any;
    let ownerField: string;
    
    switch (resourceType) {
      case 'book':
        resource = await db.collection('books').findOne({ _id: new ObjectId(resourceId) });
        ownerField = 'sellerId';
        break;
      case 'community':
        resource = await db.collection('communities').findOne({ _id: new ObjectId(resourceId) });
        ownerField = 'createdBy';
        break;
      case 'organization':
        resource = await db.collection('organizations').findOne({ _id: new ObjectId(resourceId) });
        ownerField = 'submittedBy';
        break;
      default:
        throw createAppError(ErrorType.VALIDATION, 'Unknown resource type');
    }
    
    if (!resource) {
      throw createAppError(ErrorType.NOT_FOUND, `${resourceType} not found`);
    }
    
    if (resource[ownerField] !== user.id && user.role !== 'admin') {
      throw createAppError(ErrorType.AUTHORIZATION, `You do not have permission to access this ${resourceType}`);
    }
  }
  
  /**
   * Filters sensitive user data based on access level
   */
  static filterUserData(user: AuthorizedUser, targetUser: User, requestingUserId: string): Partial<User> {
    const isOwnProfile = targetUser._id?.toString() === requestingUserId;
    const isAdmin = user.role === 'admin';
    
    if (isOwnProfile || isAdmin) {
      // Return full profile for own profile or admin
      return targetUser;
    } else {
      // Return limited public profile
      return {
        _id: targetUser._id,
        name: targetUser.name,
        avatarUrl: targetUser.avatarUrl,
        city: targetUser.city,
        bio: targetUser.bio,
        interests: targetUser.interests,
        reviews: targetUser.reviews,
        averageRating: targetUser.averageRating,
        // Remove sensitive fields
        email: undefined,
        phone: undefined,
        password: undefined,
        totalRatingPoints: undefined,
        role: undefined,
        status: undefined,
        wishlist: undefined,
        emailPreferences: undefined,
      };
    }
  }
  
  /**
   * Creates secure MongoDB query filters based on user permissions
   */
  static createSecureFilter(user: AuthorizedUser, baseFilter: any = {}, resourceType: 'book' | 'chat' | 'community'): any {
    switch (resourceType) {
      case 'book':
        // Users can see all approved books
        return baseFilter;
        
      case 'chat':
        // Users can only see their own chats
        if (user.role === 'admin') {
          return baseFilter; // Admins can see all chats
        }
        return {
          ...baseFilter,
          participantIds: user.id
        };
        
      case 'community':
        // Users can see all communities
        return baseFilter;
        
      default:
        return baseFilter;
    }
  }
}

/**
 * Middleware function to validate resource access
 */
export async function validateResourceAccess(
  user: AuthorizedUser,
  resourceType: 'book' | 'user' | 'chat' | 'community' | 'organization',
  resourceId: string,
  operation: 'read' | 'update' | 'delete' | 'approve' | 'moderate'
): Promise<void> {
  let hasAccess = false;
  
  switch (resourceType) {
    case 'book':
      hasAccess = await ResourceAuthority.canAccessBook(user, resourceId, operation as any);
      break;
    case 'user':
      hasAccess = await ResourceAuthority.canAccessUser(user, resourceId, operation as any);
      break;
    case 'chat':
      hasAccess = await ResourceAuthority.canAccessChat(user, resourceId, operation as any);
      break;
    case 'community':
      hasAccess = await ResourceAuthority.canAccessCommunity(user, resourceId, operation as any);
      break;
    case 'organization':
      hasAccess = await ResourceAuthority.canAccessOrganization(user, resourceId, operation as any);
      break;
  }
  
  if (!hasAccess) {
    throw createAppError(
      ErrorType.AUTHORIZATION,
      `Access denied: Cannot ${operation} ${resourceType} with ID ${resourceId}`
    );
  }
}
