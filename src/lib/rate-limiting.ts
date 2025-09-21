/**
 * Rate limiting utilities for preventing abuse
 */

import redisCache from './redis-cache';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (identifier: string, action: string) => string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  error?: string;
  severity?: 'warning' | 'error';
  feedback?: string;
}

/**
 * Formats remaining time in a human-readable way
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  } else if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    const hours = Math.ceil(seconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
}

/**
 * Default rate limit configurations for different actions
 */
export const RATE_LIMITS = {
  // Book operations
  LIST_BOOK: { windowMs: 60 * 1000, maxRequests: 5 }, // 5 per minute
  TOGGLE_WISHLIST: { windowMs: 30 * 1000, maxRequests: 10 }, // 10 per 30 seconds
  CONTACT_SELLER: { windowMs: 60 * 1000, maxRequests: 3 }, // 3 per minute
  
  // Community operations
  CREATE_COMMUNITY: { windowMs: 5 * 60 * 1000, maxRequests: 2 }, // 2 per 5 minutes
  ADD_POST: { windowMs: 60 * 1000, maxRequests: 5 }, // 5 per minute
  ADD_COMMENT: { windowMs: 30 * 1000, maxRequests: 10 }, // 10 per 30 seconds
  
  // Profile operations
  UPDATE_PROFILE: { windowMs: 60 * 1000, maxRequests: 5 }, // 5 per minute
  
  // Organization operations
  APPLY_ORGANIZATION: { windowMs: 60 * 60 * 1000, maxRequests: 1 }, // 1 per hour
  
  // Authentication operations
  LOGIN_ATTEMPT: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 per 15 minutes
  SIGNUP_ATTEMPT: { windowMs: 60 * 1000, maxRequests: 3 }, // 3 per minute
  
  // File operations
  FILE_UPLOAD: { windowMs: 5 * 60 * 1000, maxRequests: 10 }, // 10 per 5 minutes
  FILE_DOWNLOAD: { windowMs: 60 * 1000, maxRequests: 50 }, // 50 per minute
  
  // API validation operations
  API_VALIDATION: { windowMs: 60 * 1000, maxRequests: 20 }, // 20 per minute
  
  // Default fallback
  DEFAULT: { windowMs: 60 * 1000, maxRequests: 30 } // 30 per minute
} as const;

/**
 * Generate a rate limit key
 */
function generateKey(identifier: string, action: string, customKeyGen?: (id: string, action: string) => string): string {
  if (customKeyGen) {
    return customKeyGen(identifier, action);
  }
  return `ratelimit:${action}:${identifier}`;
}

/**
 * Check if a request is allowed under the rate limit
 */
export async function checkRateLimit(
  identifier: string,
  action: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = generateKey(identifier, action, config.keyGenerator);
  const now = Date.now();

  try {
    // Get current rate limit data from Redis
    const entryData = await redisCache.get<RateLimitEntry>(key);
    let entry: RateLimitEntry | null = entryData;

    if (!entry || now >= entry.resetTime) {
      // First request or window has reset
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + config.windowMs
      };

      // Store in Redis with expiration
      await redisCache.set(key, newEntry, Math.ceil(config.windowMs / 1000));

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: newEntry.resetTime
      };
    }

    if (entry.count >= config.maxRequests) {
      // Rate limit exceeded - provide progressive feedback
      const timeRemaining = Math.ceil((entry.resetTime - now) / 1000);
      const resetTimeFormatted = formatTimeRemaining(timeRemaining);

      let feedbackMessage: string;
      let severity: 'warning' | 'error' = 'error';

      if (timeRemaining <= 30) {
        feedbackMessage = `Almost there! You can try again in ${resetTimeFormatted}.`;
        severity = 'warning';
      } else if (timeRemaining <= 300) { // 5 minutes
        feedbackMessage = `Please wait ${resetTimeFormatted} before trying again.`;
      } else {
        feedbackMessage = `Rate limit exceeded. Try again in ${resetTimeFormatted}.`;
      }

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        error: feedbackMessage,
        severity
      };
    }

    // Increment counter
    entry.count++;
    await redisCache.set(key, entry, Math.ceil((entry.resetTime - now) / 1000));

    // Provide feedback when approaching limit
    const remainingRequests = config.maxRequests - entry.count;
    let feedbackMessage: string | undefined;

    if (remainingRequests <= 2) {
      feedbackMessage = `Warning: Only ${remainingRequests} ${action.toLowerCase()} ${remainingRequests === 1 ? 'request' : 'requests'} remaining.`;
    }

    return {
      allowed: true,
      remaining: remainingRequests,
      resetTime: entry.resetTime,
      feedback: feedbackMessage
    };

  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fallback to allow request if Redis fails
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs
    };
  }
}

/**
 * Rate limit wrapper for action functions
 */
export async function withRateLimit<T>(
  identifier: string,
  action: string,
  config: RateLimitConfig,
  fn: () => Promise<T>
): Promise<T> {
  const rateLimitResult = await checkRateLimit(identifier, action, config);
  
  if (!rateLimitResult.allowed) {
    throw new Error(rateLimitResult.error || 'Rate limit exceeded');
  }

  return await fn();
}

/**
 * Get current rate limit status for debugging (Redis-based)
 */
export async function getRateLimitStatus(identifier: string, action: string): Promise<{
  exists: boolean;
  count?: number;
  resetTime?: number;
  timeUntilReset?: number;
}> {
  try {
    const key = generateKey(identifier, action);
    const data = await redisCache.get<RateLimitEntry>(key);
    
    if (!data) {
      return { exists: false };
    }

    const now = Date.now();
    
    return {
      exists: true,
      count: data.count,
      resetTime: data.resetTime,
      timeUntilReset: Math.max(0, data.resetTime - now)
    };
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    return { exists: false };
  }
}

/**
 * Clear rate limit for a specific identifier and action (for testing or admin override)
 */
export async function clearRateLimit(identifier: string, action: string): Promise<boolean> {
  try {
    const key = generateKey(identifier, action);
    await redisCache.delete(key);
    return true;
  } catch (error) {
    console.error('Error clearing rate limit:', error);
    return false;
  }
}

/**
 * IP-based rate limiting for unauthenticated requests
 */
export async function checkIPRateLimit(ip: string, action: string, config: RateLimitConfig): Promise<RateLimitResult> {
  return await checkRateLimit(`ip:${ip}`, action, config);
}

/**
 * User-based rate limiting for authenticated requests
 */
export async function checkUserRateLimit(userId: string, action: string, config: RateLimitConfig): Promise<RateLimitResult> {
  return await checkRateLimit(`user:${userId}`, action, config);
}

/**
 * Global rate limiting (shared across all users)
 */
export async function checkGlobalRateLimit(action: string, config: RateLimitConfig): Promise<RateLimitResult> {
  return await checkRateLimit('global', action, config);
}
