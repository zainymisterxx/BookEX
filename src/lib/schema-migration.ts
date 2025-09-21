/**
 * Schema migration utilities to fix data inconsistencies in the BookEx database
 * 
 * This file addresses critical schema inconsistencies found in the wishlist system:
 * 1. Inconsistent wishlist item matching criteria
 * 2. Missing normalized fields for efficient searching
 * 3. Data integrity issues with duplicate entries
 * 4. Case sensitivity problems in matching
 */

import clientPromise from './mongodb';
import { ObjectId } from 'mongodb';
import type { WishlistItem } from './types';

/**
 * Normalized wishlist item with consistent matching fields
 */
export interface NormalizedWishlistItem {
  bookId: string; // Reference to the book document ID
  addedAt: string; // When the book was added to wishlist
  _id?: ObjectId; // Make each wishlist item uniquely identifiable
}

/**
 * Normalizes text for consistent matching
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s]/g, '') // Remove punctuation for better matching
    .replace(/\b(the|a|an)\b/g, '') // Remove common articles
    .trim();
}

/**
 * Creates a new wishlist item from a book ID
 */
export function createWishlistItem(bookId: string): NormalizedWishlistItem {
  return {
    _id: new ObjectId(),
    bookId: bookId,
    addedAt: new Date().toISOString()
  };
}

/**
 * Converts legacy wishlist item to normalized format (for migration)
 */
export function normalizeLegacyWishlistItem(item: any): NormalizedWishlistItem | null {
  // Handle legacy items that have title/author
  if (item.title && item.author) {
    return {
      _id: item._id || new ObjectId(),
      bookId: '', // Will be populated during migration
      addedAt: item.addedAt || new Date().toISOString()
    };
  }
  // Handle new format items
  if (item.bookId) {
    return {
      _id: item._id || new ObjectId(),
      bookId: item.bookId,
      addedAt: item.addedAt || new Date().toISOString()
    };
  }
  return null;
}

/**
 * Checks if two wishlist items are the same based on bookId
 */
export function areWishlistItemsEqual(item1: WishlistItem, item2: WishlistItem): boolean {
  return item1.bookId === item2.bookId;
}

/**
 * Migration class to handle schema consistency fixes
 */
export class SchemaMigration {
  
  /**
   * Main migration function - fixes all schema inconsistencies
   */
  static async fixAllSchemaInconsistencies(): Promise<void> {
    console.log('Starting schema consistency migration...');
    
    try {
      await Promise.all([
        this.migrateWishlistToBookId(),
        this.migrateWishlistSchema(),
        this.fixDuplicateWishlistItems(),
        this.normalizeExistingData(),
        this.createMissingIndexes()
      ]);
      
      console.log('✅ Schema consistency migration completed successfully');
    } catch (error) {
      console.error('❌ Schema migration failed:', error);
      throw error;
    }
  }

  /**
   * Migrates wishlist schema to use bookId instead of title/author
   */
  static async migrateWishlistToBookId(): Promise<void> {
    console.log('Migrating wishlist to bookId-based structure...');

    const client = await clientPromise;
    const db = client.db('bookex');
    const usersCollection = db.collection('users');
    const booksCollection = db.collection('books');

    // Find all users with wishlist items
    const usersWithWishlists = await usersCollection.find(
      { wishlist: { $exists: true, $ne: [] } }
    ).toArray();

    let migratedCount = 0;
    let failedMigrations = 0;

    for (const user of usersWithWishlists) {
      try {
        if (user.wishlist && Array.isArray(user.wishlist)) {
          // Check if already migrated (has bookId fields)
          const hasBookIdFields = user.wishlist.some((item: any) => item.bookId);

          if (hasBookIdFields) {
            continue; // Already migrated
          }

          // Convert legacy wishlist items to new format
          const newWishlist: NormalizedWishlistItem[] = [];

          for (const item of user.wishlist) {
            // Try to find matching book by title and author
            if (item.title && item.author) {
              const book = await booksCollection.findOne({
                titleNormalized: normalizeText(item.title),
                authorNormalized: normalizeText(item.author)
              });

              if (book) {
                // Found matching book, create wishlist item with bookId
                newWishlist.push(createWishlistItem(book._id.toString()));
              } else {
                console.warn(`Could not find book for wishlist item: ${item.title} by ${item.author} for user ${user._id}`);
                failedMigrations++;
              }
            }
          }

          // Remove duplicates based on bookId
          const uniqueWishlist = this.removeDuplicateWishlistItems(newWishlist);

          // Update user with new wishlist structure
          await usersCollection.updateOne(
            { _id: user._id },
            { $set: { wishlist: uniqueWishlist } }
          );

          migratedCount++;
        }
      } catch (error) {
        console.error(`Failed to migrate wishlist for user ${user._id}:`, error);
        failedMigrations++;
      }
    }

    console.log(`✅ Migrated wishlist to bookId for ${migratedCount} users`);
    if (failedMigrations > 0) {
      console.warn(`⚠️  ${failedMigrations} wishlist items could not be migrated (books not found)`);
    }
  }

