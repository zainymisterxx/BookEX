/**
 * Simple database index setup for production deployment
 * This version is safer and can be run multiple times without issues
 */

import clientPromise from './mongodb';

async function createIndexSafely(collection: any, indexSpec: any, options: any) {
  try {
    await collection.createIndex(indexSpec, options);
    console.log(`Created index: ${options.name}`);
  } catch (error: any) {
    if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
      // Index already exists with different name, check if same fields
      const existingIndexes = await collection.listIndexes().toArray();
      const conflictingIndex = existingIndexes.find((idx: any) => {
        const keys = Object.keys(indexSpec);
        const idxKeys = Object.keys(idx.key || {});
        return keys.length === idxKeys.length && 
               keys.every(key => idx.key[key] === indexSpec[key]);
      });
      
      if (conflictingIndex) {
        console.log(`ℹ️ Index with same fields already exists: ${conflictingIndex.name} (skipping ${options.name})`);
      } else {
        console.log(`⚠️ Index conflict for ${options.name}: ${error.message}`);
      }
    } else if (error.code === 11000 || error.message.includes('already exists')) {
      console.log(`ℹ️ Index already exists: ${options.name}`);
    } else {
      console.error(`❌ Error creating index ${options.name}:`, error.message);
      throw error;
    }
  }
}

