/**
 * Centralized Community Service Layer
 * 
 * This service consolidates all community-related business logic,
 * eliminating code duplication and providing consistent behavior.
 * 
 * Fixes:
 * - CRITICAL-005: Unified member data format (object-based only)
 * - DUP-001: Single source of truth for membership checks
 * - DUP-002: Centralized permission validation
 * - DUP-004: Unified community existence checks
 */

import { ObjectId, type Db } from 'mongodb';
import clientPromise from '@/lib/mongodb';

// ============================================================================
// TYPES
// ============================================================================

export interface CommunityMember {
    userId: string;
    role: 'creator' | 'admin' | 'moderator' | 'member';
    joinedAt: Date;
    banned: boolean;
    bannedAt?: Date;
    bannedBy?: string;
    banReason?: string;
    muted: boolean;
    mutedUntil?: Date;
    mutedBy?: string;
}

export interface Community {
    _id: ObjectId;
    name: string;
    description: string;
    createdBy: string;
    members: CommunityMember[];
    memberCount: number;
    channels: CommunityChannel[];
    visibility: 'public' | 'private';
    createdAt: Date;
    updatedAt: Date;
}

export interface CommunityChannel {
    _id: string;
    name: string;
    description?: string;
    type: 'chat' | 'forum';
    order: number;
    allowedRoles?: Array<'creator' | 'admin' | 'moderator' | 'member'>;
    createdAt: Date;
}

export interface Post {
    _id: ObjectId;
    communityId: ObjectId;
    channelId?: string;
    authorId: string;
    author: {
        _id: string;
        name: string;
        avatarUrl?: string;
    };
    content: string;
    likes: number;
    likedBy: string[];
    commentCount: number;
    createdAt: Date;
    editedAt?: Date;
    deletedAt?: Date;
}

export interface Comment {
    _id: ObjectId;
    postId: ObjectId;
    communityId: ObjectId;
    authorId: string;
    author: {
        _id: string;
        name: string;
        avatarUrl?: string;
    };
    content: string;
    parentId?: ObjectId;
    path: string; // Format: "postId/parentId1/parentId2"
    depth: number; // Calculated from path
    reactions: Array<{ userId: string; type: string }>;
    createdAt: Date;
    editedAt?: Date;
    deletedAt?: Date;
}

export type Permission = 
    | 'view_community'
    | 'create_post'
    | 'edit_own_post'
    | 'delete_own_post'
    | 'delete_any_post'
    | 'comment'
    | 'like'
    | 'create_channel'
    | 'edit_channel'
    | 'delete_channel'
    | 'ban_member'
    | 'unban_member'
    | 'mute_member'
    | 'promote_member'
    | 'demote_member';

// ============================================================================
// PERMISSION SYSTEM
// ============================================================================

/**
 * Role hierarchy and permissions mapping
 */
const ROLE_PERMISSIONS: Record<CommunityMember['role'], Permission[]> = {
    creator: [
        'view_community',
        'create_post',
        'edit_own_post',
        'delete_own_post',
        'delete_any_post',
        'comment',
        'like',
        'create_channel',
        'edit_channel',
        'delete_channel',
        'ban_member',
        'unban_member',
        'mute_member',
        'promote_member',
        'demote_member',
    ],
    admin: [
        'view_community',
        'create_post',
        'edit_own_post',
        'delete_own_post',
        'delete_any_post',
        'comment',
        'like',
        'create_channel',
        'edit_channel',
        'delete_channel',
        'ban_member',
        'unban_member',
        'mute_member',
        'promote_member',
        'demote_member',
    ],
    moderator: [
        'view_community',
        'create_post',
        'edit_own_post',
        'delete_own_post',
        'delete_any_post',
        'comment',
        'like',
        'edit_channel',
        'mute_member',
    ],
    member: [
        'view_community',
        'create_post',
        'edit_own_post',
        'delete_own_post',
        'comment',
        'like',
    ],
};

const ROLE_HIERARCHY: Record<CommunityMember['role'], number> = {
    creator: 4,
    admin: 3,
    moderator: 2,
    member: 1,
};

// ============================================================================
// COMMUNITY SERVICE CLASS
// ============================================================================

export class CommunityService {
    private db: Db;

    constructor(db: Db) {
        this.db = db;
    }

    /**
     * Validates and converts a string to ObjectId
     * Prevents NoSQL injection attacks
     */
    private validateObjectId(id: string, fieldName: string = 'ID'): ObjectId {
        if (!id || typeof id !== 'string' || id.trim().length === 0) {
            throw new Error(`Invalid ${fieldName}: empty or not a string`);
        }

        if (!ObjectId.isValid(id)) {
            throw new Error(`Invalid ${fieldName}: not a valid ObjectId format`);
        }

        return new ObjectId(id);
    }

    // ========================================================================
    // COMMUNITY RETRIEVAL
    // ========================================================================

