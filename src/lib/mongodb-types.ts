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
  members: string[];
  memberCount: number;
  posts: PostDocument[];
  city: string;
  createdAt: string;
}

export interface PostDocument {
  _id: ObjectId;
  content: string;
  author: string;
  authorName: string;
  authorImage?: string;
  likes: number;
  likedBy: string[];
  comments: CommentDocument[];
  createdAt: string;
}

export interface CommentDocument {
  _id: ObjectId;
  content: string;
  author: string;
  authorName: string;
  authorImage?: string;
  createdAt: string;
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