export async function ensureDatabaseIndexes() {
  try {
    const client = await clientPromise;
    const db = client.db("bookex");
    
    console.log('📊 Ensuring database indexes exist...');
    
    // Books - Core search indexes
    await createIndexSafely(
      db.collection('books'),
      { cityNormalized: 1, type: 1, genre: 1 }, 
      { background: true, name: 'city_type_genre_compound' }
    );
    
    await createIndexSafely(
      db.collection('books'),
      { sellerId: 1, createdAt: -1 }, 
      { background: true, name: 'books_seller_date' }
    );
    
    // Text search for books
    await createIndexSafely(
      db.collection('books'),
      { title: 'text', author: 'text', description: 'text' }, 
      { background: true, name: 'books_text_search' }
    );
    
    // Organizations - Admin and public views
    await createIndexSafely(
      db.collection('organizations'),
      { status: 1, createdAt: -1 }, 
      { background: true, name: 'organizations_status_date' }
    );
    
    await createIndexSafely(
      db.collection('organizations'),
      { location: 1, status: 1 }, 
      { background: true, name: 'organizations_location_status' }
    );
    
    // Communities - Performance indexes
    await createIndexSafely(
      db.collection('communities'),
      { "members.userId": 1, "members.role": 1 }, 
      { background: true, name: 'communities_members_role' }
    );
    
    await createIndexSafely(
      db.collection('communities'),
      { createdBy: 1 }, 
      { background: true, name: 'communities_creator' }
    );
    
    await createIndexSafely(
      db.collection('communities'),
      { memberCount: -1 }, 
      { background: true, name: 'communities_member_count' }
    );
    
    // Text search for communities
    await createIndexSafely(
      db.collection('communities'),
      { name: 'text', description: 'text' }, 
      { background: true, name: 'communities_text_search' }
    );
    
    // Posts - New collection
    await createIndexSafely(
      db.collection('posts'),
      { communityId: 1, createdAt: -1 },
      { background: true, name: 'posts_community_createdAt' }
    );

    await createIndexSafely(
      db.collection('posts'),
      { authorId: 1, createdAt: -1 },
      { background: true, name: 'posts_author_createdAt' }
    );

    // Comments - New collection
    await createIndexSafely(
      db.collection('comments'),
      { postId: 1, createdAt: 1 },
      { background: true, name: 'comments_post_createdAt' }
    );

    await createIndexSafely(
      db.collection('comments'),
      { communityId: 1, createdAt: -1 },
      { background: true, name: 'comments_community_createdAt' }
    );

    await createIndexSafely(
      db.collection('comments'),
      { path: 1 },
      { background: true, name: 'comments_path' }
    );

    // Chats - Message system performance
    await createIndexSafely(
      db.collection('chats'),
      { participantIds: 1 }, 
      { background: true, name: 'chats_participants' }
    );
    
    await createIndexSafely(
      db.collection('chats'),
      { organizationId: 1 }, 
      { background: true, sparse: true, name: 'chats_organization' }
    );
    
    // Users - Authentication and profiles
    await createIndexSafely(
      db.collection('users'),
      { email: 1 }, 
      { background: true, unique: true, name: 'users_email_unique' }
    );
    
    // Reports - Admin dashboard
    await createIndexSafely(
      db.collection('reports'),
      { status: 1, createdAt: -1 }, 
      { background: true, name: 'reports_status_date' }
    );
    
    // Exchanges - Transaction tracking
    await createIndexSafely(
      db.collection('exchanges'),
      { proposerId: 1, status: 1 }, 
      { background: true, name: 'exchanges_proposer_status' }
    );
    
    await db.collection('exchanges').createIndex(
      { receiverId: 1, status: 1 }, 
      { background: true, name: 'exchanges_receiver_status' }
    );

    // Activity Logs - Security and audit trail
    await db.collection('activity_logs').createIndex(
      { userId: 1, timestamp: -1 },
      { background: true, name: 'activity_logs_user_timestamp' }
    );

    await db.collection('activity_logs').createIndex(
      { activityType: 1, timestamp: -1 },
      { background: true, name: 'activity_logs_type_timestamp' }
    );

    await createIndexSafely(
      db.collection('activity_logs'),
      { severity: 1, timestamp: -1 },
      { background: true, name: 'activity_logs_severity_timestamp' }
    );

    await createIndexSafely(
      db.collection('activity_logs'),
      { timestamp: -1 },
      { background: true, name: 'activity_logs_timestamp' }
    );

    // TTL index for automatic cleanup (90 days)
    await createIndexSafely(
      db.collection('activity_logs'),
      { expiresAt: 1 },
      { background: true, expireAfterSeconds: 0, name: 'activity_logs_ttl' }
    );

    console.log('✅ Database indexes ensured successfully');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error ensuring database indexes:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check if critical indexes exist (by name or similar functionality)
 */
export async function checkIndexHealth() {
  try {
    const client = await clientPromise;
    const db = client.db("bookex");
    
    const criticalIndexes = [
      { 
        collection: 'books', 
        index: 'city_type_genre_compound',
        fields: { cityNormalized: 1, type: 1, genre: 1 }
      },
      { 
        collection: 'organizations', 
        index: 'organizations_status_date',
        fields: { status: 1, createdAt: -1 }
      },
      { 
        collection: 'communities', 
        index: 'communities_members',
        fields: { members: 1 }
      },
      { 
        collection: 'chats', 
        index: 'chats_participants',
        fields: { participantIds: 1 }
      },
      { 
        collection: 'users', 
        index: 'users_email_unique',
        fields: { email: 1 }
      }
    ];
    
    const missingIndexes = [];
    
    for (const { collection, index, fields } of criticalIndexes) {
      const indexes = await db.collection(collection).listIndexes().toArray();
      
      // Check if exact name exists
      const hasExactIndex = indexes.some(idx => idx.name === index);
      
      if (!hasExactIndex) {
        // Check if similar index exists (same key pattern)
        const fieldKeys = Object.keys(fields);
        const hasSimilarIndex = indexes.some(idx => {
          if (!idx.key) return false;
          const indexKeys = Object.keys(idx.key);
          
          // For compound indexes, check if all required fields are present
          if (fieldKeys.length > 1) {
            return fieldKeys.every(field => field in idx.key);
          } else {
            // For single field indexes, check exact match
            return indexKeys.length === 1 && indexKeys[0] === fieldKeys[0];
          }
        });
        
        if (!hasSimilarIndex) {
          missingIndexes.push(`${collection}.${index}`);
        }
      }
    }
    
    return {
      healthy: missingIndexes.length === 0,
      missingIndexes,
      totalChecked: criticalIndexes.length
    };
    
  } catch (error) {
    console.error('Error checking index health:', error);
    return { healthy: false, error: String(error) };
  }
}

/**
 * Create only the missing critical indexes
 */
export async function createMissingIndexes() {
  try {
    const client = await clientPromise;
    const db = client.db("bookex");
    
    console.log('🔧 Creating missing critical indexes...');
    
    // Check which indexes are missing first
    const healthCheck = await checkIndexHealth();
    
    if (healthCheck.healthy) {
      console.log('✅ All indexes already exist');
      return { success: true, message: 'All indexes already exist' };
    }
    
    const missingIndexes = healthCheck.missingIndexes || [];
    let createdCount = 0;
    let skippedCount = 0;
    
    // Create missing indexes one by one
    for (const missingIndex of missingIndexes) {
      try {
        const [collection, indexName] = missingIndex.split('.');
        
        switch (indexName) {
          case 'city_type_genre_compound':
            try {
              await db.collection('books').createIndex(
                { cityNormalized: 1, type: 1, genre: 1 }, 
                { background: true, name: 'city_type_genre_compound' }
              );
              console.log(`✅ Created index: ${indexName}`);
              createdCount++;
            } catch (error: any) {
              if (error.code === 85) { // IndexOptionsConflict
                console.log(`ℹ️ Index with similar fields already exists for ${indexName}`);
                skippedCount++;
              } else {
                throw error;
              }
            }
            break;
            
          case 'organizations_status_date':
            try {
              await db.collection('organizations').createIndex(
                { status: 1, createdAt: -1 }, 
                { background: true, name: 'organizations_status_date' }
              );
              console.log(`✅ Created index: ${indexName}`);
              createdCount++;
            } catch (error: any) {
              if (error.code === 85) {
                console.log(`ℹ️ Index with similar fields already exists for ${indexName}`);
                skippedCount++;
              } else {
                throw error;
              }
            }
            break;
            
          case 'communities_members':
            try {
              await db.collection('communities').createIndex(
                { members: 1 }, 
                { background: true, name: 'communities_members' }
              );
              console.log(`✅ Created index: ${indexName}`);
              createdCount++;
            } catch (error: any) {
              if (error.code === 85) {
                console.log(`ℹ️ Index with similar fields already exists for ${indexName}`);
                skippedCount++;
              } else {
                throw error;
              }
            }
            break;
            
          case 'chats_participants':
            try {
              await db.collection('chats').createIndex(
                { participantIds: 1 }, 
                { background: true, name: 'chats_participants' }
              );
              console.log(`✅ Created index: ${indexName}`);
              createdCount++;
            } catch (error: any) {
              if (error.code === 85) {
                console.log(`ℹ️ Index with similar fields already exists for ${indexName}`);
                skippedCount++;
              } else {
                throw error;
              }
            }
            break;
            
          case 'users_email_unique':
            try {
              await db.collection('users').createIndex(
                { email: 1 }, 
                { background: true, unique: true, name: 'users_email_unique' }
              );
              console.log(`✅ Created index: ${indexName}`);
              createdCount++;
            } catch (error: any) {
              if (error.code === 85) {
                console.log(`ℹ️ Index with similar fields already exists for ${indexName}`);
                skippedCount++;
              } else {
                throw error;
              }
            }
            break;
        }
        
      } catch (error) {
        console.error(`❌ Failed to create index ${missingIndex}:`, error);
      }
    }
    
    const totalProcessed = createdCount + skippedCount;
    let message = '';
    
    if (createdCount > 0 && skippedCount > 0) {
      message = `Created ${createdCount} new indexes, ${skippedCount} already existed with different names`;
    } else if (createdCount > 0) {
      message = `Successfully created ${createdCount} missing indexes`;
    } else if (skippedCount > 0) {
      message = `All indexes already exist (${skippedCount} found with different names)`;
    } else {
      message = 'No indexes were processed';
    }
    
    console.log(`✅ Index creation completed: ${message}`);
    return { 
      success: true, 
      message,
      createdCount,
      skippedCount
    };
    
  } catch (error) {
    console.error('❌ Error creating missing indexes:', error);
    return { success: false, error: String(error) };
  }
}
