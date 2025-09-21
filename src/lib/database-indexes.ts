/**
 * Database Indexing Setup for BookEx
 * Run this script to create optimized indexes for better performance
 * 
 * Usage: node scripts/setup-indexes.js
 * Or include in your deployment pipeline
 */

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bookex';

async function setupIndexes() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    const db = client.db('bookex');
    
    console.log('📊 Setting up database indexes...');
    
    // Books Collection Indexes
    console.log('  📚 Creating Books indexes...');
    await db.collection('books').createIndex({ 
      city: 1, 
      type: 1, 
      genre: 1 
    }, { 
      name: 'books_location_type_genre_idx',
      background: true 
    });
    
    await db.collection('books').createIndex({ 
      sellerId: 1, 
      createdAt: -1 
    }, { 
      name: 'books_seller_date_idx',
      background: true 
    });
    
    await db.collection('books').createIndex({ 
      title: 'text', 
      author: 'text', 
      description: 'text' 
    }, { 
      name: 'books_text_search_idx',
      background: true 
    });
    
    await db.collection('books').createIndex({ 
      price: 1 
    }, { 
      name: 'books_price_idx',
      background: true 
    });
    
    // Organizations Collection Indexes
    console.log('  🏢 Creating Organizations indexes...');
    await db.collection('organizations').createIndex({ 
      status: 1, 
      createdAt: -1 
    }, { 
      name: 'organizations_status_date_idx',
      background: true 
    });
    
    await db.collection('organizations').createIndex({ 
      location: 1, 
      status: 1 
    }, { 
      name: 'organizations_location_status_idx',
      background: true 
    });
    
    await db.collection('organizations').createIndex({ 
      submittedBy: 1 
    }, { 
      name: 'organizations_submitter_idx',
      background: true 
    });
    
    // Ensure unique organization names (case-insensitive)
    await db.collection('organizations').createIndex({ 
      name: 1 
    }, { 
      name: 'organizations_name_unique_idx',
      unique: true,
      collation: { locale: 'en', strength: 2 }, // Case-insensitive
      background: true 
    });
    
    // Users Collection Indexes
    console.log('  👥 Creating Users indexes...');
    await db.collection('users').createIndex({ 
      email: 1 
    }, { 
      name: 'users_email_unique_idx',
      unique: true,
      background: true 
    });
    
    await db.collection('users').createIndex({ 
      city: 1 
    }, { 
      name: 'users_city_idx',
      background: true 
    });
    
    await db.collection('users').createIndex({ 
      role: 1, 
      status: 1 
    }, { 
      name: 'users_role_status_idx',
      background: true 
    });
    
    // Chats Collection Indexes
    console.log('  💬 Creating Chats indexes...');
    await db.collection('chats').createIndex({ 
      participantIds: 1 
    }, { 
      name: 'chats_participants_idx',
      background: true 
    });
    
    await db.collection('chats').createIndex({ 
      organizationId: 1 
    }, { 
      name: 'chats_organization_idx',
      sparse: true, // Only index documents that have organizationId
      background: true 
    });
    
    await db.collection('chats').createIndex({ 
      updatedAt: -1 
    }, { 
      name: 'chats_updated_date_idx',
      background: true 
    });
    
    // Communities Collection Indexes
    console.log('  🏘️ Creating Communities indexes...');
    await db.collection('communities').createIndex({ 
      name: 1 
    }, { 
      name: 'communities_name_idx',
      background: true 
    });
    
    await db.collection('communities').createIndex({ 
      createdBy: 1 
    }, { 
      name: 'communities_creator_idx',
      background: true 
    });
    
    await db.collection('communities').createIndex({ 
      createdAt: -1 
    }, { 
      name: 'communities_date_idx',
      background: true 
    });
    
    // Text search index for communities
    await db.collection('communities').createIndex({ 
      name: 'text', 
      description: 'text' 
    }, { 
      name: 'communities_text_search_idx',
      background: true 
    });
    
    // Compound index for posts within communities (for sorting posts by date)
    await db.collection('communities').createIndex({ 
      "posts.createdAt": -1,
      "posts._id": 1
    }, { 
      name: 'communities_posts_date_idx',
      background: true 
    });
    
    // Index for finding posts by author
    await db.collection('communities').createIndex({ 
      "posts.authorId": 1,
      "posts.createdAt": -1
    }, { 
      name: 'communities_posts_author_date_idx',
      background: true 
    });
    
    // Index for member queries
    await db.collection('communities').createIndex({ 
      members: 1,
      memberCount: -1
    }, { 
      name: 'communities_members_count_idx',
      background: true 
    });
    
    // Posts Collection Indexes
    console.log('  📝 Creating Posts indexes...');
    await db.collection('posts').createIndex({ 
      communityId: 1, 
      createdAt: -1 
    }, { 
      name: 'posts_community_date_idx',
      background: true 
    });
    
    await db.collection('posts').createIndex({ 
      authorId: 1, 
      createdAt: -1 
    }, { 
      name: 'posts_author_date_idx',
      background: true 
    });
    
    // Reports Collection Indexes
    console.log('  🚨 Creating Reports indexes...');
    await db.collection('reports').createIndex({ 
      status: 1, 
      createdAt: -1 
    }, { 
      name: 'reports_status_date_idx',
      background: true 
    });
    
    await db.collection('reports').createIndex({ 
      reportedContentId: 1 
    }, { 
      name: 'reports_content_idx',
      background: true 
    });
    
    // Exchanges Collection Indexes
    console.log('  🔄 Creating Exchanges indexes...');
    await db.collection('exchanges').createIndex({ 
      proposerId: 1, 
      status: 1 
    }, { 
      name: 'exchanges_proposer_status_idx',
      background: true 
    });
    
    await db.collection('exchanges').createIndex({ 
      receiverId: 1, 
      status: 1 
    }, { 
      name: 'exchanges_receiver_status_idx',
      background: true 
    });
    
    await db.collection('exchanges').createIndex({ 
      createdAt: -1 
    }, { 
      name: 'exchanges_date_idx',
      background: true 
    });
    
    // Reviews Collection Indexes
    console.log('  ⭐ Creating Reviews indexes...');
    await db.collection('reviews').createIndex({ 
      reviewedUserId: 1 
    }, { 
      name: 'reviews_reviewed_user_idx',
      background: true 
    });
    
    await db.collection('reviews').createIndex({ 
      reviewerId: 1 
    }, { 
      name: 'reviews_reviewer_idx',
      background: true 
    });
    
    // Notifications Collection Indexes
    console.log('  🔔 Creating Notifications indexes...');
    await db.collection('notifications').createIndex({ 
      userId: 1, 
      read: 1, 
      createdAt: -1 
    }, { 
      name: 'notifications_user_read_date_idx',
      background: true 
    });
    
    console.log('✅ All indexes created successfully!');
    console.log('📈 Your database is now optimized for better performance.');
    
    // Display index information
    console.log('\n📊 Index Summary:');
    const collections = [
      'books', 'organizations', 'users', 'chats', 'communities', 
      'posts', 'reports', 'exchanges', 'reviews', 'notifications'
    ];
    
    for (const collectionName of collections) {
      const indexes = await db.collection(collectionName).listIndexes().toArray();
      console.log(`  ${collectionName}: ${indexes.length} indexes`);
    }
    
  } catch (error) {
    console.error('❌ Error setting up indexes:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Database connection closed.');
  }
}

// Performance monitoring function
export async function analyzeQueryPerformance() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('bookex');
    
    console.log('🔍 Analyzing query performance...');
    
    // Enable profiling for slow queries (> 100ms)
    await db.admin().command({
      profile: 2,
      slowms: 100,
      sampleRate: 1.0
    });
    
    console.log('📊 Profiling enabled for queries slower than 100ms');
    
    // Sample queries to test performance
    const testQueries = [
      {
        name: 'Books by city and type',
        collection: 'books',
        query: { city: 'Karachi', type: 'sell' }
      },
      {
        name: 'Approved organizations',
        collection: 'organizations',
        query: { status: 'approved' }
      },
      {
        name: 'User chats',
        collection: 'chats',
        query: { participantIds: 'sample_user_id' }
      }
    ];
    
    for (const test of testQueries) {
      const startTime = Date.now();
      await db.collection(test.collection).find(test.query).limit(10).toArray();
      const endTime = Date.now();
      console.log(`  ${test.name}: ${endTime - startTime}ms`);
    }
    
  } catch (error) {
    console.error('❌ Error analyzing performance:', error);
  } finally {
    await client.close();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupIndexes()
    .then(() => {
      console.log('🎉 Database optimization complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}

export { setupIndexes };
