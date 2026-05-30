
import type { ObjectId } from 'mongodb';

export const USER_ROLES = ['visitor', 'user', 'admin', 'organization'] as const;
export type UserRole = typeof USER_ROLES[number];

export const USER_STATUSES = ['active', 'suspended', 'deactivated'] as const;
export type UserStatus = typeof USER_STATUSES[number];

export type BookGenre = "fantasy" | "sci-fi" | "mystery" | "romance" | "self-help" | "historical-fiction" | "other";

export type BookStatus = 'active' | 'on_hold' | 'sold' | 'exchanged' | 'inactive' | 'expired' | 'reserved' | 'donated';

export interface Book {
  _id: ObjectId | string;
  title: string;
  author: string;
  price?: number;
  condition: 'new' | 'like-new' | 'used' | 'worn';
  imageUrl: string;
  sellerId: string;
  city: string;
  cityNormalized?: string;
  type: 'sell' | 'exchange';
  description: string;
  genre: BookGenre;
  status: BookStatus; // Track book availability
  createdAt: string; // ISO 8601 date string (UTC)
  updatedAt: string; // ISO 8601 date string (UTC) - Last modification timestamp
  expiresAt?: string; // ISO 8601 date string (UTC) - Optional expiration date for listings
  // Deduplication fields
  titleNormalized: string; // Normalized title for duplicate detection
  authorNormalized: string; // Normalized author for duplicate detection
  duplicateHash: string; // Hash for quick duplicate detection
  // Engagement analytics
  viewCount?: number;
  contactCount?: number;
  reportCount?: number;
}

export interface WishlistItem {
  bookId: string; // Reference to the book document ID
  addedAt: string; // When the book was added to wishlist
}

export interface User {
  _id: ObjectId | string;
  id?: string;
  name: string;
  username?: string; // unique, lowercase handle for public references
  email: string;
  password?: string; // Hashed password
  avatarUrl?: string;
  city?: string;
  cityName?: string;
  cityNormalized?: string;
  phone?: string; // Added for profile completion
  bio?: string; // Added for profile completion
  interests?: string[]; // Added for profile completion
  birthDate?: string; // ISO 8601 date string (UTC) - Added for profile completion
  reviews?: number; // Total number of reviews
  totalRatingPoints?: number; // Sum of all ratings
  averageRating?: number; // Calculated on read: totalRatingPoints / reviews
  role?: UserRole;
  status?: UserStatus; // User account status
  suspendedAt?: string; // ISO 8601 date string (UTC) - when account was suspended
  suspensionReason?: string | null; // Reason provided at suspension time
  deactivatedAt?: string; // ISO 8601 date string (UTC) - when account was deactivated
  emailVerified?: boolean;
  emailVerifiedAt?: string; // ISO 8601 date string (UTC)
  lastLoginAt?: string; // ISO 8601 date string (UTC)
  failedLoginAttempts?: number;
  createdAt?: string; // ISO 8601 date string (UTC) - when account was created
  updatedAt?: string; // ISO 8601 date string (UTC) - Last profile update timestamp
  wishlist?: WishlistItem[];
  communities?: ObjectId[]; // Array of community IDs the user is a member of
  emailPreferences?: {
    exchangeProposals: boolean;      // Email when someone proposes an exchange
    exchangeUpdates: boolean;        // Email when exchange status changes
    contactNotifications: boolean;   // Email when someone contacts about your book
    weeklyDigest: boolean;          // Weekly summary of new books in your area
    communityMentions?: boolean;     // Email when mentioned in a community post
    commentReplies?: boolean;        // Email when someone replies to your comment
    reviewReceived?: boolean;        // Email when you receive a review
    adminActions?: boolean;          // Email for admin actions affecting your account
  };
}

export interface Community {
  _id: ObjectId | string;
  name: string;
  description: string;
  memberCount: number;
  postCount?: number;
  imageUrl: string;
  coverImage?: string;
  rules?: string; // Markdown, max 5000 chars

