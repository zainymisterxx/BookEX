/**
 * Database optimization utilities for MongoDB operations
 * Enhanced with TTL policies and maintenance features
 */

import { MongoClient } from 'mongodb';
import clientPromise from './mongodb';
import { TTL_CONFIG } from './database-maintenance';

export interface IndexDefinition {
  collection: string;
  index: Record<string, 1 | -1 | 'text'>;
  options?: {
    name?: string;
    unique?: boolean;
    sparse?: boolean;
    background?: boolean;
    expireAfterSeconds?: number;
  };
}

/**
 * Recommended indexes for optimal query performance
 */
export const RECOMMENDED_INDEXES: IndexDefinition[] = [
  // Books collection indexes
  {
    collection: 'books',
    index: { type: 1, city: 1, createdAt: -1 },
    options: { name: 'type_city_created', background: true }
  },
  {
    collection: 'books',
    index: { sellerId: 1, createdAt: -1 },
    options: { name: 'seller_created', background: true }
  },
  {
    collection: 'books',
    index: { genre: 1, condition: 1 },
    options: { name: 'genre_condition', background: true }
  },
  {
    collection: 'books',
    index: { title: 'text', author: 'text', description: 'text' },
    options: { name: 'text_search', background: true }
  },
  {
    collection: 'books',
    index: { price: 1 },
    options: { name: 'price_index', sparse: true, background: true }
  },

  // Users collection indexes
  {
    collection: 'users',
    index: { email: 1 },
    options: { name: 'email_unique', unique: true, background: true }
  },
  {
    collection: 'users',
    index: { city: 1 },
    options: { name: 'city_index', background: true }
  },
  {
    collection: 'users',
    index: { 'wishlist.bookId': 1 },
    options: { name: 'wishlist_bookId_search', background: true }
  },

  // Communities collection indexes
  {
    collection: 'communities',
    index: { createdBy: 1, createdAt: -1 },
    options: { name: 'creator_created', background: true }
  },
  {
    collection: 'communities',
    index: { members: 1 },
    options: { name: 'members_index', background: true }
  },
  {
    collection: 'communities',
    index: { name: 'text', description: 'text' },
    options: { name: 'community_text_search', background: true }
  },

  // Notifications collection indexes with TTL
  {
    collection: 'notifications',
    index: { userId: 1, read: 1, createdAt: -1 },
    options: { name: 'user_notifications', background: true }
  },
  {
    collection: 'notifications',
    index: { 'metadata.deduplicationKey': 1 },
    options: { name: 'notification_deduplication', background: true }
  },
  {
    collection: 'notifications',
    index: { createdAt: 1 },
    options: { 
      name: 'notification_expiry', 
      expireAfterSeconds: TTL_CONFIG.NOTIFICATIONS, // 30 days TTL
      background: true 
    }
  },

  // Chats collection indexes
  {
    collection: 'chats',
    index: { participants: 1, lastMessageAt: -1 },
    options: { name: 'chat_participants', background: true }
  },
  {
    collection: 'chats',
    index: { bookId: 1 },
    options: { name: 'book_chats', background: true }
  },

  // Reports collection indexes
  {
    collection: 'reports',
    index: { reportedUserId: 1, status: 1 },
    options: { name: 'reported_user_status', background: true }
  },
  {
    collection: 'reports',
    index: { reporterId: 1, createdAt: -1 },
    options: { name: 'reporter_created', background: true }
  },

  // Reviews collection indexes
  {
    collection: 'reviews',
    index: { revieweeId: 1, createdAt: -1 },
    options: { name: 'reviewee_created', background: true }
  },
  {
    collection: 'reviews',
    index: { reviewerId: 1 },
    options: { name: 'reviewer_index', background: true }
  },

  // Organizations collection indexes
  {
    collection: 'organizations',
    index: { status: 1, createdAt: -1 },
    options: { name: 'status_created', background: true }
  },

  // Password reset tokens indexes with TTL
  {
    collection: 'password_reset_tokens',
    index: { token: 1 },
    options: { name: 'token_unique', unique: true, background: true }
  },
  {
    collection: 'password_reset_tokens',
    index: { expiresAt: 1 },
    options: { 
      name: 'token_expiry', 
      expireAfterSeconds: 0, // Use expiresAt field value
      background: true 
    }
  }
];

/**
 * Create all recommended indexes
 */
export async function createOptimalIndexes(): Promise<void> {
  try {
    const client = await clientPromise;
    const db = client.db('bookex');

    console.log('Creating database indexes for optimal performance...');

    for (const indexDef of RECOMMENDED_INDEXES) {
      try {
        const collection = db.collection(indexDef.collection);
        await collection.createIndex(indexDef.index, indexDef.options);
        console.log(`✓ Created index ${indexDef.options?.name || 'unnamed'} on ${indexDef.collection}`);
      } catch (error) {
        // Index might already exist, which is fine
        if (error instanceof Error && error.message.includes('already exists')) {
          console.log(`- Index ${indexDef.options?.name || 'unnamed'} already exists on ${indexDef.collection}`);
        } else {
          console.error(`✗ Failed to create index on ${indexDef.collection}:`, error);
        }
      }
    }

    console.log('Database index creation completed.');
  } catch (error) {
    console.error('Failed to create database indexes:', error);
    throw error;
  }
}

