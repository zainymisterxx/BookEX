/**
 * Critical database indexes for BookEx application
 * These indexes are essential for performance and preventing DoS attacks
 */

import clientPromise from './mongodb';
import { createAppError, ErrorType } from './error-handling';

export interface IndexCreationResult {
  collection: string;
  indexName: string;
  created: boolean;
  existed: boolean;
  error?: string;
}

/**
 * Critical indexes that MUST be created for security and performance
 */
const CRITICAL_INDEXES = {
  // Users collection - Authentication and profile queries
  users: [
    {
      name: 'email_unique',
      keys: { email: 1 },
      options: { unique: true, background: true }
    },
    {
      name: 'email_status_compound',
      keys: { email: 1, status: 1 },
      options: { background: true }
    },
    {
      name: 'role_status_compound',
      keys: { role: 1, status: 1 },
      options: { background: true }
    },
    {
      name: 'city_search',
      keys: { city: 1 },
      options: { background: true }
    },
    {
      name: 'name_text_search',
      keys: { name: 'text' },
      options: { background: true }
    }
  ],

  // Books collection - Search and listing queries
  books: [
    {
      name: 'seller_status_compound',
      keys: { sellerId: 1, status: 1 },
      options: { background: true }
    },
    {
      name: 'city_type_genre_compound',
      keys: { city: 1, type: 1, genre: 1 },
      options: { background: true }
    },
    {
      name: 'genre_condition_price',
      keys: { genre: 1, condition: 1, price: 1 },
      options: { background: true }
    },
    {
      name: 'title_author_text_search',
      keys: { title: 'text', author: 'text', description: 'text' },
      options: { background: true }
    },
    {
      name: 'created_at_desc',
      keys: { createdAt: -1 },
      options: { background: true }
    },
    {
      name: 'price_range_query',
      keys: { price: 1, type: 1 },
      options: { background: true }
    }
  ],

  // Communities collection - Community and post queries
  communities: [
    {
      name: 'name_unique',
      keys: { name: 1 },
      options: { unique: true, background: true }
    },
    {
      name: 'members_array',
      keys: { members: 1 },
      options: { background: true }
    },
    {
      name: 'created_by_status',
      keys: { createdBy: 1, status: 1 },
      options: { background: true }
    },
    {
      name: 'posts_author_created',
      keys: { 'posts.authorId': 1, 'posts.createdAt': -1 },
      options: { background: true }
    },
    {
      name: 'posts_id_sparse',
      keys: { 'posts._id': 1 },
      options: { background: true, sparse: true }
    }
  ],

  // Chats collection - Message and participant queries
  chats: [
    {
      name: 'participants_array',
      keys: { participantIds: 1 },
      options: { background: true }
    },
    {
      name: 'book_id_sparse',
      keys: { bookId: 1 },
      options: { background: true, sparse: true }
    },
    {
      name: 'updated_at_desc',
      keys: { updatedAt: -1 },
      options: { background: true }
    },
    {
      name: 'messages_timestamp',
      keys: { 'messages.timestamp': -1 },
      options: { background: true }
    }
  ],

  // Organizations collection - Approval and search queries
  organizations: [
    {
      name: 'name_unique',
      keys: { name: 1 },
      options: { unique: true, background: true }
    },
    {
      name: 'status_submitted',
      keys: { status: 1, submittedBy: 1 },
      options: { background: true }
    },
    {
      name: 'created_at_status',
      keys: { createdAt: -1, status: 1 },
      options: { background: true }
    }
  ],

  // Reports collection - Admin and moderation queries
  reports: [
    {
      name: 'status_type_created',
      keys: { status: 1, type: 1, createdAt: -1 },
      options: { background: true }
    },
    {
      name: 'reported_by_type',
      keys: { reportedBy: 1, type: 1 },
      options: { background: true }
    },
    {
      name: 'content_id_type',
      keys: { contentId: 1, type: 1 },
      options: { background: true }
    }
  ],

  // Notifications collection - User notification queries
  notifications: [
    {
      name: 'user_read_created',
      keys: { userId: 1, read: 1, createdAt: -1 },
      options: { background: true }
    },
    {
      name: 'user_type_created',
      keys: { userId: 1, type: 1, createdAt: -1 },
      options: { background: true }
    }
  ],

  // Exchanges collection - Exchange tracking queries
  exchanges: [
    {
      name: 'proposer_status_created',
      keys: { proposerId: 1, status: 1, createdAt: -1 },
      options: { background: true }
    },
    {
      name: 'responder_status_created',
      keys: { responderId: 1, status: 1, createdAt: -1 },
      options: { background: true }
    },
    {
      name: 'book_ids_compound',
      keys: { proposerBookId: 1, responderBookId: 1 },
      options: { background: true }
    },
    {
      name: 'chat_id_sparse',
      keys: { chatId: 1 },
      options: { background: true, sparse: true }
    }
  ],

  // Rate limiting collection - Security queries
  rateLimits: [
    {
      name: 'identifier_type_window',
      keys: { identifier: 1, type: 1, windowStart: 1 },
      options: { background: true }
    },
    {
      name: 'identifier_ip_compound',
      keys: { identifier: 1, ipAddress: 1 },
      options: { background: true }
    },
    {
      name: 'window_expiry',
      keys: { windowStart: 1 },
      options: { background: true, expireAfterSeconds: 86400 } // 24 hours
    }
  ]
};

