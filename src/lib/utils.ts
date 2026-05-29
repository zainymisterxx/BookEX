import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import crypto from 'crypto'
import type { BookStatus } from './types'

/**
 * Combines multiple class names with Tailwind CSS class merging
 * Uses clsx for conditional classes and tailwind-merge for conflicting Tailwind classes
 * 
 * @param inputs - Variable number of class values (strings, objects, arrays)
 * @returns Merged and deduplicated class string
 * 
 * @example
 * cn('px-4 py-2', 'bg-blue-500', { 'text-white': true }) 
 * // Returns: 'px-4 py-2 bg-blue-500 text-white'
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validates and converts a File object to a Base64-encoded data URI.
 * @param file The file to convert.
 * @returns A promise that resolves with the data URI.
 * @throws Error if file validation fails.
 */
export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate file before processing
    const validationResult = validateFileUpload(file);
    if (!validationResult.isValid) {
      reject(new Error(validationResult.error));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Validates file upload requirements for security and performance.
 * @param file The file to validate.
 * @returns Object with validation result and error message if invalid.
 */
export function validateFileUpload(file: File): { isValid: boolean; error?: string } {
  // Check file size (max 5MB)
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return { isValid: false, error: 'File size must be less than 5MB' };
  }

  // Check file type - only allow specific image formats
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { isValid: false, error: 'Only JPEG, PNG, and WebP images are allowed' };
  }

  // Check file extension as additional security
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (!allowedExtensions.includes(fileExtension)) {
    return { isValid: false, error: 'Invalid file extension' };
  }

  // Basic file name validation
  if (file.name.length > 255) {
    return { isValid: false, error: 'File name too long' };
  }

  return { isValid: true };
}

/**
 * Validates and sanitizes image data URI for storage.
 * @param dataUri The data URI to validate.
 * @returns Object with validation result and error message if invalid.
 */
export function validateImageDataUri(dataUri: string): { isValid: boolean; error?: string } {
  // Check if it's a valid data URI format
  const dataUriRegex = /^data:image\/(jpeg|jpg|png|webp);base64,/;
  if (!dataUriRegex.test(dataUri)) {
    return { isValid: false, error: 'Invalid image data format' };
  }

  // Check data URI size (base64 is ~33% larger than original)
  const MAX_DATA_URI_SIZE = 7 * 1024 * 1024; // ~5MB file = ~7MB base64
  if (dataUri.length > MAX_DATA_URI_SIZE) {
    return { isValid: false, error: 'Image data too large' };
  }

  return { isValid: true };
}

/**
 * Sanitizes user input to prevent XSS attacks.
 * @param input The input string to sanitize.
 * @returns Sanitized string with dangerous characters escaped.
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Escapes special regex characters to prevent injection attacks
 * @param string The string to escape for safe regex use
 * @returns Escaped string safe for regex patterns
 */
