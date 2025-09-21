/**
 * Enhanced rate limiting with authentication-specific protections
 * Implements sliding window rate limiting with account lockout
 */

import { createAppError, ErrorType } from './error-handling';

interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxAttempts: number; // Max attempts per window
  blockDuration: number; // Block duration in milliseconds after exceeding limit
}

interface AuthRateLimitConfig extends RateLimitConfig {
  maxFailedLogins: number;    // Max failed logins before account lockout
  lockoutDuration: number;    // Account lockout duration in milliseconds
  progressiveDelay: boolean;  // Enable progressive delay on failures
}

// Rate limiting configurations
export const AUTH_RATE_LIMITS: Record<string, AuthRateLimitConfig> = {
  LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5,            // 5 attempts per IP per 15 min
    blockDuration: 30 * 60 * 1000, // 30 min IP block
    maxFailedLogins: 10,       // 10 failed logins = account lock
    lockoutDuration: 60 * 60 * 1000, // 1 hour account lockout
    progressiveDelay: true
  },
  SIGNUP: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3,           // 3 signups per IP per hour
    blockDuration: 60 * 60 * 1000, // 1 hour block
    maxFailedLogins: 5,
    lockoutDuration: 30 * 60 * 1000,
    progressiveDelay: false
  },
  PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3,           // 3 reset requests per email per hour
    blockDuration: 60 * 60 * 1000, // 1 hour block
    maxFailedLogins: 5,
    lockoutDuration: 60 * 60 * 1000,
    progressiveDelay: false
  }
};

// In-memory stores (in production, use Redis)
const ipAttempts = new Map<string, { count: number; firstAttempt: number; blockedUntil?: number }>();
const accountFailures = new Map<string, { count: number; lockedUntil?: number; lastFailure: number }>();
const progressiveDelays = new Map<string, number>();

/**
 * Gets client IP address from request headers
 */
function getClientIP(request?: Request): string {
  if (!request) return 'unknown';
  
  // Check common proxy headers
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }
  
  // Fallback to connection remote address
  return request.headers.get('x-vercel-forwarded-for') || 'unknown';
}

/**
 * Checks IP-based rate limiting
 */
function checkIPRateLimit(ip: string, config: AuthRateLimitConfig): { allowed: boolean; error?: string; retryAfter?: number } {
  const now = Date.now();
  const key = ip;
  
  // Check if IP is currently blocked
  const ipData = ipAttempts.get(key);
  if (ipData?.blockedUntil && now < ipData.blockedUntil) {
    const retryAfter = Math.ceil((ipData.blockedUntil - now) / 1000);
    return { 
      allowed: false, 
      error: `IP temporarily blocked. Try again in ${retryAfter} seconds.`,
      retryAfter 
    };
  }
  
  // Clean expired entries
  if (ipData && (now - ipData.firstAttempt) > config.windowMs) {
    ipAttempts.delete(key);
  }
  
  const currentData = ipAttempts.get(key) || { count: 0, firstAttempt: now };
  
  // Check if within rate limit
  if (currentData.count >= config.maxAttempts) {
    // Block the IP
    currentData.blockedUntil = now + config.blockDuration;
    ipAttempts.set(key, currentData);
    
    const retryAfter = Math.ceil(config.blockDuration / 1000);
    return { 
      allowed: false, 
      error: `Too many attempts. IP blocked for ${retryAfter} seconds.`,
      retryAfter 
    };
  }
  
  return { allowed: true };
}

/**
 * Records a failed authentication attempt
 */
function recordFailedAttempt(ip: string, email?: string, config?: AuthRateLimitConfig): void {
  const now = Date.now();
  
  // Record IP attempt
  const ipKey = ip;
  const ipData = ipAttempts.get(ipKey) || { count: 0, firstAttempt: now };
  ipData.count++;
  ipAttempts.set(ipKey, ipData);
  
  // Record account failure if email provided
  if (email && config) {
    const accountKey = email.toLowerCase();
    const accountData = accountFailures.get(accountKey) || { count: 0, lastFailure: now };
    accountData.count++;
    accountData.lastFailure = now;
    
    // Check if account should be locked
    if (accountData.count >= config.maxFailedLogins) {
      accountData.lockedUntil = now + config.lockoutDuration;
    }
    
    accountFailures.set(accountKey, accountData);
  }
}