/**
 * Creates a single index with error handling
 */
async function createSingleIndex(
  db: any,
  collectionName: string,
  indexSpec: any
): Promise<IndexCreationResult> {
  try {
    const collection = db.collection(collectionName);
    
    // Check if index already exists
    const existingIndexes = await collection.listIndexes().toArray();
    const indexExists = existingIndexes.some((idx: any) => idx.name === indexSpec.name);
    
    if (indexExists) {
      return {
        collection: collectionName,
        indexName: indexSpec.name,
        created: false,
        existed: true
      };
    }

    // Create the index
    await collection.createIndex(indexSpec.keys, {
      name: indexSpec.name,
      ...indexSpec.options
    });

    return {
      collection: collectionName,
      indexName: indexSpec.name,
      created: true,
      existed: false
    };

  } catch (error) {
    return {
      collection: collectionName,
      indexName: indexSpec.name,
      created: false,
      existed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Creates all critical indexes for the application
 */
export async function createAllCriticalIndexes(): Promise<{
  results: IndexCreationResult[];
  totalCreated: number;
  totalExisted: number;
  totalErrors: number;
}> {
  const client = await clientPromise;
  const db = client.db('bookex');
  
  const results: IndexCreationResult[] = [];
  let totalCreated = 0;
  let totalExisted = 0;
  let totalErrors = 0;

  console.log('🚀 Starting critical index creation...');

  // Create indexes for each collection
  for (const [collectionName, indexes] of Object.entries(CRITICAL_INDEXES)) {
    console.log(`📂 Processing collection: ${collectionName}`);
    
    for (const indexSpec of indexes) {
      console.log(`  📊 Creating index: ${indexSpec.name}`);
      
      const result = await createSingleIndex(db, collectionName, indexSpec);
      results.push(result);
      
      if (result.created) {
        totalCreated++;
        console.log(`  ✅ Created: ${result.indexName}`);
      } else if (result.existed) {
        totalExisted++;
        console.log(`  ℹ️ Existed: ${result.indexName}`);
      } else {
        totalErrors++;
        console.error(`  ❌ Error creating ${result.indexName}: ${result.error}`);
      }
    }
  }

  console.log(`\n📈 Index creation summary:`);
  console.log(`  ✅ Created: ${totalCreated}`);
  console.log(`  ℹ️ Already existed: ${totalExisted}`);
  console.log(`  ❌ Errors: ${totalErrors}`);

  return {
    results,
    totalCreated,
    totalExisted,
    totalErrors
  };
}

/**
 * Validates that critical indexes exist and are healthy
 */
export async function validateCriticalIndexes(): Promise<{
  valid: boolean;
  missingIndexes: string[];
  issues: string[];
}> {
  const client = await clientPromise;
  const db = client.db('bookex');
  
  const missingIndexes: string[] = [];
  const issues: string[] = [];

  for (const [collectionName, indexes] of Object.entries(CRITICAL_INDEXES)) {
    try {
      const collection = db.collection(collectionName);
      const existingIndexes = await collection.listIndexes().toArray();
      const existingNames = existingIndexes.map(idx => idx.name);
      
      for (const indexSpec of indexes) {
        if (!existingNames.includes(indexSpec.name)) {
          missingIndexes.push(`${collectionName}.${indexSpec.name}`);
        }
      }
    } catch (error) {
      issues.push(`Error checking collection ${collectionName}: ${error}`);
    }
  }

  return {
    valid: missingIndexes.length === 0 && issues.length === 0,
    missingIndexes,
    issues
  };
}

/**
 * Gets index statistics for monitoring performance
 */
export async function getIndexStatistics(): Promise<any> {
  const client = await clientPromise;
  const db = client.db('bookex');
  
  const stats: Record<string, any> = {};

  for (const collectionName of Object.keys(CRITICAL_INDEXES)) {
    try {
      const collection = db.collection(collectionName);
      const indexStats = await collection.aggregate([
        { $indexStats: {} }
      ]).toArray();
      
      stats[collectionName] = indexStats;
    } catch (error) {
      stats[collectionName] = { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  return stats;
}

/**
 * Removes unused or problematic indexes
 */
export async function cleanupIndexes(indexesToDrop: string[]): Promise<{
  dropped: string[];
  errors: string[];
}> {
  const client = await clientPromise;
  const db = client.db('bookex');
  
  const dropped: string[] = [];
  const errors: string[] = [];

  for (const indexPath of indexesToDrop) {
    const [collectionName, indexName] = indexPath.split('.');
    
    try {
      const collection = db.collection(collectionName);
      await collection.dropIndex(indexName);
      dropped.push(indexPath);
      console.log(`🗑️ Dropped index: ${indexPath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${indexPath}: ${errorMsg}`);
      console.error(`❌ Error dropping ${indexPath}: ${errorMsg}`);
    }
  }

  return { dropped, errors };
}