  // Privacy & permissions
  visibility: 'public' | 'private'; // 'public' = anyone can join, 'private' = requires approval
  postingPermissions: PostingPermission;
  commentPermissions: CommentPermission;
  invitePermissions: InvitePermission;

  // Role-based membership for per-community permissions
  members: Array<{
    userId: string;
    role: CommunityRole;
    joinedAt: string;
    banned?: boolean;
    banReason?: string;
    bannedAt?: string;
    bannedBy?: string;
  }>;

  // Pending join requests (private communities)
  pendingRequests?: JoinRequest[];

  // Channel-based structure
  channels: Array<{
    _id: string;
    name: string;
    type: 'forum' | 'chat';
    description?: string;
    order: number;
    createdAt: string;
  }>;

  // Backward compatibility: some communities might still have embedded posts until migration
  posts?: Post[];

  // Ownership & audit
  createdBy: string; // userId of current owner (creator / transferred-to user)
  deletedAt?: string;
}

export type CommunityRole = 'creator' | 'admin' | 'moderator' | 'member';

export type PostingPermission = 'anyone' | 'members_only' | 'admins_only';
export type CommentPermission = 'anyone' | 'members_only' | 'admins_only';
export type InvitePermission = 'anyone' | 'admins_only';

export interface JoinRequest {
  _id?: ObjectId | string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  communityId: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export type CommunityAdminActionType =
  | 'member_promoted'
  | 'member_demoted'
  | 'member_removed'
  | 'member_banned'
  | 'member_unbanned'
  | 'join_request_approved'
  | 'join_request_rejected'
  | 'post_pinned'
  | 'post_unpinned'
  | 'post_locked'
  | 'post_unlocked'
  | 'post_deleted'
  | 'comment_deleted'
  | 'settings_updated'
  | 'ownership_transferred';

export interface CommunityModerationLog {
  _id?: ObjectId | string;
  communityId: string;
  actorId: string;
  actorName: string;
  actionType: CommunityAdminActionType;
  targetUserId?: string;
  targetUserName?: string;
  targetContentId?: string;
  targetContentType?: 'post' | 'comment' | 'member' | 'community';
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Post {
  _id: ObjectId | string;
  authorId: string;
  author?: {
    _id: string;
    name: string;
    avatarUrl?: string;
    role?: CommunityRole;
  };
  content: string; // Markdown supported
  communityId: string;
  channelId?: string;
  likes: number;
  likedBy?: string[]; // Array of user IDs who liked the post
  // Comments moved to separate collection; keep optional for legacy reads
  comments?: Comment[];
  commentCount?: number;
  createdAt: string; // ISO 8601 date string
  editedAt?: string; // ISO 8601 date string for edited posts
  editHistory?: Array<{ content: string; editedAt: string }>;

  // Moderation fields (admin/moderator actions)
  isPinned?: boolean;   // Pinned posts appear at top of feed
  isLocked?: boolean;   // Locked posts prevent new comments
  pinnedAt?: string;    // ISO 8601 when pinned
  pinnedBy?: string;    // userId who pinned
  lockedAt?: string;    // ISO 8601 when locked
  lockedBy?: string;    // userId who locked
  deletedAt?: string;   // Soft delete timestamp
  deletedBy?: string;   // userId who deleted (admin/mod)
  status?: 'published' | 'quarantined' | 'deleted';
}

export interface Comment {
  _id: ObjectId | string;
  author: {
    _id: string;
    name: string;
    avatarUrl?: string;
    role?: CommunityRole;
  };
  content: string;
  createdAt: string;
  editedAt?: string;
  postId: string;
  parentId?: string | null; // For nested/threaded comments
  path?: string; // Materialized path for efficient thread queries (e.g., root/child/child2)
  reactions?: Array<{ userId: string; type: string; reactedAt: string }>; // simple emoji reactions
  editHistory?: Array<{ content: string; editedAt: string }>;
}

export interface ChatMessage {
  _id: ObjectId | string;
  channelId: string;
  author: {
    _id: string;
    name: string;
    avatarUrl?: string;
    role?: CommunityRole;
  };
  content: string;
  createdAt: string;
  editedAt?: string;
  reactions?: Array<{ userId: string; type: string; reactedAt: string }>;
  editHistory?: Array<{ content: string; editedAt: string }>;
}

export interface OrganizationRepresentative {
  userId: string;              // Real user ID
  role: 'admin' | 'member';    // Admin can manage org, members can respond to chats
  addedAt: string;
  addedBy: string;
}

export interface Organization {
  _id: ObjectId | string;
  name: string;
  description: string;
  imageUrl: string;
  location: string;
  status: 'approved' | 'pending' | 'rejected';
  submittedBy: string;
  createdAt: string; // ISO 8601 date string
  // Enhanced fields (optional for backward compatibility)
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  updatedAt?: string;
  isActive?: boolean;  // For suspend/activate functionality (default: true)
  // NEW: Representatives system for handling donations
  representatives?: OrganizationRepresentative[];
  primaryContactId?: string;   // Main contact person (real user ID)
}

export interface MessageAttachment {
    id: string;                      // Unique attachment ID
    type: 'image' | 'document' | 'spreadsheet' | 'other';
    fileName: string;                // Original filename
    fileSize: number;                // Size in bytes
    mimeType: string;                // MIME type (image/jpeg, application/pdf, etc.)
    url: string;                     // Storage URL or data URI
    thumbnailUrl?: string;           // Thumbnail for images
    uploadedAt: string;              // ISO 8601 timestamp
}

export interface Message {
    _id: ObjectId | string;
    senderId: string;
  // Some parts of the code (personal messages) use `content`, others (chat) use `text`.
  // Keep both for backward compatibility; prefer `text` in UI, fall back to `content`.
  text?: string;
  content?: string;
  createdAt: string; // ISO 8601 date string
  read?: boolean;            // Whether the recipient has read the message
  readAt?: string;           // Timestamp when the message was read
  attachments?: MessageAttachment[];  // File attachments (images, PDFs, etc.)
  replyTo?: ObjectId | string;        // Message ID this is replying to
}

export interface Chat {
    _id: ObjectId | string;
    participantIds: string[];
    bookId?: ObjectId;
    organizationId?: ObjectId;
    exchangeId?: ObjectId | string;    // Optional link to exchange
    donationId?: ObjectId | string;    // NEW: Optional link to donation
    
