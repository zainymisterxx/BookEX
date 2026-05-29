/**
 * Database cleanup and maintenance utilities for BookEx
 * 
 * This module handles:
 * 1. TTL (Time To Live) for notifications and temporary data
 * 2. Database index optimization and management
 * 3. Periodic cleanup of expired data
 * 4. Performance monitoring and maintenance
 */

import clientPromise from './mongodb';
import { ObjectId } from 'mongodb';

/**
 * TTL configuration for different data types
 */
export const TTL_CONFIG = {
  // Notifications expire after 30 days
  NOTIFICATIONS: 30 * 24 * 60 * 60, // 30 days in seconds
  
  // Password reset tokens expire after 1 hour
  PASSWORD_RESET_TOKENS: 60 * 60, // 1 hour in seconds
  
  // Chat messages in deleted chats expire after 90 days
  DELETED_CHAT_MESSAGES: 90 * 24 * 60 * 60, // 90 days in seconds
  
  // Temporary files expire after 24 hours
  TEMP_FILES: 24 * 60 * 60, // 24 hours in seconds
  
  // Audit logs expire after 1 year
  AUDIT_LOGS: 365 * 24 * 60 * 60, // 1 year in seconds
};

/**
 * Critical database indexes for optimal performance
 */
export const CRITICAL_INDEXES = [
  // Users collection
  {
    collection: 'users',
    index: { email: 1 },
    options: { unique: true, background: true, name: 'email_unique' }
  },
  {
    collection: 'users',
    index: { 'wishlist.titleNormalized': 1, 'wishlist.authorNormalized': 1 },
    options: { background: true, name: 'wishlist_normalized_compound' }
  },
  {
    collection: 'users',
    index: { cityNormalized: 1, role: 1 },
    options: { background: true, name: 'users_location_role' }
  },

  // Books collection
  {
    collection: 'books',
    index: { sellerId: 1, createdAt: -1 },
    options: { background: true, name: 'books_seller_created' }
  },
  {
    collection: 'books',
    index: { type: 1, cityNormalized: 1, genre: 1 },
    options: { background: true, name: 'books_type_location_genre' }
  },
  {
    collection: 'books',
    index: { titleNormalized: 1, authorNormalized: 1 },
    options: { background: true, name: 'books_normalized_search' }
  },
  {
    collection: 'books',
    index: { title: 'text', author: 'text', description: 'text' },
    options: { background: true, name: 'books_text_search' }
  },

  // Notifications collection with TTL
  {
    collection: 'notifications',
    index: { userId: 1, read: 1, createdAt: -1 },
    options: { background: true, name: 'notifications_user_status' }
  },
  {
    collection: 'notifications',
    index: { createdAt: 1 },
    options: { 
      background: true, 
      name: 'notifications_ttl',
      expireAfterSeconds: TTL_CONFIG.NOTIFICATIONS
    }
  },

  // Communities collection
  {
    collection: 'communities',
    index: { members: 1 },
    options: { background: true, name: 'communities_members' }
  },
  {
    collection: 'communities',
    index: { memberCount: -1, createdAt: -1 },
    options: { background: true, name: 'communities_popularity' }
  },

  // Chats collection
  {
    collection: 'chats',
    index: { participantIds: 1, updatedAt: -1 },
    options: { background: true, name: 'chats_participants_updated' }
  },
  {
    collection: 'chats',
    index: { bookId: 1 },
    options: { background: true, sparse: true, name: 'chats_book' }
  },

  // Password reset tokens with TTL
  {
    collection: 'password_reset_tokens',
    index: { token: 1 },
    options: { unique: true, background: true, name: 'tokens_unique' }
  },
  {
    collection: 'password_reset_tokens',
    index: { expiresAt: 1 },
    options: { 
      background: true,
      name: 'tokens_ttl',
      expireAfterSeconds: 0 // Use the expiresAt field value
    }
  },

  // Reviews collection
  {
    collection: 'reviews',
    index: { revieweeId: 1, createdAt: -1 },
    options: { background: true, name: 'reviews_reviewee' }
  },
  {
    collection: 'reviews',
    index: { reviewerId: 1, revieweeId: 1 },
    options: { unique: true, background: true, name: 'reviews_unique_pair' }
  },

  // Reports collection
  {
    collection: 'reports',
    index: { status: 1, createdAt: -1 },
    options: { background: true, name: 'reports_status_created' }
  },
  {
    collection: 'reports',
    index: { reportedUserId: 1, reportedContentType: 1 },
    options: { background: true, name: 'reports_target' }
  },

  // Organizations collection
  {
    collection: 'organizations',
    index: { status: 1, location: 1 },
    options: { background: true, name: 'organizations_status_location' }
  }
];

