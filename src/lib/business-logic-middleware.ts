/**
 * Business Logic Validation Middleware
 * Integrates business logic security into existing book and exchange operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { BusinessLogicSecurity } from '@/lib/business-logic-security';
import { createAppError, ErrorType } from '@/lib/error-handling';

/**
 * Validates book listing data before processing
 */
export async function validateBookListingMiddleware(
  bookData: any,
  userId: string,
  isUpdate: boolean = false
): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
  try {
    const validation = await BusinessLogicSecurity.validateBookListing(
      bookData,
      userId,
      isUpdate
    );

    return {
      isValid: validation.isValid,
      errors: validation.conflicts,
      warnings: validation.warnings
    };
  } catch (error) {
    throw createAppError(
      ErrorType.VALIDATION,
      'Book listing validation failed',
      undefined,
      undefined,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Validates exchange proposal before processing
 */
export async function validateExchangeMiddleware(
  proposerBookId: string,
  responderBookId: string,
  proposerId: string
): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
  try {
    const validation = await BusinessLogicSecurity.validateExchangeProposal(
      proposerBookId,
      responderBookId,
      proposerId
    );

    return {
      isValid: validation.isValid,
      errors: validation.conflicts,
      warnings: validation.warnings
    };
  } catch (error) {
    throw createAppError(
      ErrorType.VALIDATION,
      'Exchange validation failed',
      undefined,
      undefined,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Validates user activity for suspicious patterns
 */
export async function validateUserActivityMiddleware(
  userId: string
): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
  try {
    const validation = await BusinessLogicSecurity.validateUserActivity(userId);

    return {
      isValid: validation.isValid,
      errors: validation.conflicts,
      warnings: validation.warnings
    };
  } catch (error) {
    throw createAppError(
      ErrorType.VALIDATION,
      'User activity validation failed',
      undefined,
      undefined,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Acquires a transaction lock with automatic cleanup
 */
export async function withTransactionLock<T>(
  resourceId: string,
  resourceType: 'book' | 'user' | 'exchange',
  userId: string,
  operation: string,
  callback: () => Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  // Try to acquire lock
  const lockAcquired = await BusinessLogicSecurity.acquireLock(
    resourceId,
    resourceType,
    userId,
    operation
  );

  if (!lockAcquired) {
    throw createAppError(
      ErrorType.BUSINESS_LOGIC,
      'Resource is currently locked by another operation',
      undefined,
      undefined,
      { resourceId, resourceType, operation }
    );
  }

  // Set up automatic lock release
  const timeout = setTimeout(async () => {
    await BusinessLogicSecurity.releaseLock(resourceId, userId);
  }, timeoutMs);

  try {
    const result = await callback();
    return result;
  } finally {
    clearTimeout(timeout);
    await BusinessLogicSecurity.releaseLock(resourceId, userId);
  }
}

/**
 * Middleware factory for book operations
 */
export function createBookOperationMiddleware(operation: string) {
  return async function(
    request: NextRequest,
    context: { params: any },
    next: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    try {
      const session = request.headers.get('x-user-session');
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const userId = JSON.parse(session).user.id;
      const body = await request.json();

      // Validate user activity first
      const userValidation = await validateUserActivityMiddleware(userId);
      if (!userValidation.isValid) {
        return NextResponse.json({
          error: 'Account flagged for suspicious activity',
          details: userValidation.errors
        }, { status: 403 });
      }

      // Add warnings to response headers if any
      if (userValidation.warnings.length > 0) {
        // Store warnings to be added to response later
        request.headers.set('x-validation-warnings', JSON.stringify(userValidation.warnings));
      }

      return next();
    } catch (error) {
      return NextResponse.json({
        error: 'Validation middleware failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  };
}

/**
 * Validation response helper
 */
export function createValidationResponse(
  isValid: boolean,
  errors: string[],
  warnings: string[],
  data?: any
): NextResponse {
  const response = {
    isValid,
    errors,
    warnings,
    ...(data && { data })
  };

  const status = isValid ? 200 : 400;
  return NextResponse.json(response, { status });
}

/**
 * Helper to check for duplicate books before listing
 */
export async function checkDuplicatesMiddleware(
  title: string,
  author: string,
  userId: string,
  excludeBookId?: string
): Promise<{ hasDuplicates: boolean; similarity: number; duplicateIds: string[] }> {
  try {
    return await BusinessLogicSecurity.checkDuplicateBooks(
      title,
      author,
      userId,
      excludeBookId
    );
  } catch (error) {
    throw createAppError(
      ErrorType.VALIDATION,
      'Duplicate check failed',
      undefined,
      undefined,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}
