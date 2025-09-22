/**
 * MongoDB type utilities for better TypeScript support
 */

import { ObjectId, UpdateFilter, PushOperator, PullOperator } from 'mongodb';

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
  type: 'sell' | 'exchange';
  description: string;
  genre: string;
  createdAt: string;
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

export function createWishlistAddOperation(item: WishlistItem): any {
  return { $addToSet: { wishlist: item } };
}

export function createWishlistRemoveOperation(item: WishlistItem): any {
  return { $pull: { wishlist: item } };
}

export function createCommunityMemberAddOperation(userId: string): any {
  return { 
    $addToSet: { members: userId }, 
    $inc: { memberCount: 1 } 
  };
}

export function createCommunityMemberRemoveOperation(userId: string): any {
  return { 
    $pull: { members: userId }, 
    $inc: { memberCount: -1 } 
  };
}

export function createChatMessageAddOperation(message: Omit<MessageDocument, '_id'>): any {
  const messageWithId = {
    _id: new ObjectId(),
    ...message
  };
  
  return {
    $push: { messages: messageWithId },
    $set: { 
      lastMessage: message.text,
      updatedAt: new Date().toISOString()
    }
  };
}

export function createPostAddOperation(post: Omit<PostDocument, '_id'>): any {
  const postWithId = {
    _id: new ObjectId(),
    ...post
  };
  
  return {
    $push: { 
      posts: { 
        $each: [postWithId], 
        $sort: { createdAt: -1 } 
      } 
    }
  };
}

export function createPostLikeToggleOperation(postId: string, userId: string, isLiked: boolean): any {
  if (isLiked) {
    return {
      $pull: { "posts.$.likedBy": userId },
      $inc: { "posts.$.likes": -1 }
    };
  } else {
    return {
      $addToSet: { "posts.$.likedBy": userId },
      $inc: { "posts.$.likes": 1 }
    };
  }
}

export function createCommentAddOperation(postId: string, comment: Omit<CommentDocument, '_id'>): any {
  const commentWithId = {
    _id: new ObjectId(),
    ...comment
  };
  
  return {
    $push: { "posts.$.comments": commentWithId }
  };
}
