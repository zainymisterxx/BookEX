import { createClient, RedisClientType } from 'redis';

export type CacheResult<T> = { hit: true; value: T } | { hit: false };

class RedisCache {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;
  private connectionAttempted: boolean = false;

  constructor() {
    // Only create client if Redis URL is available
    if (process.env.REDIS_URL || process.env.NODE_ENV === 'development') {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 5000, // Reduced timeout
          reconnectStrategy: false, // Disable auto-reconnect
        },
      });

      this.client.on('error', (err) => {
        console.warn('Redis Client Error (app will continue without caching):', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('❌ Disconnected from Redis');
        this.isConnected = false;
      });
    } else {
      console.log('ℹ️ Redis not configured - caching disabled');
    }
  }

  async connect(): Promise<void> {
    if (!this.client || this.connectionAttempted) {
      return;
    }

    this.connectionAttempted = true;

    if (!this.isConnected) {
      try {
        await this.client.connect();
      } catch (error) {
        console.warn('Redis not available - continuing without caching:', (error as Error).message);
        // Don't throw error, allow app to continue without caching
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
    }
  }

  async get<T>(key: string): Promise<CacheResult<T>> {
    try {
      if (!this.client || !this.isConnected) {
        return { hit: false };
      }

      const data = await this.client.get(key);
      if (data === null) return { hit: false };
      return { hit: true, value: JSON.parse(data) as T };
    } catch (error) {
      console.error('[REDIS_GET_ERROR]', key, (error as Error).message || error);
      return { hit: false };
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      if (!this.client || !this.isConnected) {
        return;
      }

      const serializedValue = JSON.stringify(value);

      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
    } catch (error) {
      console.error('Redis SET error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (!this.client || !this.isConnected) {
        return;
      }

      await this.client.del(key);
    } catch (error) {
      console.error('Redis DELETE error:', error);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      if (!this.isConnected || !this.client) {
        return;
      }

      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error('Redis DELETE PATTERN error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected || !this.client) {
        return false;
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  }

  async increment(key: string): Promise<number> {
    try {
      if (!this.isConnected || !this.client) {
        return 0;
      }

      return await this.client.incr(key);
    } catch (error) {
      console.error('Redis INCR error:', error);
      return 0;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      if (!this.isConnected || !this.client) {
        return;
      }

      await this.client.expire(key, ttlSeconds);
    } catch (error) {
      console.error('Redis EXPIRE error:', error);
    }
  }

  // User-specific cache methods
  getUserCacheKey(userId: string): string {
    return `user:${userId}`;
  }

  getUserSessionCacheKey(userId: string, sessionId: string): string {
    return `user:${userId}:session:${sessionId}`;
  }

  getRateLimitCacheKey(identifier: string, action: string): string {
    return `ratelimit:${identifier}:${action}`;
  }

  async cacheUserData(userId: string, userData: any, ttlSeconds: number = 3600): Promise<void> {
    const key = this.getUserCacheKey(userId);
    await this.set(key, userData, ttlSeconds);
  }

  async getCachedUserData(userId: string): Promise<any | null> {
    const key = this.getUserCacheKey(userId);
    const result = await this.get(key);
    return result.hit ? result.value : null;
  }

  async invalidateUserCache(userId: string): Promise<void> {
    const key = this.getUserCacheKey(userId);
    await this.delete(key);

    // Also invalidate user session caches
    const sessionPattern = `user:${userId}:session:*`;
    await this.deletePattern(sessionPattern);
  }

  async cacheUserSession(userId: string, sessionId: string, sessionData: any, ttlSeconds: number = 3600): Promise<void> {
    const key = this.getUserSessionCacheKey(userId, sessionId);
    await this.set(key, sessionData, ttlSeconds);
  }

  async getCachedUserSession(userId: string, sessionId: string): Promise<any | null> {
    const key = this.getUserSessionCacheKey(userId, sessionId);
    const result = await this.get(key);
    return result.hit ? result.value : null;
  }

  async invalidateUserSession(userId: string, sessionId: string): Promise<void> {
    const key = this.getUserSessionCacheKey(userId, sessionId);
    await this.delete(key);
  }

  // Rate limiting methods
  async checkRateLimit(identifier: string, action: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = this.getRateLimitCacheKey(identifier, action);

    try {
      if (!this.isConnected || !this.client) {
        return { allowed: true, remaining: limit - 1, resetTime: Date.now() + (windowSeconds * 1000) };
      }

      const current = await this.client.incr(key);

      if (current === 1) {
        // First request, set expiry
        await this.client.expire(key, windowSeconds);
      }

      const allowed = current <= limit;
      const remaining = Math.max(0, limit - current);
      const ttl = await this.client.ttl(key);
      const resetTime = Date.now() + (ttl * 1000);

      return { allowed, remaining, resetTime };
    } catch (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true, remaining: limit - 1, resetTime: Date.now() + (windowSeconds * 1000) };
    }
  }
}

// Create singleton instance
const redisCache = new RedisCache();

// Graceful shutdown
process.on('SIGINT', async () => {
  await redisCache.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await redisCache.disconnect();
  process.exit(0);
});

export default redisCache;