export function escapeRegex(string: string): string {
  if (!string || typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Creates a safe case-insensitive regex for exact matching
 * @param input The input to create regex for
 * @returns Safe regex object or null if input invalid
 */
export function createSafeExactMatchRegex(input: string): RegExp | null {
  if (!input || typeof input !== 'string') return null;
  const sanitized = sanitizeInput(input.trim());
  if (!sanitized) return null;
  const escaped = escapeRegex(sanitized);
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Encodes HTML entities for safe display in notifications
 * @param text The text to encode
 * @returns HTML-safe encoded text
 */
export function encodeForNotificationDisplay(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>')
    .trim();
}

/**
 * Validates book data for listing.
 * @param bookData The book data to validate.
 * @returns Object with validation result and error message if invalid.
 */
export function validateBookData(bookData: any): { isValid: boolean; error?: string } {
  // Required fields validation
  if (!bookData.title || typeof bookData.title !== 'string' || bookData.title.trim().length === 0) {
    return { isValid: false, error: 'Book title is required' };
  }
  
  if (!bookData.author || typeof bookData.author !== 'string' || bookData.author.trim().length === 0) {
    return { isValid: false, error: 'Book author is required' };
  }
  
  if (!bookData.description || typeof bookData.description !== 'string' || bookData.description.trim().length === 0) {
    return { isValid: false, error: 'Book description is required' };
  }

  // Length validation
  if (bookData.title.length > 200) {
    return { isValid: false, error: 'Title too long (max 200 characters)' };
  }
  
  if (bookData.author.length > 100) {
    return { isValid: false, error: 'Author name too long (max 100 characters)' };
  }
  
  if (bookData.description.length > 2000) {
    return { isValid: false, error: 'Description too long (max 2000 characters)' };
  }

  // Enum validation
  const validGenres = ['fiction', 'non-fiction', 'science', 'history', 'biography', 'mystery', 'romance', 'fantasy', 'thriller', 'self-help', 'children', 'education', 'religion', 'other'];
  if (!validGenres.includes(bookData.genre)) {
    return { isValid: false, error: 'Invalid book genre' };
  }

  const validConditions = ['new', 'like-new', 'used', 'worn'];
  if (!validConditions.includes(bookData.condition)) {
    return { isValid: false, error: 'Invalid book condition' };
  }

  const validTypes = ['sell', 'exchange'];
  if (!validTypes.includes(bookData.type)) {
    return { isValid: false, error: 'Invalid listing type' };
  }

  // Price validation for sell type
  if (bookData.type === 'sell') {
    if (bookData.price === undefined || bookData.price === null) {
      return { isValid: false, error: 'Price is required for sale listings' };
    }
    
    if (typeof bookData.price !== 'number' || isNaN(bookData.price)) {
      return { isValid: false, error: 'Price must be a valid number' };
    }
    
    if (bookData.price < 0) {
      return { isValid: false, error: 'Price cannot be negative' };
    }
    
    if (bookData.price > 100000) {
      return { isValid: false, error: 'Price too high (max PKR 100,000)' };
    }
  }

  // City validation - accept either normalized key or legacy city string
  if (!bookData.cityNormalized && (!bookData.city || typeof bookData.city !== 'string' || bookData.city.trim().length === 0)) {
    return { isValid: false, error: 'City is required' };
  }

  return { isValid: true };
}

/**
 * Validates organization data for applications
 * @param orgData The organization data to validate
 * @returns Validation result with error message if invalid
 */
export function validateOrganizationData(orgData: {
  name: string;
  description: string;
  location: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
}): { isValid: boolean; error?: string } {
  // Validate required fields
  if (!orgData.name || typeof orgData.name !== 'string' || orgData.name.trim().length === 0) {
    return { isValid: false, error: 'Organization name is required' };
  }

  if (orgData.name.trim().length < 2 || orgData.name.trim().length > 100) {
    return { isValid: false, error: 'Organization name must be between 2 and 100 characters' };
  }

  if (!orgData.description || typeof orgData.description !== 'string' || orgData.description.trim().length === 0) {
    return { isValid: false, error: 'Description is required' };
  }

  if (orgData.description.trim().length < 10 || orgData.description.trim().length > 1000) {
    return { isValid: false, error: 'Description must be between 10 and 1000 characters' };
  }

  if (!orgData.location || typeof orgData.location !== 'string' || orgData.location.trim().length === 0) {
    return { isValid: false, error: 'Location is required' };
  }

  // Validate optional contact email
  if (orgData.contactEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(orgData.contactEmail)) {
      return { isValid: false, error: 'Invalid email format' };
    }
  }

  // Validate optional phone
  if (orgData.contactPhone) {
    // Basic phone validation - adjust regex as needed for your region
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(orgData.contactPhone.replace(/[\s\-\(\)]/g, ''))) {
      return { isValid: false, error: 'Invalid phone number format' };
    }
  }

  // Validate optional website
  if (orgData.website) {
    try {
      new URL(orgData.website);
    } catch {
      return { isValid: false, error: 'Invalid website URL format' };
    }
  }

  return { isValid: true };
}

/**
 * Sanitizes organization name to prevent duplicate similar names
 * @param name The organization name to sanitize
 * @returns Sanitized name for comparison
 */
export function sanitizeOrganizationName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

// ===== BOOK STATUS MANAGEMENT UTILITIES =====

/**
 * Validates book status transitions
 * @param currentStatus Current book status
 * @param newStatus Proposed new status
 * @param bookType Type of book (sell/exchange)
 * @returns Whether the transition is valid
 */
export function isValidStatusTransition(
  currentStatus: BookStatus, 
  newStatus: BookStatus, 
  bookType: 'sell' | 'exchange'
): { isValid: boolean; error?: string } {
  // Define valid transitions
  const validTransitions: Record<BookStatus, BookStatus[]> = {
    'active': ['sold', 'exchanged', 'inactive', 'expired', 'reserved'],
    'sold': ['active'],
    'exchanged': ['active'],
    'inactive': ['active', 'expired'],
    'expired': ['active'],
    'reserved': ['active', 'exchanged'],  // restored on cancel, finalised on completion
    'donated': [],                         // terminal — cannot transition out
  };

  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    return { 
      isValid: false, 
      error: `Cannot change status from ${currentStatus} to ${newStatus}` 
    };
  }

  // Business rule: sell books can't be marked as exchanged
  if (bookType === 'sell' && newStatus === 'exchanged') {
    return { 
      isValid: false, 
      error: 'Sell listings cannot be marked as exchanged' 
    };
  }

  // Business rule: exchange books can't be marked as sold
  if (bookType === 'exchange' && newStatus === 'sold') {
    return { 
      isValid: false, 
      error: 'Exchange listings cannot be marked as sold' 
    };
  }

  return { isValid: true };
}