    // Soft delete support
    organizationDeleted?: boolean;     // True if organization was deleted
    organizationDeletedAt?: string;    // Timestamp when org was deleted
    
    // User-specific settings
    deletedBy?: string[];              // Users who deleted this chat (soft delete)
    
    lastMessage?: string;
    lastMessageAt?: string; // ISO 8601 date string
    lastMessagePreview?: string;
    unreadCountByParticipant?: Record<string, number>;
    updatedAt: string; // ISO 8601 date string
    messages?: Message[]; // Messages can be embedded
    // For UI display
    otherParticipant?: User;
    book?: Book;
    organization?: Organization;
    exchange?: Exchange;           // Optional exchange data for UI
    donation?: Donation;           // NEW: Optional donation data for UI
}

export interface Review {
    _id: ObjectId | string;
    reviewerId: string;
    revieweeId: string;
    rating: number;
    comment: string;
    createdAt: string; // ISO 8601 date string
    transactionId?: string; // ObjectId of the exchange or donation this review is for
}

export interface Report {
    _id: ObjectId | string;
    reporterId: string;
    reportedUserId: string;
    reportedContentId: string;
    reportedContentType: 'book' | 'user' | 'post' | 'comment' | 'community';
    reason: string;
    details?: string;
    description?: string; // Optional description field for backward compatibility
    reporterName?: string; // Reporter's name for admin display
    status: 'pending' | 'resolved' | 'dismissed';
    createdAt: string; // ISO 8601 date string
    resolvedAt?: string;
    resolvedBy?: string;
    resolutionNotes?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface ModerationAction {
    _id: ObjectId | string;
    moderatorId: string;
    actionType: 'warn' | 'suspend' | 'ban' | 'delete_content' | 'restore_content';
    targetUserId: string;
    targetContentId?: string;
    targetContentType?: 'book' | 'post' | 'comment' | 'community' | 'profile';
    reason: string;
    duration?: number; // Duration in days for temporary actions
    createdAt: string;
    expiresAt?: string;
}

export interface ContentFilter {
    _id: ObjectId | string;
    pattern: string;
    type: 'word' | 'regex';
    severity: 'low' | 'medium' | 'high';
    action: 'flag' | 'block' | 'warn';
    isActive: boolean;
    createdBy: string;
    createdAt: string;
    matchCount: number;
}

export interface Notification {
    _id: ObjectId | string;
    userId: string;
    type: 'wishlist_match' | 'message' | 'exchange_proposal' | 'exchange_update' | 'system' | 'community' | 'donation_request' | 'donation_update' | 'donation_completed';
    title: string;
    message: string;
    link: string;
    read: boolean;
    createdAt: string; // ISO 8601 date string
    metadata?: {
        bookId?: string;
        chatId?: string;
        exchangeId?: string;
        communityId?: string;
        donationId?: string;     // NEW: For donation notifications
        organizationId?: string; // NEW: For organization-related notifications
        [key: string]: any;
    };
}

export interface BookOwnershipHistoryEntry {
  _id?: ObjectId | string;
  bookId: string;
  previousOwnerId?: string | null;
  newOwnerId: string;
  exchangeId?: string;
  timestamp: string; // ISO 8601
}

export interface PasswordResetToken {
    _id: ObjectId | string;
    userId: string;
    token: string;
    expiresAt: string; // ISO 8601 date string
    used: boolean;
    createdAt: string; // ISO 8601 date string
}

export interface EmailVerificationToken {
    _id?: ObjectId | string;
    userId: string;
    email: string;
    token: string;       // random hex, 32 bytes
    expiresAt: string;   // ISO, 24h from creation
    usedAt?: string;
    createdAt: string;
}

// Exchange Status Tracking Types
export enum ExchangeStatus {
    PROPOSED = 'proposed',        // Initial proposal sent
    ACCEPTED = 'accepted',        // Both parties agreed
    IN_PROGRESS = 'in_progress',  // Books being exchanged
    COMPLETED = 'completed',      // Exchange finished successfully
    CANCELLED = 'cancelled',      // Exchange cancelled by either party
    DISPUTED = 'disputed'         // Dispute raised, needs resolution
}

export interface ExchangeStatusUpdate {
    status: ExchangeStatus;
    timestamp: string;
    updatedBy: string;            // User ID who made the update
    notes?: string;               // Optional notes for the status change
}

export interface Exchange {
    _id: ObjectId | string;
    