    /**
     * Gets a community by ID or throws error
     * Centralized to eliminate duplication (DUP-004)
     */
    async getCommunityOrThrow(communityId: string): Promise<Community> {
        const id = this.validateObjectId(communityId, 'community ID');
        
        const community = await this.db.collection('communities').findOne({
            _id: id
        }) as Community | null;

        if (!community) {
            throw new Error('Community not found');
        }

        return community;
    }

    /**
     * Gets a community by ID, returns null if not found
     */
    async getCommunity(communityId: string): Promise<Community | null> {
        const id = this.validateObjectId(communityId, 'community ID');
        
        return await this.db.collection('communities').findOne({
            _id: id
        }) as Community | null;
    }

    // ========================================================================
    // MEMBERSHIP OPERATIONS
    // ========================================================================

    /**
     * Gets member information for a user in a community
     * Returns null if user is not a member
     * 
     * Fixes DUP-001: Single implementation for membership checking
     */
    async getMemberInfo(
        communityId: string,
        userId: string
    ): Promise<CommunityMember | null> {
        const community = await this.getCommunity(communityId);
        
        if (!community || !Array.isArray(community.members)) {
            return null;
        }

        const member = community.members.find(m => m.userId === userId);
        return member || null;
    }

    /**
     * Checks if a user is a member of a community
     * Does NOT check ban status - use canPerformAction for that
     */
    async isMember(communityId: string, userId: string): Promise<boolean> {
        const member = await this.getMemberInfo(communityId, userId);
        return member !== null;
    }

    /**
     * Checks if a user is an active member (not banned)
     */
    async isActiveMember(communityId: string, userId: string): Promise<boolean> {
        const member = await this.getMemberInfo(communityId, userId);
        return member !== null && !member.banned;
    }

    /**
     * Gets user's role in a community
     */
    async getUserRole(
        communityId: string,
        userId: string
    ): Promise<CommunityMember['role'] | null> {
        const member = await this.getMemberInfo(communityId, userId);
        return member?.role || null;
    }

    // ========================================================================
    // PERMISSION CHECKS
    // ========================================================================

    /**
     * Checks if a user has a specific permission in a community
     * 
     * Fixes DUP-002: Centralized permission validation
     */
    async hasPermission(
        communityId: string,
        userId: string,
        permission: Permission
    ): Promise<boolean> {
        const member = await this.getMemberInfo(communityId, userId);
        
        // Not a member = no permissions
        if (!member) {
            return false;
        }

        // Banned members have no permissions except view_community
        if (member.banned && permission !== 'view_community') {
            return false;
        }

        // Muted members cannot post or comment
        if (member.muted && member.mutedUntil && member.mutedUntil > new Date()) {
            if (permission === 'create_post' || permission === 'comment') {
                return false;
            }
        }

        // Check if role has the permission
        const rolePermissions = ROLE_PERMISSIONS[member.role] || [];
        return rolePermissions.includes(permission);
    }

    /**
     * Asserts that a user has a permission, throws if not
     */
    async assertPermission(
        communityId: string,
        userId: string,
        permission: Permission,
        customError?: string
    ): Promise<void> {
        const hasPermission = await this.hasPermission(communityId, userId, permission);
        
        if (!hasPermission) {
            throw new Error(customError || `Permission denied: ${permission}`);
        }
    }

    /**
     * Checks if user has moderation privileges (moderator or above)
     */
    async hasModerationPrivileges(communityId: string, userId: string): Promise<boolean> {
        const role = await this.getUserRole(communityId, userId);
        return role !== null && ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.moderator;
    }

    /**
     * Checks if user has admin privileges (admin or creator)
     */
    async hasAdminPrivileges(communityId: string, userId: string): Promise<boolean> {
        const role = await this.getUserRole(communityId, userId);
        return role !== null && ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin;
    }

    /**
     * Checks if user is the community creator
     */
    async isCreator(communityId: string, userId: string): Promise<boolean> {
        const community = await this.getCommunity(communityId);
        return community !== null && community.createdBy === userId;
    }

    /**
     * Checks if user can moderate another user (based on role hierarchy)
     */
    async canModerateUser(
        communityId: string,
        moderatorUserId: string,
        targetUserId: string
    ): Promise<{ allowed: boolean; reason?: string }> {
        // Can't moderate yourself
        if (moderatorUserId === targetUserId) {
            return { allowed: false, reason: 'Cannot moderate yourself' };
        }

        const moderatorRole = await this.getUserRole(communityId, moderatorUserId);
        const targetRole = await this.getUserRole(communityId, targetUserId);

        if (!moderatorRole) {
            return { allowed: false, reason: 'You are not a member of this community' };
        }

        if (!targetRole) {
            return { allowed: false, reason: 'Target user is not a member' };
        }

        // Creator can moderate anyone
        const isCreator = await this.isCreator(communityId, moderatorUserId);
        if (isCreator) {
            return { allowed: true };
        }

        // Can't moderate someone with equal or higher role
        const moderatorLevel = ROLE_HIERARCHY[moderatorRole];
        const targetLevel = ROLE_HIERARCHY[targetRole];

        if (moderatorLevel <= targetLevel) {
            return { allowed: false, reason: 'Cannot moderate users with equal or higher role' };
        }

        return { allowed: true };
    }