/**
 * Determines if a book should be visible in listings
 * @param status Book status
 * @param expiresAt Optional expiration date
 * @returns Whether book should be visible
 */
export function isBookVisible(status: BookStatus, expiresAt?: string): boolean {
  // Only active books are visible
  if (status !== 'active') return false;
  
  // Check expiration
  if (expiresAt) {
    const now = new Date();
    const expiry = new Date(expiresAt);
    if (now > expiry) return false;
  }
  
  return true;
}

/**
 * Calculates expiration date for new listings
 * @param type Book type
 * @returns ISO date string for expiration
 */
export function calculateExpirationDate(type: 'sell' | 'exchange'): string {
  const now = new Date();
  // Sell listings expire in 60 days, exchange in 90 days
  const daysToAdd = type === 'sell' ? 60 : 90;
  now.setDate(now.getDate() + daysToAdd);
  return now.toISOString();
}

// ===== BOOK DEDUPLICATION UTILITIES =====

/**
 * Normalizes text for duplicate detection
 * @param text Input text
 * @returns Normalized text
 */
export function normalizeForDeduplication(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .toLowerCase()
    .trim()
    // Remove common prefixes/suffixes
    .replace(/^(the\s+|a\s+|an\s+)/i, '')
    .replace(/(\s+book|\s+novel|\s+story)$/i, '')
    // Remove special characters and normalize whitespace
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Creates a duplicate detection hash for a book
 * @param title Book title
 * @param author Book author
 * @param sellerId User ID of seller
 * @returns Hash string for duplicate detection
 */
export function createBookDuplicateHash(title: string, author: string, sellerId: string): string {
  const normalizedTitle = normalizeForDeduplication(title);
  const normalizedAuthor = normalizeForDeduplication(author);
  
  // Include seller ID to allow same book from different users
  const combined = `${normalizedTitle}::${normalizedAuthor}::${sellerId}`;
  
  return crypto.createHash('sha256').update(combined).digest('hex');
}

/**
 * Checks if two books are potential duplicates
 * @param book1 First book data
 * @param book2 Second book data
 * @returns Similarity score (0-1) and whether they're duplicates
 */
export function checkBookSimilarity(
  book1: { title: string; author: string; sellerId: string },
  book2: { title: string; author: string; sellerId: string }
): { isDuplicate: boolean; similarity: number; reason?: string } {
  // Same seller check
  if (book1.sellerId !== book2.sellerId) {
    return { isDuplicate: false, similarity: 0, reason: 'Different sellers' };
  }

  const title1 = normalizeForDeduplication(book1.title);
  const title2 = normalizeForDeduplication(book2.title);
  const author1 = normalizeForDeduplication(book1.author);
  const author2 = normalizeForDeduplication(book2.author);

  // Exact match check
  if (title1 === title2 && author1 === author2) {
    return { isDuplicate: true, similarity: 1.0, reason: 'Exact match' };
  }

  // Calculate Levenshtein distance for similarity
  const titleSimilarity = calculateSimilarity(title1, title2);
  const authorSimilarity = calculateSimilarity(author1, author2);
  
  // Weighted average (title is more important)
  const overallSimilarity = (titleSimilarity * 0.7) + (authorSimilarity * 0.3);
  
  // Consider duplicates if similarity > 90%
  const isDuplicate = overallSimilarity > 0.9;
  
  return { 
    isDuplicate, 
    similarity: overallSimilarity,
    reason: isDuplicate ? 'High similarity detected' : undefined
  };
}

/**
 * Calculates text similarity using Levenshtein distance
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity score (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;
  
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
}

/**
 * Calculates Levenshtein distance between two strings
 * @param str1 First string
 * @param str2 Second string
 * @returns Edit distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1, // deletion
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i - 1] + 1 // substitution
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// ===== NOTIFICATION DEDUPLICATION =====

/**
 * Creates a unique key for notification deduplication
 * @param userId User ID receiving notification
 * @param type Notification type
 * @param bookId Related book ID
 * @returns Unique key for deduplication
 */
export function createNotificationDeduplicationKey(
  userId: string, 
  type: string, 
  bookId: string
): string {
  return crypto.createHash('sha256')
    .update(`${userId}::${type}::${bookId}`)
    .digest('hex');
}

// ===== RETRY UTILITY FUNCTIONS =====

/**
 * Configuration for retry operations
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryCondition?: (error: any) => boolean;
}

/**
 * Default retry configuration for critical operations
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
  retryCondition: (error) => {
    // Retry on network errors, timeouts, and temporary server errors
    if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT' || error?.code === 'ENOTFOUND') {
      return true;
    }
    if (error?.response?.status >= 500 && error?.response?.status < 600) {
      return true;
    }
    return false;
  }
};

/**
 * Executes a function with retry logic
 * @param fn Function to execute
 * @param config Retry configuration
 * @param context Optional context for logging
 * @returns Promise with the function result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context: string = 'operation'
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: any;

  for (let attempt = 1; attempt <= finalConfig.maxRetries + 1; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) {
        console.log(`✅ ${context} succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;

      // Don't retry on the last attempt
      if (attempt > finalConfig.maxRetries) {
        console.error(`❌ ${context} failed after ${finalConfig.maxRetries + 1} attempts:`, error);
        throw error;
      }

      // Check if we should retry this error
      if (finalConfig.retryCondition && !finalConfig.retryCondition(error)) {
        console.error(`❌ ${context} failed with non-retryable error on attempt ${attempt}:`, error);
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        finalConfig.baseDelay * Math.pow(finalConfig.backoffFactor, attempt - 1),
        finalConfig.maxDelay
      );

      console.warn(`⚠️ ${context} failed on attempt ${attempt}, retrying in ${delay}ms:`, (error as any)?.message || error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Specialized retry for email operations
 */
export async function withEmailRetry<T>(
  fn: () => Promise<T>,
  context: string = 'email'
): Promise<T> {
  return withRetry(
    fn,
    {
      maxRetries: 3,
      baseDelay: 2000, // 2 seconds for email
      maxDelay: 15000, // 15 seconds max
      retryCondition: (error) => {
        // Retry on SMTP errors, connection issues, and rate limits
        const message = error?.message?.toLowerCase() || '';
        return message.includes('smtp') ||
               message.includes('connection') ||
               message.includes('timeout') ||
               message.includes('rate limit') ||
               message.includes('temporary failure');
      }
    },
    context
  );
}

/**
 * Specialized retry for database operations
 */
export async function withDatabaseRetry<T>(
  fn: () => Promise<T>,
  context: string = 'database'
): Promise<T> {
  return withRetry(
    fn,
    {
      maxRetries: 2, // Fewer retries for DB operations
      baseDelay: 500, // Shorter delay for DB
      maxDelay: 5000, // 5 seconds max
      retryCondition: (error) => {
        // Retry on connection errors and temporary failures
        const message = error?.message?.toLowerCase() || '';
        return message.includes('connection') ||
               message.includes('timeout') ||
               message.includes('temporarily') ||
               message.includes('unavailable') ||
               error?.code === 'ECONNRESET';
      }
    },
    context
  );
}
