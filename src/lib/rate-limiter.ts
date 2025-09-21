import { connectToMongoDB } from './mongodb';

interface RateLimitRecord {
  userId: string;
  operation: string;
  requestCount: number;
  resetTime: Date;
  createdAt: Date;
}

const RATE_LIMITS = {
  'ai-summary': { requests: 10, windowMs: 60 * 60 * 1000 }, // 10 requests per hour
  'ai-recommendation': { requests: 15, windowMs: 60 * 60 * 1000 }, // 15 requests per hour
  'ai-search': { requests: 20, windowMs: 60 * 60 * 1000 }, // 20 requests per hour
  'ai-condition': { requests: 5, windowMs: 60 * 60 * 1000 }, // 5 requests per hour (image processing)
  'ai-assistant': { requests: 30, windowMs: 60 * 60 * 1000 }, // 30 requests per hour
} as const;

type RateLimitOperation = keyof typeof RATE_LIMITS;

export class RateLimiter {
  /**
   * Check if the user can make a request for the given operation
   * @param userId - User ID
   * @param operation - Type of AI operation
   * @returns Promise<{ allowed: boolean, remaining: number, resetTime: Date }>
   */
  static async checkRateLimit(userId: string, operation: RateLimitOperation): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: Date;
    total: number;
  }> {
    if (!userId) {
      throw new Error('User ID is required for rate limiting');
    }

    const limit = RATE_LIMITS[operation];
    if (!limit) {
      throw new Error(`Unknown operation: ${operation}`);
    }

    try {
      const { db } = await connectToMongoDB();
      const collection = db.collection<RateLimitRecord>('rateLimits');

      const now = new Date();
      const resetTime = new Date(now.getTime() + limit.windowMs);

      // Find or create rate limit record
      const record = await collection.findOne({
        userId,
        operation,
        resetTime: { $gt: now }
      });

      if (!record) {
        // Create new record
        await collection.insertOne({
          userId,
          operation,
          requestCount: 1,
          resetTime,
          createdAt: now
        });

        return {
          allowed: true,
          remaining: limit.requests - 1,
          resetTime,
          total: limit.requests
        };
      }

      // Check if limit exceeded
      if (record.requestCount >= limit.requests) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: record.resetTime,
          total: limit.requests
        };
      }

      // Increment request count
      await collection.updateOne(
        { _id: record._id },
        { $inc: { requestCount: 1 } }
      );

      return {
        allowed: true,
        remaining: limit.requests - record.requestCount - 1,
        resetTime: record.resetTime,
        total: limit.requests
      };

    } catch (error) {
      console.error('Rate limiter error:', error);
      // In case of error, allow the request but log the issue
      return {
        allowed: true,
        remaining: 0,
        resetTime: new Date(Date.now() + limit.windowMs),
        total: limit.requests
      };
    }
  }

  /**
   * Clean up expired rate limit records
   */
  static async cleanup(): Promise<void> {
    try {
      const { db } = await connectToMongoDB();
      const collection = db.collection<RateLimitRecord>('rateLimits');

      await collection.deleteMany({
        resetTime: { $lt: new Date() }
      });
    } catch (error) {
      console.error('Rate limiter cleanup error:', error);
    }
  }

  /**
   * Get current usage for a user
   */
  static async getUserUsage(userId: string): Promise<Record<string, { used: number; limit: number; resetTime: Date }>> {
    try {
      const { db } = await connectToMongoDB();
      const collection = db.collection<RateLimitRecord>('rateLimits');

      const records = await collection.find({
        userId,
        resetTime: { $gt: new Date() }
      }).toArray();

      const usage: Record<string, { used: number; limit: number; resetTime: Date }> = {};

      for (const record of records) {
        const limit = RATE_LIMITS[record.operation as RateLimitOperation];
        if (limit) {
          usage[record.operation] = {
            used: record.requestCount,
            limit: limit.requests,
            resetTime: record.resetTime
          };
        }
      }

      return usage;
    } catch (error) {
      console.error('Get user usage error:', error);
      return {};
    }
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public remaining: number,
    public resetTime: Date,
    public total: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Middleware function to check rate limits
 */
export async function withRateLimit<T>(
  userId: string,
  operation: RateLimitOperation,
  fn: () => Promise<T>
): Promise<T> {
  const result = await RateLimiter.checkRateLimit(userId, operation);

  if (!result.allowed) {
    throw new RateLimitError(
      `Rate limit exceeded for ${operation}. Try again after ${result.resetTime.toISOString()}`,
      result.remaining,
      result.resetTime,
      result.total
    );
  }

  return await fn();
}