/**
 * Database cleanup and maintenance operations
 */
export class DatabaseMaintenance {
  
  /**
   * Initialize all critical indexes and TTL policies
   */
  static async initializeDatabaseMaintenance(): Promise<void> {
    console.log('🚀 Initializing database maintenance...');
    
    try {
      await Promise.all([
        this.createCriticalIndexes(),
        this.setupTTLPolicies(),
        this.validateIndexHealth(),
        this.initializeCitiesDatabase()
      ]);
      
      console.log('✅ Database maintenance initialization completed');
    } catch (error) {
      console.error('❌ Database maintenance initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create all critical indexes for optimal performance
   */
  static async createCriticalIndexes(): Promise<void> {
    console.log('📊 Creating critical database indexes...');
    
    const client = await clientPromise;
    const db = client.db('bookex');
    
    let createdCount = 0;
    let existingCount = 0;
    
    for (const indexDef of CRITICAL_INDEXES) {
      try {
        const collection = db.collection(indexDef.collection);
        await collection.createIndex(indexDef.index as any, indexDef.options);
        createdCount++;
        console.log(`✓ Created index ${indexDef.options.name} on ${indexDef.collection}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          existingCount++;
          console.log(`- Index ${indexDef.options.name} already exists on ${indexDef.collection}`);
        } else {
          console.error(`✗ Failed to create index ${indexDef.options.name}:`, error);
        }
      }
    }
    
    console.log(`📊 Index Summary: ${createdCount} created, ${existingCount} existing`);
  }

  /**
   * Setup TTL policies for automatic data cleanup
   */
  static async setupTTLPolicies(): Promise<void> {
    console.log('⏰ Setting up TTL policies...');
    
    const client = await clientPromise;
    const db = client.db('bookex');
    
    // Additional TTL indexes beyond the main ones
    const ttlIndexes = [
      // Audit logs (if they exist)
      {
        collection: 'audit_logs',
        index: { createdAt: 1 },
        options: { 
          background: true,
          name: 'audit_logs_ttl',
          expireAfterSeconds: TTL_CONFIG.AUDIT_LOGS
        }
      },
      
      // Temporary session data
      {
        collection: 'temp_sessions',
        index: { createdAt: 1 },
        options: { 
          background: true,
          name: 'temp_sessions_ttl',
          expireAfterSeconds: TTL_CONFIG.TEMP_FILES
        }
      }
    ];

    for (const ttlIndex of ttlIndexes) {
      try {
        const collection = db.collection(ttlIndex.collection);
        
        // Check if collection exists first
        const collections = await db.listCollections({ name: ttlIndex.collection }).toArray();
        if (collections.length > 0) {
          await collection.createIndex(ttlIndex.index as any, ttlIndex.options);
          console.log(`✓ Set TTL policy for ${ttlIndex.collection}`);
        } else {
          console.log(`- Collection ${ttlIndex.collection} doesn't exist, skipping TTL`);
        }
      } catch (error) {
        if (error instanceof Error && !error.message.includes('already exists')) {
          console.error(`✗ Failed to set TTL for ${ttlIndex.collection}:`, error);
        }
      }
    }
    
    console.log('✅ TTL policies setup completed');
  }

  /**
   * Validate that all critical indexes are healthy and being used
   */
  static async validateIndexHealth(): Promise<void> {
    console.log('🩺 Validating index health...');
    
    const client = await clientPromise;
    const db = client.db('bookex');
    
    const healthReport = {
      totalCollections: 0,
      totalIndexes: 0,
      unhealthyIndexes: 0,
      recommendations: [] as string[]
    };

    for (const indexDef of CRITICAL_INDEXES) {
      try {
        const collection = db.collection(indexDef.collection);
        
        // Check if collection exists
        const collections = await db.listCollections({ name: indexDef.collection }).toArray();
        if (collections.length === 0) {
          healthReport.recommendations.push(`Collection ${indexDef.collection} doesn't exist`);
          continue;
        }

        healthReport.totalCollections++;
        
        // Get index stats
        const indexes = await collection.indexes();
        const targetIndex = indexes.find(idx => idx.name === indexDef.options.name);
        
        if (targetIndex) {
          healthReport.totalIndexes++;
          
          // Check for potential issues
          if (targetIndex.sparse && indexDef.options.sparse !== true) {
            healthReport.unhealthyIndexes++;
            healthReport.recommendations.push(
              `Index ${indexDef.options.name} sparsity mismatch`
            );
          }
        } else {
          healthReport.unhealthyIndexes++;
          healthReport.recommendations.push(
            `Missing index ${indexDef.options.name} on ${indexDef.collection}`
          );
        }
      } catch (error) {
        healthReport.unhealthyIndexes++;
        healthReport.recommendations.push(
          `Error checking ${indexDef.collection}: ${error}`
        );
      }
    }

    console.log('📋 Index Health Report:');
    console.log(`   Collections: ${healthReport.totalCollections}`);
    console.log(`   Indexes: ${healthReport.totalIndexes}`);
    console.log(`   Issues: ${healthReport.unhealthyIndexes}`);
    
    if (healthReport.recommendations.length > 0) {
      console.log('⚠️  Recommendations:');
      healthReport.recommendations.forEach(rec => console.log(`   - ${rec}`));
    } else {
      console.log('✅ All indexes are healthy');
    }
  }

  /**
   * Perform periodic cleanup of expired and unnecessary data
   */
  static async performPeriodicCleanup(): Promise<void> {
    console.log('🧹 Starting periodic database cleanup...');
    
    try {
      const cleanupResults = await Promise.all([
        this.cleanupExpiredNotifications(),
        this.cleanupOrphanedData(),
        this.optimizeCollections(),
        this.updateIndexStatistics()
      ]);

      const totalCleaned = cleanupResults.reduce((sum, result) => sum + (result.deletedCount || 0), 0);
      console.log(`✅ Cleanup completed: ${totalCleaned} items processed`);
    } catch (error) {
      console.error('❌ Periodic cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Clean up expired notifications beyond TTL
   */
  static async cleanupExpiredNotifications(): Promise<{ deletedCount: number }> {
    const client = await clientPromise;
    const db = client.db('bookex');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await db.collection('notifications').deleteMany({
      createdAt: { $lt: thirtyDaysAgo.toISOString() },
      read: true // Only delete read notifications
    });

    console.log(`🗑️  Cleaned up ${result.deletedCount} expired notifications`);
    return { deletedCount: result.deletedCount };
  }

  /**
   * Clean up orphaned data (references to deleted entities)
   */
  static async cleanupOrphanedData(): Promise<{ deletedCount: number }> {
    const client = await clientPromise;
    const db = client.db('bookex');
    
    let totalDeleted = 0;

    // Clean up chats for deleted books
    const booksCollection = db.collection('books');
    const chatsCollection = db.collection('chats');
    
    const chatsWithBooks = await chatsCollection.find({ bookId: { $exists: true } }).toArray();
    
    for (const chat of chatsWithBooks) {
      if (chat.bookId) {
        const book = await booksCollection.findOne({ _id: new ObjectId(chat.bookId) });
        if (!book) {
          await chatsCollection.deleteOne({ _id: chat._id });
          totalDeleted++;
        }
      }
    }

    // Clean up notifications for deleted books
    const notificationsCollection = db.collection('notifications');
    const notificationsWithBooks = await notificationsCollection.find({ 
      'metadata.bookId': { $exists: true } 
    }).toArray();
    
    for (const notification of notificationsWithBooks) {
      if (notification.metadata?.bookId) {
        const book = await booksCollection.findOne({ _id: new ObjectId(notification.metadata.bookId) });
        if (!book) {
          await notificationsCollection.deleteOne({ _id: notification._id });
          totalDeleted++;
        }
      }
    }

    console.log(`🗑️  Cleaned up ${totalDeleted} orphaned records`);
    return { deletedCount: totalDeleted };
  }

  /**
   * Optimize collection storage and performance
   */
  static async optimizeCollections(): Promise<{ deletedCount: number }> {
    console.log('⚡ Optimizing collections...');
    
    const client = await clientPromise;
    const db = client.db('bookex');
    
    // List of collections to optimize
    const collectionsToOptimize = [
      'users', 'books', 'notifications', 'chats', 'communities'
    ];

    for (const collectionName of collectionsToOptimize) {
      try {
        const collection = db.collection(collectionName);
        
        // Get collection stats
        const stats = await db.command({ collStats: collectionName });
        
        // Log collection statistics
        console.log(`📊 ${collectionName}: ${stats.count} documents, ${Math.round(stats.size / 1024)} KB`);
        
        // For large collections, consider reindexing
        if (stats.count > 10000) {
          console.log(`🔄 Large collection ${collectionName} may benefit from reindexing`);
        }
      } catch (error) {
        console.log(`⚠️  Could not optimize ${collectionName}: collection may not exist`);
      }
    }

    return { deletedCount: 0 };
  }

  /**
   * Update index usage statistics
   */
  static async updateIndexStatistics(): Promise<{ deletedCount: number }> {
    console.log('📈 Updating index statistics...');
    
    const client = await clientPromise;
    const db = client.db('bookex');
    
    // Check index usage for main collections
    const mainCollections = ['users', 'books', 'notifications', 'chats'];
    
    for (const collectionName of mainCollections) {
      try {
        const collection = db.collection(collectionName);
        const indexStats = await collection.aggregate([
          { $indexStats: {} }
        ]).toArray();

        if (indexStats.length > 0) {
          console.log(`📊 ${collectionName} index usage:`);
          indexStats.forEach(stat => {
            const usage = stat.accesses?.ops || 0;
            console.log(`   ${stat.name}: ${usage} operations`);
          });
        }
      } catch (error) {
        console.log(`⚠️  Could not get index stats for ${collectionName}`);
      }
    }

    return { deletedCount: 0 };
  }

  /**
   * Emergency cleanup for critical storage issues
   */
  static async emergencyCleanup(): Promise<void> {
    console.log('🚨 Performing emergency cleanup...');
    
    const client = await clientPromise;
    const db = client.db('bookex');
    
    // Clean up very old notifications aggressively
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const result = await db.collection('notifications').deleteMany({
      createdAt: { $lt: sixtyDaysAgo.toISOString() }
    });

    console.log(`🚨 Emergency cleanup: removed ${result.deletedCount} old notifications`);
  }

  /**
   * Initialize cities database with indexes and seed data
   */
  static async initializeCitiesDatabase(): Promise<void> {
    console.log('🏙️ Initializing cities database...');

    try {
      const { initializeCities } = await import('./city-validation');
      await initializeCities();
      console.log('✅ Cities database initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize cities database:', error);
      // Don't throw error - cities are not critical for app startup
    }
  }
}

/**
 * Utility function to run database maintenance
 */
export async function runDatabaseMaintenance(mode: 'full' | 'indexes' | 'cleanup' | 'emergency' = 'full'): Promise<void> {
  console.log(`🔧 Running database maintenance (${mode} mode)...`);
  
  try {
    switch (mode) {
      case 'full':
        await DatabaseMaintenance.initializeDatabaseMaintenance();
        await DatabaseMaintenance.performPeriodicCleanup();
        break;
      case 'indexes':
        await DatabaseMaintenance.createCriticalIndexes();
        await DatabaseMaintenance.validateIndexHealth();
        break;
      case 'cleanup':
        await DatabaseMaintenance.performPeriodicCleanup();
        break;
      case 'emergency':
        await DatabaseMaintenance.emergencyCleanup();
        break;
    }
    
    console.log('✅ Database maintenance completed successfully');
  } catch (error) {
    console.error('❌ Database maintenance failed:', error);
    throw error;
  }
}