    // ========================================================================
    // POST OPERATIONS (Using separate posts collection)
    // ========================================================================

    /**
     * Gets a post by ID with permission check
     * Fixes CRITICAL-002: Strict ObjectId validation
     */
    async getPost(
        communityId: string,
        postId: string,
        userId?: string
    ): Promise<Post | null> {
        const communityObjId = this.validateObjectId(communityId, 'community ID');
        const postObjId = this.validateObjectId(postId, 'post ID');

        // If userId provided, check membership
        if (userId) {
            const isActive = await this.isActiveMember(communityId, userId);
            if (!isActive) {
                throw new Error('You must be an active member to view posts');
            }
        }

        const post = await this.db.collection('posts').findOne({
            _id: postObjId,
            communityId: communityObjId,
            deletedAt: { $exists: false }
        }) as Post | null;

        return post;
    }

    /**
     * Checks if user can delete a specific post
     */
    async canDeletePost(
        communityId: string,
        postId: string,
        userId: string
    ): Promise<boolean> {
        const post = await this.getPost(communityId, postId);
        
        if (!post) {
            return false;
        }

        // Post author can always delete their own post
        if (post.authorId === userId) {
            return true;
        }

        // Check if user has delete_any_post permission
        return await this.hasPermission(communityId, userId, 'delete_any_post');
    }

    /**
     * Checks if user can edit a specific post
     */
    async canEditPost(
        communityId: string,
        postId: string,
        userId: string
    ): Promise<boolean> {
        const post = await this.getPost(communityId, postId);
        
        if (!post) {
            return false;
        }

        // Only post author can edit (even admins can't edit others' posts)
        return post.authorId === userId;
    }

    // ========================================================================
    // CHANNEL OPERATIONS
    // ========================================================================

    /**
     * Checks if user can access a specific channel
     */
    async canAccessChannel(
        communityId: string,
        channelId: string,
        userId: string
    ): Promise<boolean> {
        const member = await this.getMemberInfo(communityId, userId);
        
        if (!member || member.banned) {
            return false;
        }

        const community = await this.getCommunity(communityId);
        if (!community) {
            return false;
        }

        const channel = community.channels.find(c => c._id === channelId);
        if (!channel) {
            return false;
        }

        // If channel has no role restrictions, all members can access
        if (!channel.allowedRoles || channel.allowedRoles.length === 0) {
            return true;
        }

        // Check if user's role is in allowed roles
        return channel.allowedRoles.includes(member.role);
    }

    // ========================================================================
    // UTILITY METHODS
    // ========================================================================

    /**
     * Recalculates member count from members array
     * Fixes MAJOR-002: Member count synchronization
     */
    async recalculateMemberCount(communityId: string): Promise<number> {
        const id = this.validateObjectId(communityId, 'community ID');
        
        const community = await this.db.collection('communities').findOne({
            _id: id
        }, {
            projection: { members: 1 }
        }) as Pick<Community, 'members'> | null;

        if (!community) {
            throw new Error('Community not found');
        }

        const actualCount = community.members?.length || 0;

        // Update the stored count
        await this.db.collection('communities').updateOne(
            { _id: id },
            { $set: { memberCount: actualCount } }
        );

        return actualCount;
    }

    /**
     * Validates comment path and calculates depth
     */
    validateCommentPath(path: string): { valid: boolean; depth: number } {
        if (!path || typeof path !== 'string') {
            return { valid: false, depth: 0 };
        }

        const parts = path.split('/').filter(p => p.length > 0);
        
        // Max depth of 5 to prevent infinite nesting
        if (parts.length > 5) {
            return { valid: false, depth: parts.length };
        }

        // Validate each part is a valid ObjectId
        const allValid = parts.every(part => ObjectId.isValid(part));
        
        return { valid: allValid, depth: parts.length };
    }
}

// ============================================================================
// SINGLETON FACTORY
// ============================================================================

let communityServiceInstance: CommunityService | null = null;

/**
 * Gets the singleton CommunityService instance
 */
export async function getCommunityService(): Promise<CommunityService> {
    if (!communityServiceInstance) {
        const client = await clientPromise;
        const db = client.db('bookex');
        communityServiceInstance = new CommunityService(db);
    }
    return communityServiceInstance;
}

/**
 * Creates a new CommunityService instance with custom database
 * Useful for testing
 */
export function createCommunityService(db: Db): CommunityService {
    return new CommunityService(db);
}
