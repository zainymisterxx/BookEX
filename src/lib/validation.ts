/**
 * Input validation and sanitization utilities for BookEx
 * Provides comprehensive validation for all user inputs
 */

import { ObjectId } from 'mongodb';

// Constants for validation limits
export const VALIDATION_LIMITS = {
  SEARCH_QUERY_MAX_LENGTH: 200,
  CITY_NAME_MAX_LENGTH: 100,
  GENRE_MAX_LENGTH: 50,
  CONDITION_MAX_LENGTH: 20,
  PAGE_MAX_VALUE: 10000,
  LIMIT_MAX_VALUE: 100,
  BOOK_TITLE_MAX_LENGTH: 200,
  AUTHOR_NAME_MAX_LENGTH: 150,
  DESCRIPTION_MAX_LENGTH: 1000,
} as const;

// Allowed values for enums
export const ALLOWED_VALUES = {
  BOOK_CONDITIONS: ['new', 'like-new', 'used', 'worn'] as const,
  SORT_OPTIONS: ['newest', 'oldest', 'title-asc', 'title-desc', 'relevance', 'price-low', 'price-high'] as const,
  BOOK_TYPES: ['sell', 'exchange'] as const,
} as const;

/**
 * Validation error class for consistent error handling
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Sanitizes string input by trimming and limiting length
 */
export function sanitizeString(input: unknown, maxLength: number): string | undefined {
  if (typeof input !== 'string') return undefined;
  
  const trimmed = input.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > maxLength) {
    throw new ValidationError(`Input too long. Maximum ${maxLength} characters allowed.`);
  }
  
  // Remove potential XSS characters
  const sanitized = trimmed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  return sanitized;
}

/**
 * Validates and sanitizes MongoDB ObjectId
 */
export function validateObjectId(input: unknown): ObjectId {
  if (!input) {
    throw new ValidationError('ID is required');
  }
  
  const id = typeof input === 'string' ? input : String(input);
  
  if (!ObjectId.isValid(id)) {
    throw new ValidationError('Invalid ID format');
  }
  
  return new ObjectId(id);
}

/**
 * Validates pagination parameters
 */
export function validatePagination(page?: unknown, limit?: unknown): { page: number; limit: number } {
  let validatedPage = 1;
  let validatedLimit = 12;
  
  if (page !== undefined) {
    const pageNum = typeof page === 'string' ? parseInt(page) : Number(page);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > VALIDATION_LIMITS.PAGE_MAX_VALUE) {
      throw new ValidationError('Invalid page number');
    }
    validatedPage = pageNum;
  }
  
  if (limit !== undefined) {
    const limitNum = typeof limit === 'string' ? parseInt(limit) : Number(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > VALIDATION_LIMITS.LIMIT_MAX_VALUE) {
      throw new ValidationError('Invalid limit value');
    }
    validatedLimit = limitNum;
  }
  
  return { page: validatedPage, limit: validatedLimit };
}

/**
 * Validates enum values
 */
export function validateEnum<T extends readonly string[]>(
  input: unknown, 
  allowedValues: T, 
  fieldName: string
): T[number] | undefined {
  if (!input) return undefined;
  
  const value = typeof input === 'string' ? input : String(input);
  
  if (!allowedValues.includes(value as T[number])) {
    throw new ValidationError(`Invalid ${fieldName}. Must be one of: ${allowedValues.join(', ')}`);
  }
  
  return value as T[number];
}

/**
 * Validates search query and sanitizes it
 */
export function validateSearchQuery(input: unknown): string | undefined {
  const sanitized = sanitizeString(input, VALIDATION_LIMITS.SEARCH_QUERY_MAX_LENGTH);
  
  if (sanitized) {
    // Additional validation for search queries
    // Prevent regex injection
    const dangerousPatterns = /[\\^$.*+?()[\]{}|]/g;
    if (dangerousPatterns.test(sanitized)) {
      // Escape special regex characters
      return sanitized.replace(dangerousPatterns, '\\$&');
    }
  }
  
  return sanitized;
}

/**
 * Validates book exchange filters
 */
export interface ValidatedExchangeFilters {
  searchQuery?: string;
  genre?: string;
  condition?: typeof ALLOWED_VALUES.BOOK_CONDITIONS[number];
  city?: string;
  sortBy?: typeof ALLOWED_VALUES.SORT_OPTIONS[number];
  page: number;
  limit: number;
}