/**
 * Records a successful authentication (resets counters)
 */
function recordSuccessfulAuth(ip: string, email?: string): void {
  // Reset IP counter
  ipAttempts.delete(ip);
  
  // Reset account counter
  if (email) {
    const accountKey = email.toLowerCase();
    accountFailures.delete(accountKey);
    progressiveDelays.delete(accountKey);
  }
}

/**
 * Checks if an account is locked
 */
function checkAccountLockout(email: string): { locked: boolean; error?: string; retryAfter?: number } {
  const accountKey = email.toLowerCase();
  const accountData = accountFailures.get(accountKey);
  
  if (!accountData?.lockedUntil) {
    return { locked: false };
  }
  
  const now = Date.now();
  if (now < accountData.lockedUntil) {
    const retryAfter = Math.ceil((accountData.lockedUntil - now) / 1000);
    return { 
      locked: true, 
      error: `Account temporarily locked. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
      retryAfter 
    };
  }
  
  // Lockout expired, clean up
  accountFailures.delete(accountKey);
  return { locked: false };
}

/**
 * Implements progressive delay for repeated failures
 */
async function applyProgressiveDelay(email: string): Promise<void> {
  const accountKey = email.toLowerCase();
  const accountData = accountFailures.get(accountKey);
  
  if (!accountData || accountData.count <= 1) {
    return; // No delay for first attempt
  }
  
  // Progressive delay: 1s, 2s, 4s, 8s, etc.
  const delayMs = Math.min(Math.pow(2, accountData.count - 1) * 1000, 30000); // Max 30s
  
  return new Promise(resolve => {
    setTimeout(resolve, delayMs);
  });
}

/**
 * Comprehensive authentication rate limiting check
 */
export async function checkAuthRateLimit(
  operation: keyof typeof AUTH_RATE_LIMITS,
  email?: string,
  request?: Request
): Promise<{ allowed: boolean; error?: string; retryAfter?: number }> {
  const config = AUTH_RATE_LIMITS[operation];
  const ip = getClientIP(request);
  
  // Check IP rate limiting
  const ipCheck = checkIPRateLimit(ip, config);
  if (!ipCheck.allowed) {
    return ipCheck;
  }
  
  // Check account lockout if email provided
  if (email) {
    const lockoutCheck = checkAccountLockout(email);
    if (lockoutCheck.locked) {
      return { allowed: false, error: lockoutCheck.error, retryAfter: lockoutCheck.retryAfter };
    }
    
    // Apply progressive delay for login attempts
    if (operation === 'LOGIN' && config.progressiveDelay) {
      await applyProgressiveDelay(email);
    }
  }
  
  return { allowed: true };
}

/**
 * Records authentication result for rate limiting
 */
export function recordAuthResult(
  operation: keyof typeof AUTH_RATE_LIMITS,
  success: boolean,
  email?: string,
  request?: Request
): void {
  const config = AUTH_RATE_LIMITS[operation];
  const ip = getClientIP(request);
  
  if (success) {
    recordSuccessfulAuth(ip, email);
  } else {
    recordFailedAttempt(ip, email, config);
  }
}

/**
 * Gets rate limit status for debugging/monitoring
 */
export function getRateLimitStatus(email?: string, request?: Request) {
  const ip = getClientIP(request);
  
  return {
    ip: {
      address: ip,
      attempts: ipAttempts.get(ip)?.count || 0,
      blocked: ipAttempts.get(ip)?.blockedUntil ? new Date(ipAttempts.get(ip)!.blockedUntil!) : null
    },
    account: email ? {
      email,
      failures: accountFailures.get(email.toLowerCase())?.count || 0,
      locked: accountFailures.get(email.toLowerCase())?.lockedUntil ? new Date(accountFailures.get(email.toLowerCase())!.lockedUntil!) : null
    } : null
  };
}

/**
 * Cleanup expired entries (should be run periodically)
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();
  
  // Cleanup IP attempts
  for (const [key, data] of ipAttempts.entries()) {
    if (data.blockedUntil && now > data.blockedUntil) {
      ipAttempts.delete(key);
    }
  }
  
  // Cleanup account lockouts
  for (const [key, data] of accountFailures.entries()) {
    if (data.lockedUntil && now > data.lockedUntil) {
      accountFailures.delete(key);
    }
  }
}