  /**
   * Migrates wishlist schema to use bookId instead of title/author
   */
  static async migrateWishlistSchema(): Promise<void> {
    console.log('Migrating wishlist schema to bookId-based structure...');

    const client = await clientPromise;
    const db = client.db('bookex');
    const usersCollection = db.collection('users');
    const booksCollection = db.collection('books');

    // Find all users with wishlist items
    const usersWithWishlists = await usersCollection.find(
      { wishlist: { $exists: true, $ne: [] } }
    ).toArray();

    let migratedCount = 0;
    let failedMigrations = 0;

    for (const user of usersWithWishlists) {
      try {
        if (user.wishlist && Array.isArray(user.wishlist)) {
          // Check if already migrated (has bookId fields)
          const hasBookIdFields = user.wishlist.some((item: any) => item.bookId);

          if (hasBookIdFields) {
            continue; // Already migrated
          }

          // Convert legacy wishlist items to new format
          const newWishlist: NormalizedWishlistItem[] = [];

          for (const item of user.wishlist) {
            // Try to find matching book by title and author
            if (item.title && item.author) {
              const book = await booksCollection.findOne({
                titleNormalized: normalizeText(item.title),
                authorNormalized: normalizeText(item.author)
              });

              if (book) {
                // Found matching book, create wishlist item with bookId
                newWishlist.push(createWishlistItem(book._id.toString()));
              } else {
                console.warn(`Could not find book for wishlist item: ${item.title} by ${item.author} for user ${user._id}`);
                failedMigrations++;
              }
            }
          }

          // Remove duplicates based on bookId
          const uniqueWishlist = this.removeDuplicateWishlistItems(newWishlist);

          // Update user with new wishlist structure
          await usersCollection.updateOne(
            { _id: user._id },
            { $set: { wishlist: uniqueWishlist } }
          );

          migratedCount++;
        }
      } catch (error) {
        console.error(`Failed to migrate wishlist for user ${user._id}:`, error);
        failedMigrations++;
      }
    }

    console.log(`✅ Migrated wishlist schema for ${migratedCount} users`);
    if (failedMigrations > 0) {
      console.warn(`⚠️  ${failedMigrations} wishlist items could not be migrated (books not found)`);
    }
  }

  /**
   * Removes duplicate wishlist items based on bookId
   */
  static removeDuplicateWishlistItems(wishlist: NormalizedWishlistItem[]): NormalizedWishlistItem[] {
    const seen = new Set<string>();
    return wishlist.filter(item => {
      if (seen.has(item.bookId)) {
        return false;
      }
      seen.add(item.bookId);
      return true;
    });
  }

  /**
   * Fixes existing duplicate wishlist items across all users
   */
  static async fixDuplicateWishlistItems(): Promise<void> {
    console.log('Fixing duplicate wishlist items...');
    
    const client = await clientPromise;
    const db = client.db('bookex');
    const usersCollection = db.collection('users');

    // Find users with potential duplicates
    const usersWithWishlists = await usersCollection.find(
      { 'wishlist.1': { $exists: true } } // Users with at least 2 wishlist items
    ).toArray();

    let fixedCount = 0;

    for (const user of usersWithWishlists) {
      try {
        if (user.wishlist && Array.isArray(user.wishlist)) {
          const originalLength = user.wishlist.length;
          const uniqueWishlist = this.removeDuplicateWishlistItems(user.wishlist);
          
          if (uniqueWishlist.length < originalLength) {
            await usersCollection.updateOne(
              { _id: user._id },
              { $set: { wishlist: uniqueWishlist } }
            );
            fixedCount++;
            console.log(`Removed ${originalLength - uniqueWishlist.length} duplicates for user ${user._id}`);
          }
        }
      } catch (error) {
        console.error(`Failed to fix duplicates for user ${user._id}:`, error);
      }
    }

    console.log(`✅ Fixed duplicate wishlist items for ${fixedCount} users`);
  }

  /**
   * Normalizes existing data for consistent querying
   */
  static async normalizeExistingData(): Promise<void> {
    console.log('Normalizing existing data...');
    
    const client = await clientPromise;
    const db = client.db('bookex');
    
    // Normalize book titles and authors for better matching
    const booksCollection = db.collection('books');
    const books = await booksCollection.find({
      $or: [
        { titleNormalized: { $exists: false } },
        { authorNormalized: { $exists: false } }
      ]
    }).toArray();

    let normalizedCount = 0;

    for (const book of books) {
      try {
        await booksCollection.updateOne(
          { _id: book._id },
          {
            $set: {
              titleNormalized: normalizeText(book.title || ''),
              authorNormalized: normalizeText(book.author || '')
            }
          }
        );
        normalizedCount++;
      } catch (error) {
        console.error(`Failed to normalize book ${book._id}:`, error);
      }
    }

    console.log(`✅ Normalized ${normalizedCount} books`);
  }

