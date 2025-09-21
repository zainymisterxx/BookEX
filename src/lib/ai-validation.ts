import { z } from 'zod';

// Input validation schemas
export const aiInputSchemas = {
  bookSummary: z.object({
    title: z.string().min(1).max(200).trim(),
    author: z.string().min(1).max(100).trim(),
    additionalInfo: z.string().max(1000).trim().optional(),
  }),

  bookRecommendations: z.object({
    preferences: z.string().min(1).max(500).trim(),
    genres: z.array(z.string().min(1).max(50)).max(10).optional(),
    excludeGenres: z.array(z.string().min(1).max(50)).max(10).optional(),
    authorPreferences: z.string().max(200).trim().optional(),
  }),

  intelligentSearch: z.object({
    query: z.string().min(1).max(300).trim(),
    filters: z.object({
      genre: z.string().max(50).optional(),
      condition: z.enum(['new', 'like-new', 'very-good', 'good', 'fair', 'poor']).optional(),
      location: z.string().max(100).optional(),
      priceRange: z.object({
        min: z.number().min(0).max(10000).optional(),
        max: z.number().min(0).max(10000).optional(),
      }).optional(),
    }).optional(),
  }),

  bookCondition: z.object({
    bookTitle: z.string().min(1).max(200).trim(),
    imageData: z.string().max(10 * 1024 * 1024), // 10MB base64 limit
    imageType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    additionalNotes: z.string().max(500).trim().optional(),
  }),

  assistantQuery: z.object({
    message: z.string().min(1).max(1000).trim(),
    context: z.object({
      currentPage: z.string().max(100).optional(),
      userAction: z.string().max(200).optional(),
    }).optional(),
  }),
};

export type AIInputTypes = {
  [K in keyof typeof aiInputSchemas]: z.infer<typeof aiInputSchemas[K]>
};

/**
 * Sanitize text input to prevent injection attacks
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  return input
    .trim()
    // Remove potentially dangerous HTML/XML tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    // Remove JavaScript protocol
    .replace(/javascript:/gi, '')
    // Remove data URLs (except for images which are validated separately)
    .replace(/data:(?!image\/[a-zA-Z]+;base64,)/gi, '')
    // Remove SQL injection patterns
    .replace(/(\b(DROP|DELETE|INSERT|UPDATE|SELECT|UNION|ALTER|CREATE)\b)/gi, '')
    // Remove NoSQL injection patterns
    .replace(/\$\w+/g, '')
    .replace(/\{.*\}/g, '')
    // Limit consecutive characters to prevent spam
    .replace(/(.)\1{10,}/g, '$1$1$1$1$1');
}

/**
 * Validate and sanitize AI input
 */
export function validateAIInput<T extends keyof typeof aiInputSchemas>(
  type: T,
  data: unknown
): AIInputTypes[T] {
  try {
    const schema = aiInputSchemas[type];
    const result = schema.parse(data);

    // Apply additional sanitization to string fields
    if (typeof result === 'object' && result !== null) {
      return sanitizeObjectStrings(result) as AIInputTypes[T];
    }

    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      throw new Error(`Validation failed: ${formattedErrors}`);
    }
    throw error;
  }
}

/**
 * Recursively sanitize string values in an object
 */
function sanitizeObjectStrings(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObjectStrings);
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObjectStrings(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Validate image data for book condition analysis
 */
export function validateImageData(imageData: string, imageType: string): {
  isValid: boolean;
  error?: string;
  sizeBytes?: number;
} {
  try {
    // Check if it's a valid base64 string
    if (!imageData.match(/^[A-Za-z0-9+/]*={0,2}$/)) {
      return { isValid: false, error: 'Invalid base64 format' };
    }

    // Calculate size in bytes
    const sizeBytes = (imageData.length * 3) / 4;
    
    // Check file size (10MB limit)
    if (sizeBytes > 10 * 1024 * 1024) {
      return { isValid: false, error: 'File size exceeds 10MB limit' };
    }

    // Check minimum size (1KB)
    if (sizeBytes < 1024) {
      return { isValid: false, error: 'File size too small (minimum 1KB)' };
    }

    // Validate image type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(imageType)) {
      return { isValid: false, error: 'Invalid image type. Allowed: JPEG, PNG, WebP' };
    }

    return { isValid: true, sizeBytes };
  } catch (error) {
    return { isValid: false, error: 'Invalid image data' };
  }
}

/**
 * Rate limiting validation
 */
export function validateRateLimit(
  remaining: number,
  resetTime: Date,
  operation: string
): void {
  if (remaining <= 0) {
    const resetTimeStr = resetTime.toLocaleString();
    throw new Error(
      `Rate limit exceeded for ${operation}. Please try again after ${resetTimeStr}`
    );
  }
}

/**
 * Content filtering for inappropriate content
 */
export function checkContentPolicy(text: string): {
  isAcceptable: boolean;
  issues?: string[];
} {
  const blockedPatterns = [
    // Explicit content
    /\b(explicit|adult|sexual|porn|xxx)\b/i,
    // Harmful content
    /\b(violence|kill|murder|suicide|self-harm)\b/i,
    // Illegal content
    /\b(illegal|drugs|weapons|bomb|terrorist)\b/i,
    // Spam patterns
    /\b(buy now|click here|free money|get rich quick)\b/i,
  ];

  const issues: string[] = [];

  for (const pattern of blockedPatterns) {
    if (pattern.test(text)) {
      issues.push(`Content contains inappropriate material: ${pattern.source}`);
    }
  }

  return {
    isAcceptable: issues.length === 0,
    issues: issues.length > 0 ? issues : undefined,
  };
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
