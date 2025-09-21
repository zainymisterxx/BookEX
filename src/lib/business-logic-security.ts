/**
 * Business logic security for BookEx platform
 * Implements transaction integrity, inventory management, and duplicate prevention
 */

import { ObjectId } from 'mongodb';
import clientPromise from './mongodb';
import { createAppError, ErrorType } from './error-handling';
import type { Book, Exchange, User } from './types';

export interface TransactionLock {
  resourceId: string;
  resourceType: 'book' | 'user' | 'exchange';
  lockedBy: string;
  lockedAt: string;
  expiresAt: string;
  operation: string;
}

export interface InventoryValidation {
  isValid: boolean;
  conflicts: string[];
  warnings: string[];
}

export interface DuplicateCheck {
  hasDuplicates: boolean;
  duplicateIds: string[];
  similarity: number;
}

/**
 * Business logic security and integrity enforcement
 */
export class BusinessLogicSecurity {
  private static readonly LOCK_TIMEOUT_MS = 30000; // 30 seconds
  private static readonly MAX_BOOKS_PER_USER = 100;
  private static readonly MAX_DAILY_LISTINGS = 10;

  /**
   * Creates a transaction lock to prevent concurrent modifications
   */
  static async acquireLock(
    resourceId: string,
    resourceType: 'book' | 'user' | 'exchange',
    userId: string,
    operation: string
  ): Promise<boolean> {
    const client = await clientPromise;
    const db = client.db('bookex');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.LOCK_TIMEOUT_MS);

    const lock: TransactionLock = {
      resourceId,
      resourceType,
      lockedBy: userId,
      lockedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      operation
    };