  /**
   * Creates missing indexes for efficient queries
   */
  static async createMissingIndexes(): Promise<void> {
    console.log('Creating missing indexes...');
    
    const client = await clientPromise;
    const db = client.db('bookex');

    const indexOperations = [
      // Enhanced wishlist indexes for bookId matching
      {
        collection: 'users',
        index: { 'wishlist.bookId': 1 } as any,
        options: { name: 'wishlist_bookId_search', background: true }
      },
      {
        collection: 'users',
        index: { 'wishlist._id': 1 } as any,
        options: { name: 'wishlist_item_id', background: true }
      },

      // Book indexes for efficient lookup by ID
      {
        collection: 'books',
        index: { _id: 1 } as any,
        options: { name: 'books_id_lookup', background: true }
      },

      // Compound indexes for efficient wishlist matching
      {
        collection: 'users',
        index: { 'wishlist.bookId': 1, 'wishlist.addedAt': 1 } as any,
        options: { name: 'wishlist_bookId_addedAt', background: true }
      }
    ];

    for (const indexOp of indexOperations) {
      try {
        const collection = db.collection(indexOp.collection);
        await collection.createIndex(indexOp.index, indexOp.options);
        console.log(`✓ Created index ${indexOp.options.name} on ${indexOp.collection}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          console.log(`- Index ${indexOp.options.name} already exists on ${indexOp.collection}`);
        } else {
          console.error(`✗ Failed to create index on ${indexOp.collection}:`, error);
        }
      }
    }

    console.log('✅ Index creation completed');
  }

  /**
   * Validates data integrity after migration
   */
  static async validateDataIntegrity(): Promise<void> {
    console.log('Validating data integrity...');
    
    const client = await clientPromise;
    const db = client.db('bookex');
    const usersCollection = db.collection('users');

    const validationResults = {
      totalUsers: 0,
      usersWithWishlist: 0,
      usersWithNormalizedWishlist: 0,
      totalWishlistItems: 0,
      duplicatesFound: 0
    };

    const allUsers = await usersCollection.find({}).toArray();
    validationResults.totalUsers = allUsers.length;

    for (const user of allUsers) {
      if (user.wishlist && Array.isArray(user.wishlist) && user.wishlist.length > 0) {
        validationResults.usersWithWishlist++;
        validationResults.totalWishlistItems += user.wishlist.length;

        // Check if normalized
        const hasNormalized = user.wishlist.some((item: any) => 
          item.titleNormalized || item.authorNormalized
        );
        
        if (hasNormalized) {
          validationResults.usersWithNormalizedWishlist++;
        }

        // Check for duplicates
        const uniqueItems = this.removeDuplicateWishlistItems(user.wishlist);
        if (uniqueItems.length < user.wishlist.length) {
          validationResults.duplicatesFound += (user.wishlist.length - uniqueItems.length);
        }
      }
    }

    console.log('📊 Data Integrity Report:');
    console.log(`   Total Users: ${validationResults.totalUsers}`);
    console.log(`   Users with Wishlist: ${validationResults.usersWithWishlist}`);
    console.log(`   Users with Normalized Wishlist: ${validationResults.usersWithNormalizedWishlist}`);
    console.log(`   Total Wishlist Items: ${validationResults.totalWishlistItems}`);
    console.log(`   Duplicates Found: ${validationResults.duplicatesFound}`);

    if (validationResults.duplicatesFound > 0) {
      console.warn('⚠️  Duplicates still found - may need additional cleanup');
    } else {
      console.log('✅ No duplicates found - data integrity validated');
    }
  }
}

/**
 * Updated wishlist operations with schema consistency
 */
export class ConsistentWishlistOperations {
  
  /**
   * Add item to wishlist with bookId
   */
  static createAddOperation(bookId: string) {
    const wishlistItem = createWishlistItem(bookId);
    return { $addToSet: { wishlist: wishlistItem } };
  }

  /**
   * Remove item from wishlist by bookId
   */
  static createRemoveOperation(bookId: string) {
    return {
      $pull: {
        wishlist: {
          bookId: bookId
        }
      }
    };
  }

  /**
   * Check if item exists in wishlist by bookId
   */
  static createExistsQuery(userId: string, bookId: string) {
    return {
      _id: new ObjectId(userId),
      'wishlist.bookId': bookId
    };
  }

  /**
   * Find users with matching wishlist items by bookId
   */
  static createMatchQuery(bookId: string) {
    return {
      'wishlist.bookId': bookId
    };
  }
}