    // Participants
    proposerId: string;           // User who initiated the exchange
    responderId: string;          // User who received the proposal
    
    // Books being exchanged
    proposerBookId: ObjectId | string;     // Book offered by proposer
    responderBookId: ObjectId | string;    // Book requested from responder
    
    // Status tracking
    status: ExchangeStatus;
    statusHistory: ExchangeStatusUpdate[];
    
    // Integration with existing chat system
    chatId: ObjectId | string;             // Link to existing chat
    
    // Timestamps
    proposedAt: string;           // When exchange was proposed
    acceptedAt?: string;          // When exchange was accepted
    completedAt?: string;         // When exchange was completed
    updatedAt: string;
    
    // Additional details
    proposalMessage?: string;     // Initial proposal message
    meetingLocation?: string;     // Where to meet for exchange
    
    // Completion tracking
    proposerConfirmed?: boolean;  // Did proposer confirm completion?
    responderConfirmed?: boolean; // Did responder confirm completion?
    
    // Dispute tracking
    disputeReason?: string;
    disputeOpenedAt?: string;     // ISO 8601 date string
    disputeResolvedAt?: string;   // ISO 8601 date string
    disputeResolvedBy?: string;   // Admin userId who resolved

    // Audit trail
    timeline?: Array<{ event: string; timestamp: string; byUserId: string; note?: string }>;

