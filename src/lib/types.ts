
import type { ObjectId } from 'mongodb';

export type BookGenre = "fantasy" | "sci-fi" | "mystery" | "romance" | "self-help" | "historical-fiction" | "other";

export type BookStatus = 'active' | 'sold' | 'exchanged' | 'inactive' | 'expired';

export interface Book {
  _id: ObjectId | string;
  title: string;
  author: string;
  price?: number;
  condition: 'new' | 'like-new' | 'used' | 'worn';
  imageUrl: string;
  sellerId: string;
  city: string;
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
}

export interface WishlistItem {
  bookId: string; // Reference to the book document ID
  addedAt: string; // When the book was added to wishlist
}

export interface User {
  _id: ObjectId | string;
  name: string;
  email: string;
  password?: string; // Hashed password
  avatarUrl?: string;
  city?: string;
  phone?: string; // Added for profile completion
  bio?: string; // Added for profile completion
  interests?: string[]; // Added for profile completion
  birthDate?: string; // ISO 8601 date string (UTC) - Added for profile completion
  reviews?: number; // Total number of reviews
  totalRatingPoints?: number; // Sum of all ratings
  averageRating?: number; // Calculated on read: totalRatingPoints / reviews
  role?: 'user' | 'admin';
  status?: 'active' | 'suspended' | 'deactivated'; // User account status
  profileCompleted?: boolean; // Whether user has completed their profile
  createdAt?: string; // ISO 8601 date string (UTC) - when account was created
  updatedAt?: string; // ISO 8601 date string (UTC) - Last profile update timestamp
  wishlist?: WishlistItem[];
  communities?: ObjectId[]; // Array of community IDs the user is a member of
  emailPreferences?: {
    exchangeProposals: boolean;      // Email when someone proposes an exchange
    exchangeUpdates: boolean;        // Email when exchange status changes
    contactNotifications: boolean;   // Email when someone contacts about your book
    weeklyDigest: boolean;          // Weekly summary of new books in your area
  };
}

export interface Community {
  _id: ObjectId | string;
  name: string;
  description: string;
  memberCount: number;
  imageUrl: string;
  // Role-based membership for per-community permissions
  members: Array<{
    userId: string;
    role: CommunityRole; // 'admin' | 'moderator' | 'member'
    joinedAt: string;
    banned?: boolean;
    banReason?: string;
    bannedAt?: string;
  }>;
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
  createdBy: string;
}

export type CommunityRole = 'admin' | 'moderator' | 'member';

export interface Post {
  _id: ObjectId | string;
  authorId: string;
  author?: {
    _id: string;
    name: string;
    avatarUrl?: string;
  };
  content: string; // Markdown supported
  communityId: string;
  likes: number;
  likedBy?: string[]; // Array of user IDs who liked the post
  // Comments moved to separate collection; keep optional for legacy reads
  comments?: Comment[];
  commentCount?: number;
  createdAt: string; // ISO 8601 date string
  editedAt?: string; // ISO 8601 date string for edited posts
  editHistory?: Array<{ content: string; editedAt: string }>;
}

export interface Comment {
  _id: ObjectId | string;
  author: {
    _id: string;
    name: string;
    avatarUrl?: string;
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
}

export interface Message {
    _id: ObjectId | string;
    senderId: string;
    text: string;
    createdAt: string; // ISO 8601 date string
}

export interface Chat {
    _id: ObjectId | string;
    participantIds: string[];
    bookId?: ObjectId;
    organizationId?: ObjectId;
    exchangeId?: ObjectId | string;    // NEW: Optional link to exchange
    lastMessage?: string;
    updatedAt: string; // ISO 8601 date string
    messages?: Message[]; // Messages can be embedded
    // For UI display
    otherParticipant?: User;
    book?: Book;
    organization?: Organization;
    exchange?: Exchange;           // NEW: Optional exchange data for UI
}

export interface Review {
    _id: ObjectId | string;
    reviewerId: string;
    revieweeId: string;
    rating: number;
    comment: string;
    createdAt: string; // ISO 8601 date string
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
    type: 'wishlist_match' | 'message' | 'exchange_proposal' | 'exchange_update' | 'system' | 'community';
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
        [key: string]: any;
    };
}

export interface PasswordResetToken {
    _id: ObjectId | string;
    userId: string;
    token: string;
    expiresAt: string; // ISO 8601 date string
    used: boolean;
    createdAt: string; // ISO 8601 date string
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