export function validateExchangeFilters(filters: Record<string, unknown>): ValidatedExchangeFilters {
  try {
    const searchQuery = validateSearchQuery(filters.searchQuery);
    const genre = sanitizeString(filters.genre, VALIDATION_LIMITS.GENRE_MAX_LENGTH);
    const condition = validateEnum(filters.condition, ALLOWED_VALUES.BOOK_CONDITIONS, 'condition');
    const city = sanitizeString(filters.city, VALIDATION_LIMITS.CITY_NAME_MAX_LENGTH);
    const sortBy = validateEnum(filters.sortBy, ALLOWED_VALUES.SORT_OPTIONS, 'sortBy') || 'relevance';
    const { page, limit } = validatePagination(filters.page, filters.limit);

    return {
      searchQuery,
      genre,
      condition,
      city,
      sortBy,
      page,
      limit
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Invalid filter parameters');
  }
}

/**
 * Validates chat parameters
 */
export interface ValidatedChatParams {
  otherUserId: ObjectId;
  bookId: ObjectId;
  currentUserId: ObjectId;
}

export function validateChatParams(
  otherUserId: unknown, 
  bookId: unknown, 
  currentUserId: unknown
): ValidatedChatParams {
  const validatedOtherUserId = validateObjectId(otherUserId);
  const validatedBookId = validateObjectId(bookId);
  const validatedCurrentUserId = validateObjectId(currentUserId);
  
  // Check that user isn't trying to chat with themselves
  if (validatedOtherUserId.equals(validatedCurrentUserId)) {
    throw new ValidationError('Cannot start a conversation with yourself');
  }
  
  return {
    otherUserId: validatedOtherUserId,
    bookId: validatedBookId,
    currentUserId: validatedCurrentUserId
  };
}

import { validateUserCityCanonical as validateCityFromDatabase } from './location/location-validation';

/**
 * Validates and sanitizes user city using the city database
 */
export async function validateUserCity(city: unknown): Promise<string> {
  if (!city || typeof city !== 'string' || city.trim().length === 0) {
    throw new ValidationError('City is required');
  }

  const validation = await validateCityFromDatabase(city);
  if (!validation.isValid) {
    throw new ValidationError(validation.error || 'Invalid city');
  }

  return validation.city!.normalized; // Return the canonical normalized key for storage
}

/**
 * Rate limiting validation
 */
export function validateRateLimit(lastActionTime?: Date, minIntervalMs: number = 1000): void {
  if (lastActionTime) {
    const timeSinceLastAction = Date.now() - lastActionTime.getTime();
    if (timeSinceLastAction < minIntervalMs) {
      throw new ValidationError('Too many requests. Please wait before trying again.');
    }
  }
}

/**
 * Validates book data for exchange
 */
export interface ValidatedBookData {
  title: string;
  author: string;
  description?: string;
  genre?: string;
  condition: typeof ALLOWED_VALUES.BOOK_CONDITIONS[number];
  city: string;
  type: typeof ALLOWED_VALUES.BOOK_TYPES[number];
}

export async function validateBookData(bookData: Record<string, unknown>): Promise<ValidatedBookData> {
  const title = sanitizeString(bookData.title, VALIDATION_LIMITS.BOOK_TITLE_MAX_LENGTH);
  const author = sanitizeString(bookData.author, VALIDATION_LIMITS.AUTHOR_NAME_MAX_LENGTH);
  const description = sanitizeString(bookData.description, VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH);
  const genre = sanitizeString(bookData.genre, VALIDATION_LIMITS.GENRE_MAX_LENGTH);
  const condition = validateEnum(bookData.condition, ALLOWED_VALUES.BOOK_CONDITIONS, 'condition');
  const city = await validateUserCity(bookData.city);
  const type = validateEnum(bookData.type, ALLOWED_VALUES.BOOK_TYPES, 'book type');
  
  if (!title) throw new ValidationError('Book title is required');
  if (!author) throw new ValidationError('Book author is required');
  if (!condition) throw new ValidationError('Book condition is required');
  if (!type) throw new ValidationError('Book type is required');
  
  return {
    title,
    author,
    description,
    genre,
    condition,
    city,
    type
  };
}