    // Ratings (after completion)
    proposerRating?: number;      // 1-5 rating from proposer
    responderRating?: number;     // 1-5 rating from responder
    proposerReview?: string;      // Optional review from proposer
    responderReview?: string;     // Optional review from responder

    // For UI display (populated when fetched)
    proposer?: User;
    responder?: User;
    proposerBook?: Book;
    responderBook?: Book;
}

// Donation System Types
export type DonationStatus = 
    | 'pending'          // Initial request sent, awaiting org confirmation
    | 'confirmed'        // Organization confirmed, ready to arrange
    | 'in_progress'      // Books being processed/transferred
    | 'completed'        // Donation finished successfully
    | 'cancelled'        // Donation cancelled by either party
    | 'rejected';        // Organization rejected the donation

export interface DonationBook {
    bookId?: ObjectId | string;     // Optional reference to listed book
    title: string;
    author: string;
    condition: 'new' | 'like-new' | 'used' | 'worn';
    quantity: number;
    notes?: string;
}

export interface DonationStatusUpdate {
    status: DonationStatus;
    timestamp: string;
    updatedBy: string;              // User ID who made the update
    notes?: string;
}

export interface Donation {
    _id: ObjectId | string;
    
    // Participants
    donorId: string;                // User donating books
    organizationId: ObjectId | string; // Organization receiving
    
    // Communication
    chatId: ObjectId | string;      // Link to chat for coordination
    
    // Books being donated
    books: DonationBook[];
    
    // Status tracking
    status: DonationStatus;
    statusHistory: DonationStatusUpdate[];
    
    // Logistics
    pickupDate?: string;            // Scheduled pickup/delivery date
    pickupLocation?: string;        // Where to pickup/deliver
    deliveryMethod?: 'donor_delivers' | 'org_picks_up';
    
    // Completion tracking
    orgConfirmed?: boolean;         // Did organization confirm receipt?
    orgConfirmedAt?: string;
    receivedDate?: string;          // When organization received donation
    receivedCondition?: string;     // Condition when received
    receiptNotes?: string;          // Organization's receipt notes
    confirmedBy?: string;           // User ID who confirmed receipt
    
    // Timestamps
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    lastUpdatedBy?: string;         // User ID who made last update
    
    // For UI display (populated when fetched)
    donor?: User;
    organization?: Organization;
}

// Admin Notification System Types
export type AdminNotificationType = 
    | 'new_user'                // New user registration
    | 'new_organization'        // Organization application
    | 'content_report'          // Content reported for moderation
    | 'security_alert'          // Security concern
    | 'system_error'            // System errors
    | 'performance_issue'       // Performance degradation
    | 'database_issue'          // Database problems
    | 'high_activity'           // Unusual activity patterns
    | 'moderation_required'     // Content needs review
    | 'user_complaint';         // User complaint

export type AdminNotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AdminNotification {
    _id: ObjectId | string;
    type: AdminNotificationType;
    priority: AdminNotificationPriority;
    title: string;
    message: string;
    details?: string;                    // Additional context
    actionUrl?: string;                  // URL to take action
    
    // Status
    read: boolean;
    resolved: boolean;
    resolvedAt?: string;
    resolvedBy?: string;                 // Admin user ID who resolved
    
    // Metadata for different notification types
    metadata?: {
        userId?: string;                 // Related user
        bookId?: string;                 // Related book
        organizationId?: string;         // Related organization
        reportId?: string;               // Related report
        errorCode?: string;              // Error identifier
        count?: number;                  // Count for aggregated notifications
        [key: string]: any;              // Flexible metadata
    };
    
    // Timestamps
    createdAt: string;
    updatedAt: string;
    
    // Auto-expiry for low-priority notifications
    expiresAt?: string;
}

// Admin notification aggregation for dashboard
export interface AdminNotificationSummary {
    total: number;
    unread: number;
    byPriority: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
    byType: {
        [key in AdminNotificationType]: number;
    };
    recent: AdminNotification[];
}