/**
 * Get index usage statistics
 */
export async function getIndexStats(collectionName: string): Promise<any[]> {
  try {
    const client = await clientPromise;
    const db = client.db('bookex');
    const collection = db.collection(collectionName);

    const stats = await collection.aggregate([
      { $indexStats: {} }
    ]).toArray();

    return stats;
  } catch (error) {
    console.error(`Failed to get index stats for ${collectionName}:`, error);
    return [];
  }
}

/**
 * Optimized query builders for common operations
 */
export class OptimizedQueries {
  /**
   * Optimized book search with pagination
   */
  static async searchBooks(filters: {
    type?: 'sell' | 'exchange';
    city?: string;
    genre?: string;
    condition?: string;
    searchText?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
  }) {
    const client = await clientPromise;
    const db = client.db('bookex');
    const collection = db.collection('books');

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100); // Max 100 items per page
    const skip = (page - 1) * limit;

    // Build optimized query
    const query: any = {};
    
    if (filters.type) query.type = filters.type;
    if (filters.city) query.city = filters.city;
    if (filters.genre) query.genre = filters.genre;
    if (filters.condition) query.condition = filters.condition;
    
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.price = {};
      if (filters.minPrice !== undefined) query.price.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) query.price.$lte = filters.maxPrice;
    }

    // Text search (uses text index)
    if (filters.searchText) {
      query.$text = { $search: filters.searchText };
    }

    // Use efficient aggregation pipeline
    const pipeline = [
      { $match: query },
      { $sort: filters.searchText ? { score: { $meta: 'textScore' }, createdAt: -1 } : { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'sellerId',
          foreignField: '_id',
          as: 'seller',
          pipeline: [{ $project: { name: 1, avatarUrl: 1, city: 1 } }]
        }
      },
      { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } }
    ];

    const [results, totalCount] = await Promise.all([
      collection.aggregate(pipeline).toArray(),
      collection.countDocuments(query)
    ]);

    return {
      books: results,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Optimized wishlist matching for new book listings using bookId
   */
  static async findWishlistMatches(bookId: string) {
    const client = await clientPromise;
    const db = client.db('bookex');
    const collection = db.collection('users');

    if (!bookId || typeof bookId !== 'string') {
      return [];
    }

    try {
      // Find users who have this bookId in their wishlist
      const users = await collection.find(
        {
          'wishlist.bookId': bookId
        },
        {
          projection: { _id: 1, name: 1, wishlist: 1 },
          hint: 'wishlist_bookId_search' // Use specific index
        }
      ).toArray();

      return users;
    } catch (error) {
      console.error('Error in findWishlistMatches:', error);
      return [];
    }
  }

  /**
   * Optimized user notifications query
   */
  static async getUserNotifications(userId: string, page = 1, limit = 20) {
    const client = await clientPromise;
    const db = client.db('bookex');
    const collection = db.collection('notifications');

    const skip = (page - 1) * limit;

    const [notifications, unreadCount] = await Promise.all([
      collection.find(
        { userId },
        { 
          sort: { createdAt: -1 },
          skip,
          limit
        }
      ).toArray(),
      collection.countDocuments({ userId, read: false })
    ]);

    return { notifications, unreadCount };
  }

  /**
   * Optimized community search
   */
  static async searchCommunities(searchText?: string, page = 1, limit = 20) {
    const client = await clientPromise;
    const db = client.db('bookex');
    const collection = db.collection('communities');

    const skip = (page - 1) * limit;
    const query = searchText ? { $text: { $search: searchText } } : {};
    const sort: any = searchText ? { score: { $meta: 'textScore' }, memberCount: -1 } : { memberCount: -1, createdAt: -1 };

    const [communities, total] = await Promise.all([
      collection.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(query)
    ]);

    return {
      communities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

/**
 * Performance monitoring for slow queries
 */
export async function enableSlowQueryLogging(): Promise<void> {
  try {
    const client = await clientPromise;
    const db = client.db('bookex');

    // Enable profiling for slow operations (>100ms)
    await db.command({
      profile: 2,
      slowms: 100,
      sampleRate: 1.0
    });

    console.log('Enabled slow query logging (>100ms)');
  } catch (error) {
    console.error('Failed to enable slow query logging:', error);
  }
}

/**
 * Get slow query statistics
 */
export async function getSlowQueries(limit = 10): Promise<any[]> {
  try {
    const client = await clientPromise;
    const db = client.db('bookex');

    const slowQueries = await db.collection('system.profile')
      .find({ 'millis': { $gt: 100 } })
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();

    return slowQueries;
  } catch (error) {
    console.error('Failed to get slow queries:', error);
    return [];
  }
}
