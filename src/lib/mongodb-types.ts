/**
 * MongoDB type utilities for better TypeScript support
 */

import { ObjectId, UpdateFilter } from 'mongodb';

// Define our specific document types for better type safety
export interface UserDocument {
  _id: ObjectId;
  email: string;
  name: string;
  image?: string;
  city?: string;
  wishlist: WishlistItem[];
  createdAt: string;
}

export interface BookDocument {
  _id: ObjectId;
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
  genre: string;
  status?: string;
  expiresAt?: string;
  titleNormalized?: string;
  authorNormalized?: string;
  duplicateHash?: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface ChatDocument {
  _id: ObjectId;
  participants: string[];
  bookId: string;
  messages: MessageDocument[];
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDocument {
  _id: ObjectId;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface CommunityDocument {
  _id: ObjectId;
  name: string;
  description: string;
  createdBy: string;
  // Role-based members
  members: Array<{
    userId: string;
    role: 'admin' | 'moderator' | 'member';
    joinedAt: string;
    banned?: boolean;
    banReason?: string;
    bannedAt?: string;
  }>;
  memberCount: number;
  // Legacy embedded posts (will be deprecated after migration)
  posts?: PostDocument[];
  city: string;
  createdAt: string;
}

// New collections
export interface PostDocument {
  _id: ObjectId;
  communityId: ObjectId;
  authorId: string;
  author?: { _id: string; name: string; avatarUrl?: string };
  content: string; // Markdown
  likes: number;
  likedBy: string[];
  commentCount: number;
  createdAt: string;
  editedAt?: string;
  editHistory?: Array<{ content: string; editedAt: string }>;
  isPinned?: boolean;
  isLocked?: boolean;
  status?: 'active' | 'removed' | 'flagged';
  deletedAt?: string;
  deletedBy?: string;
}

export interface CommentDocument {
  _id: ObjectId;
  postId: ObjectId;
  communityId: ObjectId;
  authorId: string;
  author?: { _id: string; name: string; avatarUrl?: string };
  content: string; // Markdown
  createdAt: string;
  editedAt?: string;
  parentId?: ObjectId | null;
  path?: string;
  reactions?: Array<{ userId: string; type: string; reactedAt: string }>;
  editHistory?: Array<{ content: string; editedAt: string }>;
}

export interface WishlistItem {
  bookId: string;
  title: string;
  author: string;
  addedAt: string;
}

// Type-safe update operations
export type UserUpdateFilter = UpdateFilter<UserDocument>;
export type BookUpdateFilter = UpdateFilter<BookDocument>;
export type ChatUpdateFilter = UpdateFilter<ChatDocument>;
export type CommunityUpdateFilter = UpdateFilter<CommunityDocument>;

// Helper functions for type-safe operations
export function createUserUpdate(update: Partial<UserDocument>): UserUpdateFilter {
  return { $set: update } as UserUpdateFilter;
}

export function createWishlistAddOperation(item: WishlistItem): UpdateFilter<UserDocument> {
  // NOTE: driver limitation — $addToSet with nested object requires cast
  return { $addToSet: { wishlist: item } } as UpdateFilter<UserDocument>;
}

export function createWishlistRemoveOperation(item: WishlistItem): UpdateFilter<UserDocument> {
  // NOTE: driver limitation — $pull with nested object requires cast
  return { $pull: { wishlist: item } } as UpdateFilter<UserDocument>;
}

export function createCommunityMemberAddOperation(userId: string): UpdateFilter<CommunityDocument> {
  // NOTE: driver limitation — $addToSet on array-of-objects field requires cast
  return {
    $addToSet: { members: userId },
    $inc: { memberCount: 1 }
  } as UpdateFilter<CommunityDocument>;
}

export function createCommunityMemberRemoveOperation(userId: string): UpdateFilter<CommunityDocument> {
  // NOTE: driver limitation — $pull on array-of-objects field requires cast
  return {
    $pull: { members: userId },
    $inc: { memberCount: -1 }
  } as UpdateFilter<CommunityDocument>;
}

export function createChatMessageAddOperation(message: Omit<MessageDocument, '_id'>): UpdateFilter<ChatDocument> {
  const messageWithId = {
    _id: new ObjectId(),
    ...message
  };
  // NOTE: driver limitation — $push with nested document requires cast
  return {
    $push: { messages: messageWithId },
    $set: {
      lastMessage: message.text,
      updatedAt: new Date().toISOString()
    }
  } as UpdateFilter<ChatDocument>;
}

export function createPostAddOperation(post: Omit<PostDocument, '_id'>): UpdateFilter<CommunityDocument> {
  const postWithId = {
    _id: new ObjectId(),
    ...post
  };
  // NOTE: driver limitation — $push with $each/$sort on nested array requires cast
  return {
    $push: {
      posts: {
        $each: [postWithId],
        $sort: { createdAt: -1 }
      }
    }
  } as UpdateFilter<CommunityDocument>;
}

export function createPostLikeToggleOperation(postId: string, userId: string, isLiked: boolean): UpdateFilter<CommunityDocument> {
  // NOTE: driver limitation — positional operator paths on nested arrays require cast
  if (isLiked) {
    return {
      $pull: { "posts.$.likedBy": userId },
      $inc: { "posts.$.likes": -1 }
    } as UpdateFilter<CommunityDocument>;
  } else {
    return {
      $addToSet: { "posts.$.likedBy": userId },
      $inc: { "posts.$.likes": 1 }
    } as UpdateFilter<CommunityDocument>;
  }
}

export function createCommentAddOperation(postId: string, comment: Omit<CommentDocument, '_id'>): UpdateFilter<CommunityDocument> {
  const commentWithId = {
    _id: new ObjectId(),
    ...comment
  };
  // NOTE: driver limitation — $push on positional nested path requires cast
  return {
    $push: { "posts.$.comments": commentWithId }
  } as UpdateFilter<CommunityDocument>;
}
