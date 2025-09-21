/**
 * Error handling utilities for consistent error management across the application
 */

export enum ErrorType {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT = 'RATE_LIMIT',
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
  FILE_UPLOAD = 'FILE_UPLOAD',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  EXTERNAL_API = 'EXTERNAL_API',
  SECURITY = 'SECURITY',
  INTERNAL = 'INTERNAL'
}

export interface AppError {
  type: ErrorType;
  message: string;
  userMessage: string;
  statusCode: number;
  details?: any;
  timestamp: string;
  action?: string;
}

/**
 * Creates a standardized error object
 */
export function createAppError(
  type: ErrorType,
  message: string,
  userMessage?: string,
  statusCode?: number,
  details?: any,
  action?: string
): AppError {
  return {
    type,
    message,
    userMessage: userMessage || getUserFriendlyMessage(type),
    statusCode: statusCode || getDefaultStatusCode(type),
    details,
    timestamp: new Date().toISOString(),
    action
  };
}

/**
 * Gets user-friendly error messages based on error type
 */
function getUserFriendlyMessage(type: ErrorType): string {
  switch (type) {
    case ErrorType.VALIDATION:
      return 'Please check your input and try again.';
    case ErrorType.AUTHENTICATION:
      return 'Please log in to continue.';
    case ErrorType.AUTHORIZATION:
      return 'You do not have permission to perform this action.';
    case ErrorType.NOT_FOUND:
      return 'The requested item could not be found.';
    case ErrorType.RATE_LIMIT:
      return 'Too many requests. Please wait a moment and try again.';
    case ErrorType.DATABASE:
      return 'A database error occurred. Please try again later.';
    case ErrorType.NETWORK:
      return 'Network connection error. Please check your connection.';
    case ErrorType.FILE_UPLOAD:
      return 'File upload failed. Please check the file and try again.';
    case ErrorType.BUSINESS_LOGIC:
      return 'This action cannot be completed due to business rules.';
    case ErrorType.INTERNAL:
      return 'An unexpected error occurred. Please try again later.';
    default:
      return 'An unexpected error occurred. Please try again later.';
  }
}

/**
 * Gets default HTTP status codes for error types
 */
function getDefaultStatusCode(type: ErrorType): number {
  switch (type) {
    case ErrorType.VALIDATION:
      return 400;
    case ErrorType.AUTHENTICATION:
      return 401;
    case ErrorType.AUTHORIZATION:
      return 403;
    case ErrorType.NOT_FOUND:
      return 404;
    case ErrorType.RATE_LIMIT:
      return 429;
    case ErrorType.DATABASE:
      return 503;
    case ErrorType.NETWORK:
      return 502;
    case ErrorType.FILE_UPLOAD:
      return 400;
    case ErrorType.BUSINESS_LOGIC:
      return 422;
    case ErrorType.INTERNAL:
      return 500;
    default:
      return 500;
  }
}

/**
 * Logs errors with appropriate level and context
 */
export function logError(error: AppError, context?: any): void {
  const logData = {
    error,
    context,
    timestamp: new Date().toISOString()
  };

  // Log different error types with different severity
  switch (error.type) {
    case ErrorType.AUTHENTICATION:
    case ErrorType.AUTHORIZATION:
    case ErrorType.RATE_LIMIT:
      console.warn('Security/Auth Error:', logData);
      break;
    
    case ErrorType.DATABASE:
    case ErrorType.INTERNAL:
      console.error('Critical Error:', logData);
      break;
    
    case ErrorType.VALIDATION:
    case ErrorType.BUSINESS_LOGIC:
      console.info('Business Logic Error:', logData);
      break;
    
    default:
      console.error('Application Error:', logData);
  }
}

/**
 * Converts unknown errors to AppError format
 */
export function normalizeError(error: unknown, action?: string): AppError {
  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes('Unauthorized')) {
      return createAppError(ErrorType.AUTHORIZATION, error.message, undefined, undefined, undefined, action);
    }
    
    if (error.message.includes('not found') || error.message.includes('Not found')) {
      return createAppError(ErrorType.NOT_FOUND, error.message, undefined, undefined, undefined, action);
    }
    
    if (error.message.includes('validation') || error.message.includes('required') || error.message.includes('invalid')) {
      return createAppError(ErrorType.VALIDATION, error.message, undefined, undefined, undefined, action);
    }
    
    if (error.message.includes('rate limit') || error.message.includes('too many')) {
      return createAppError(ErrorType.RATE_LIMIT, error.message, undefined, undefined, undefined, action);
    }

    // Default to internal error
    return createAppError(ErrorType.INTERNAL, error.message, undefined, undefined, error.stack, action);
  }

  // Handle string errors
  if (typeof error === 'string') {
    return createAppError(ErrorType.INTERNAL, error, undefined, undefined, undefined, action);
  }

  // Handle unknown error types
  return createAppError(
    ErrorType.INTERNAL, 
    'An unknown error occurred', 
    undefined, 
    undefined, 
    error, 
    action
  );
}

/**
 * Standard success response format
 */
export interface SuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  error: AppError;
}

/**
 * Creates a success response
 */
export function createSuccessResponse<T>(data?: T, message?: string): SuccessResponse<T> {
  return {
    success: true,
    data,
    message
  };
}

/**
 * Creates an error response
 */
export function createErrorResponse(error: AppError): ErrorResponse {
  return {
    success: false,
    error
  };
}

/**
 * Wrapper for action functions with consistent error handling
 */
export async function withErrorHandling<T>(
  action: () => Promise<T>,
  actionName: string
): Promise<SuccessResponse<T> | ErrorResponse> {
  try {
    const result = await action();
    return createSuccessResponse(result);
  } catch (error) {
    const appError = normalizeError(error, actionName);
    logError(appError, { actionName });
    return createErrorResponse(appError);
  }
}

/**
 * Handles API errors by converting them to NextResponse objects
 */
export function handleApiError(error: unknown): Response {
  let appError: AppError;

  if (error && typeof error === 'object' && 'type' in error) {
    appError = error as AppError;
  } else if (error instanceof Error) {
    appError = normalizeError(error);
  } else {
    appError = createAppError(ErrorType.INTERNAL, 'Unknown error occurred');
  }

  logError(appError);

  const errorResponse = createErrorResponse(appError);
  
  return new Response(
    JSON.stringify(errorResponse),
    {
      status: appError.statusCode || 500,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