    try {
      // Attempt to create lock (will fail if already exists)
      const result = await db.collection('transactionLocks').insertOne(lock);
      return result.acknowledged;
    } catch (error) {
      // Lock already exists or other error
      return false;
    }
  }

  /**
   * Releases a transaction lock
   */
  static async releaseLock(resourceId: string, userId: string): Promise<void> {
    const client = await clientPromise;
    const db = client.db('bookex');

    await db.collection('transactionLocks').deleteOne({
      resourceId,
      lockedBy: userId
    });
  }

  /**
   * Cleans up expired locks
   */
  static async cleanupExpiredLocks(): Promise<number> {
    const client = await clientPromise;
    const db = client.db('bookex');

    const now = new Date().toISOString();
    const result = await db.collection('transactionLocks').deleteMany({
      expiresAt: { $lt: now }
    });

    return result.deletedCount || 0;
  }

  /**
   * Validates book listing before creation/update
   */
  static async validateBookListing(
    bookData: Partial<Book>,
    userId: string,
    isUpdate: boolean = false
  ): Promise<InventoryValidation> {
    const client = await clientPromise;
    const db = client.db('bookex');

    const conflicts: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. Check user's total book count limit
      if (!isUpdate) {
        const userBookCount = await db.collection('books').countDocuments({
          sellerId: userId,
          status: { $in: ['available', 'pending'] }
        });

        if (userBookCount >= this.MAX_BOOKS_PER_USER) {
          conflicts.push(`Maximum books per user exceeded (${this.MAX_BOOKS_PER_USER})`);
        }
      }

      // 2. Check daily listing limit
      if (!isUpdate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayListings = await db.collection('books').countDocuments({
          sellerId: userId,
          createdAt: {
            $gte: today.toISOString(),
            $lt: tomorrow.toISOString()
          }
        });

        if (todayListings >= this.MAX_DAILY_LISTINGS) {
          conflicts.push(`Daily listing limit exceeded (${this.MAX_DAILY_LISTINGS} per day)`);
        }
      }

      // 3. Check for potential duplicates
      if (bookData.title && bookData.author) {
        const duplicateCheck = await this.checkDuplicateBooks(
          bookData.title,
          bookData.author,
          userId,
          isUpdate ? bookData._id?.toString() : undefined
        );

        if (duplicateCheck.hasDuplicates) {
          if (duplicateCheck.similarity > 0.9) {
            conflicts.push('Potential duplicate book detected - very similar listing exists');
          } else if (duplicateCheck.similarity > 0.7) {
            warnings.push('Similar book listing detected - please verify this is not a duplicate');
          }
        }
      }

      // 4. Validate price reasonableness
      if (bookData.price && bookData.type === 'sell') {
        if (bookData.price < 0) {
          conflicts.push('Price cannot be negative');
        } else if (bookData.price > 10000) {
          warnings.push('Price seems unusually high - please verify');
        } else if (bookData.price < 1 && bookData.condition !== 'worn') {
          warnings.push('Price seems unusually low for book condition');
        }
      }

      // 5. Validate book availability during pending exchanges
      if (isUpdate && bookData._id) {
        const pendingExchanges = await db.collection('exchanges').countDocuments({
          $or: [
            { proposerBookId: bookData._id.toString() },
            { responderBookId: bookData._id.toString() }
          ],
          status: { $in: ['proposed', 'accepted'] }
        });

        if (pendingExchanges > 0) {
          conflicts.push('Cannot modify book with pending exchanges');
        }
      }

      return {
        isValid: conflicts.length === 0,
        conflicts,
        warnings
      };

    } catch (error) {
      throw createAppError(
        ErrorType.INTERNAL,
        'Failed to validate book listing',
        undefined,
        undefined,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Checks for duplicate book listings
   */
  static async checkDuplicateBooks(
    title: string,
    author: string,
    userId: string,
    excludeBookId?: string
  ): Promise<DuplicateCheck> {
    const client = await clientPromise;
    const db = client.db('bookex');

    try {
      // Normalize text for comparison
      const normalizeText = (text: string) => 
        text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

      const normalizedTitle = normalizeText(title);
      const normalizedAuthor = normalizeText(author);

      // Find similar books by the same user
      const query: any = {
        sellerId: userId,
        status: { $in: ['available', 'pending'] }
      };

      if (excludeBookId) {
        query._id = { $ne: new ObjectId(excludeBookId) };
      }

      const userBooks = await db.collection('books').find(query).toArray() as Book[];

      let maxSimilarity = 0;
      const duplicateIds: string[] = [];

      for (const book of userBooks) {
        const bookTitle = normalizeText(book.title);
        const bookAuthor = normalizeText(book.author);

        // Calculate similarity scores
        const titleSimilarity = this.calculateSimilarity(normalizedTitle, bookTitle);
        const authorSimilarity = this.calculateSimilarity(normalizedAuthor, bookAuthor);
        
        // Combined similarity with weighted importance
        const combinedSimilarity = (titleSimilarity * 0.7) + (authorSimilarity * 0.3);

        if (combinedSimilarity > maxSimilarity) {
          maxSimilarity = combinedSimilarity;
        }

        if (combinedSimilarity > 0.7) {
          duplicateIds.push(book._id!.toString());
        }
      }

      return {
        hasDuplicates: duplicateIds.length > 0,
        duplicateIds,
        similarity: maxSimilarity
      };

    } catch (error) {
      throw createAppError(
        ErrorType.INTERNAL,
        'Failed to check for duplicate books',
        undefined,
        undefined,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Calculates similarity between two strings using Levenshtein distance
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,      // deletion
          matrix[j - 1][i] + 1,      // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    const distance = matrix[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }

  /**
   * Validates exchange proposal for business logic constraints
   */
  static async validateExchangeProposal(
    proposerBookId: string,
    responderBookId: string,
    proposerId: string
  ): Promise<InventoryValidation> {
    const client = await clientPromise;
    const db = client.db('bookex');

    const conflicts: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. Verify both books exist and are available
      const proposerBook = await db.collection('books').findOne({
        _id: new ObjectId(proposerBookId),
        sellerId: proposerId,
        status: 'available'
      }) as Book | null;

      const responderBook = await db.collection('books').findOne({
        _id: new ObjectId(responderBookId),
        status: 'available'
      }) as Book | null;

      if (!proposerBook) {
        conflicts.push('Your book is not available for exchange');
      }

      if (!responderBook) {
        conflicts.push('Requested book is not available for exchange');
      }

      if (proposerBook && responderBook) {
        // 2. Prevent self-exchange
        if (proposerBook.sellerId === responderBook.sellerId) {
          conflicts.push('Cannot exchange with yourself');
        }

        // 3. Check for existing exchange proposals
        const existingExchange = await db.collection('exchanges').findOne({
          proposerBookId,
          responderBookId,
          status: { $in: ['proposed', 'accepted'] }
        });

        if (existingExchange) {
          conflicts.push('Exchange proposal already exists for these books');
        }

        // 4. Check for reverse exchange proposal
        const reverseExchange = await db.collection('exchanges').findOne({
          proposerBookId: responderBookId,
          responderBookId: proposerBookId,
          status: { $in: ['proposed', 'accepted'] }
        });

        if (reverseExchange) {
          conflicts.push('A reverse exchange proposal already exists');
        }

        // 5. Value difference warning
        if (proposerBook.price && responderBook.price) {
          const valueDifference = Math.abs(proposerBook.price - responderBook.price);
          const avgPrice = (proposerBook.price + responderBook.price) / 2;
          
          if (valueDifference > (avgPrice * 0.5)) {
            warnings.push('Significant price difference between books - consider carefully');
          }
        }

        // 6. Condition mismatch warning
        const conditionValues = { 'new': 4, 'like-new': 3, 'used': 2, 'worn': 1 };
        const proposerCondition = conditionValues[proposerBook.condition];
        const responderCondition = conditionValues[responderBook.condition];

        if (Math.abs(proposerCondition - responderCondition) > 1) {
          warnings.push('Book conditions differ significantly');
        }
      }

      return {
        isValid: conflicts.length === 0,
        conflicts,
        warnings
      };

    } catch (error) {
      throw createAppError(
        ErrorType.INTERNAL,
        'Failed to validate exchange proposal',
        undefined,
        undefined,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Atomically updates book status during exchange
   */
  static async updateBookStatusAtomic(
    bookId: string,
    fromStatus: string,
    toStatus: string,
    userId: string
  ): Promise<boolean> {
    const client = await clientPromise;
    const db = client.db('bookex');

    try {
      // Use findOneAndUpdate for atomic operation
      const result = await db.collection('books').findOneAndUpdate(
        {
          _id: new ObjectId(bookId),
          sellerId: userId,
          status: fromStatus
        },
        {
          $set: {
            status: toStatus,
            updatedAt: new Date().toISOString()
          }
        },
        { returnDocument: 'after' }
      );

      return result?.value !== null;

    } catch (error) {
      throw createAppError(
        ErrorType.DATABASE,
        'Failed to update book status atomically',
        undefined,
        undefined,
        { bookId, fromStatus, toStatus, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Prevents user account manipulation by checking for suspicious activity
   */
  static async validateUserActivity(userId: string): Promise<InventoryValidation> {
    const client = await clientPromise;
    const db = client.db('bookex');

    const conflicts: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. Check for rapid account creation and listing
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }) as User | null;
      
      if (user) {
        const accountAge = Date.now() - new Date(user.createdAt || 0).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (accountAge < oneDayMs) {
          const bookCount = await db.collection('books').countDocuments({ sellerId: userId });
          
          if (bookCount > 5) {
            warnings.push('New account with many listings - monitor for suspicious activity');
          }
        }

        // 2. Check for unusual listing patterns
        const last24Hours = new Date(Date.now() - oneDayMs).toISOString();
        const recentListings = await db.collection('books').countDocuments({
          sellerId: userId,
          createdAt: { $gte: last24Hours }
        });

        if (recentListings > 20) {
          conflicts.push('Excessive listing activity detected - account may be flagged');
        }

        // 3. Check for duplicate content patterns
        const userBooks = await db.collection('books').find({ sellerId: userId }).toArray() as Book[];
        
        const descriptions = userBooks.map(book => book.description);
        const uniqueDescriptions = new Set(descriptions);
        
        if (descriptions.length > 10 && uniqueDescriptions.size < descriptions.length * 0.5) {
          warnings.push('Many books with similar descriptions detected');
        }
      }

      return {
        isValid: conflicts.length === 0,
        conflicts,
        warnings
      };

    } catch (error) {
      throw createAppError(
        ErrorType.INTERNAL,
        'Failed to validate user activity',
        undefined,
        undefined,
        { userId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Enforces inventory consistency across the platform
   */
  static async enforceInventoryConsistency(): Promise<{
    fixed: number;
    issues: string[];
  }> {
    const client = await clientPromise;
    const db = client.db('bookex');

    let fixed = 0;
    const issues: string[] = [];

    try {
      // 1. Fix orphaned exchanges (books no longer exist)
      const orphanedExchanges = await db.collection('exchanges').find({
        status: { $in: ['proposed', 'accepted'] }
      }).toArray();

      for (const exchange of orphanedExchanges) {
        const proposerBook = await db.collection('books').findOne({ _id: new ObjectId(exchange.proposerBookId) });
        const responderBook = await db.collection('books').findOne({ _id: new ObjectId(exchange.responderBookId) });

        if (!proposerBook || !responderBook) {
          await db.collection('exchanges').updateOne(
            { _id: exchange._id },
            { $set: { status: 'cancelled', cancelledAt: new Date().toISOString() } }
          );
          fixed++;
          issues.push(`Cancelled orphaned exchange: ${exchange._id}`);
        }
      }

      // 2. Fix books stuck in "pending" status without active exchanges
      const pendingBooks = await db.collection('books').find({ status: 'pending' }).toArray();

      for (const book of pendingBooks) {
        const activeExchanges = await db.collection('exchanges').countDocuments({
          $or: [
            { proposerBookId: book._id.toString() },
            { responderBookId: book._id.toString() }
          ],
          status: { $in: ['proposed', 'accepted'] }
        });

        if (activeExchanges === 0) {
          await db.collection('books').updateOne(
            { _id: book._id },
            { $set: { status: 'available', updatedAt: new Date().toISOString() } }
          );
          fixed++;
          issues.push(`Reset book status to available: ${book._id}`);
        }
      }

      // 3. Clean up expired transaction locks
      const expiredLocks = await this.cleanupExpiredLocks();
      if (expiredLocks > 0) {
        fixed += expiredLocks;
        issues.push(`Cleaned up ${expiredLocks} expired transaction locks`);
      }

      return { fixed, issues };

    } catch (error) {
      throw createAppError(
        ErrorType.INTERNAL,
        'Failed to enforce inventory consistency',
        undefined,
        undefined,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }
}
