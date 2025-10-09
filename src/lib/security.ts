/**
 * Security middleware and utilities for BookEx
 * Provides rate limiting, request validation, and security headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl } from './url-utils';

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limit configurations for different endpoints
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/chat': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many chat requests. Please wait before trying again.'
  },
  '/api/books': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    message: 'Too many book requests. Please slow down.'
  },
  '/api/exchange': {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 20,
    message: 'Too many exchange requests. Please wait before trying again.'
  }
};

/**
 * Rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig) {
  return (identifier: string): boolean => {
    const now = Date.now();
    const key = identifier;
    
    // Clean up expired entries
    const entry = rateLimitStore.get(key);
    if (entry && now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
    
    // Get or create entry
    const current = rateLimitStore.get(key) || { count: 0, resetTime: now + config.windowMs };
    
    // Check if limit exceeded
    if (current.count >= config.maxRequests) {
      return false;
    }
    
    // Increment counter
    current.count++;
    rateLimitStore.set(key, current);
    
    return true;
  };
}

/**
 * Get client identifier for rate limiting
 */
export function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : (request as any).ip || 'unknown';
  
  // Include user agent for better tracking
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `${ip}:${userAgent.slice(0, 50)}`;
}

/**
 * Security headers middleware
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent XSS attacks
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Prevent information disclosure
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy for additional protection
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  );
  
  return response;
}

/**
 * Validate request origin
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // Allow requests without origin (direct API calls, mobile apps)
  if (!origin && !referer) {
    return true;
  }
  
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    getBaseUrl(),
    'http://localhost:3000',
    'https://localhost:3000',
    'http://localhost:9002'
  ].filter(Boolean);
  
  return allowedOrigins.some(allowed => 
    origin?.startsWith(allowed!) || referer?.startsWith(allowed!)
  );
}

/**
 * Sanitize request body to prevent injection attacks
 */
export function sanitizeRequestBody(body: any): any {
  if (typeof body === 'string') {
    // Remove potentially dangerous content
    return body
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }
  
  if (Array.isArray(body)) {
    return body.map(sanitizeRequestBody);
  }
  
  if (body && typeof body === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(body)) {
      sanitized[key] = sanitizeRequestBody(value);
    }
    return sanitized;
  }
  
  return body;
}

/**
 * Validate Content-Type for API requests
 */
export function validateContentType(request: NextRequest): boolean {
  const contentType = request.headers.get('content-type');
  
  if (request.method === 'GET' || request.method === 'HEAD') {
    return true;
  }
  
  if (!contentType) {
    return false;
  }
  
  const allowedTypes = [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data'
  ];
  
  return allowedTypes.some(type => contentType.includes(type));
}

/**
 * Log security events for monitoring
 */
export function logSecurityEvent(event: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    details,
    severity: 'warning'
  };
  
  // Log to console (replace with proper logging service in production)
  console.warn(`[SECURITY] ${timestamp}: ${event}`, details);
  
  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to monitoring service (e.g., Sentry, DataDog)
  }
}

/**
 * Create security middleware for API routes
 */
export function createSecurityMiddleware(config?: Partial<RateLimitConfig>) {
  return async (request: NextRequest) => {
    const pathname = new URL(request.url).pathname;
    
    // Validate origin
    if (!validateOrigin(request)) {
      logSecurityEvent('INVALID_ORIGIN', { 
        origin: request.headers.get('origin'),
        pathname 
      });
      return NextResponse.json(
        { error: 'Invalid origin' },
        { status: 403 }
      );
    }
    
    // Validate content type
    if (!validateContentType(request)) {
      logSecurityEvent('INVALID_CONTENT_TYPE', {
        contentType: request.headers.get('content-type'),
        pathname
      });
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }
    
    // Apply rate limiting
    const defaultConfig = RATE_LIMITS['/api/books'];
    const rateLimitConfig = {
      windowMs: config?.windowMs || defaultConfig.windowMs,
      maxRequests: config?.maxRequests || defaultConfig.maxRequests,
      message: config?.message || defaultConfig.message
    };
    const clientId = getClientIdentifier(request);
    const limiter = rateLimit(rateLimitConfig);
    
    if (!limiter(clientId)) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', { 
        clientId: clientId.split(':')[0], // Don't log full user agent
        pathname 
      });
      return NextResponse.json(
        { error: rateLimitConfig.message },
        { status: 429 }
      );
    }
    
    return null; // Continue processing
  };
}

/**
 * Middleware for protecting exchange-specific operations
 */
export async function validateExchangePermissions(
  userId: string,
  targetUserId: string,
  bookId?: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Import required modules
    const { MongoClient } = await import('mongodb');
    const clientPromise = (await import('./mongodb')).default;
    
    const client = await clientPromise;
    const db = client.db('bookex');
    
    // Get both users
    const [user, targetUser] = await Promise.all([
      db.collection('users').findOne({ _id: new (await import('mongodb')).ObjectId(userId) }),
      db.collection('users').findOne({ _id: new (await import('mongodb')).ObjectId(targetUserId) })
    ]);
    
    if (!user || !targetUser) {
      return { valid: false, error: 'User not found' };
    }
    
    // Check if both users have cities set
    if (!user.city || !targetUser.city) {
      return { 
        valid: false, 
        error: 'Both users must have their city set for exchanges' 
      };
    }
    
    // Check same city requirement
    if (user.city.toLowerCase().trim() !== targetUser.city.toLowerCase().trim()) {
      return { 
        valid: false, 
        error: 'Book exchanges are only available within the same city' 
      };
    }
    
    // If bookId provided, validate book
    if (bookId) {
      const book = await db.collection('books').findOne({ 
        _id: new (await import('mongodb')).ObjectId(bookId) 
      });
      
      if (!book) {
        return { valid: false, error: 'Book not found' };
      }
      
      if (book.type !== 'exchange') {
        return { valid: false, error: 'Book is not available for exchange' };
      }
      
      if (book.sellerId === userId) {
        return { valid: false, error: 'Cannot exchange with your own book' };
      }
    }
    
    return { valid: true };
    
  } catch (error) {
    console.error('Error validating exchange permissions:', error);
    return { valid: false, error: 'Permission validation failed' };
  }
}
