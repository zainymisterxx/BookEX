/**
 * Structured Logging Utility
 * 
 * Provides a centralized logging solution with log levels, structured data,
 * and environment-aware behavior. Replaces console.log throughout the application.
 * 
 * @module logger
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  stack?: string;
}

/**
 * Logger class for structured logging
 */
class Logger {
  private isDevelopment: boolean;
  private isProduction: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Formats a log entry for output
   */
  private formatLog(entry: LogEntry): string {
    const { timestamp, level, message, context, stack } = entry;
    
    if (this.isDevelopment) {
      // Human-readable format for development
      let output = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
      if (context && Object.keys(context).length > 0) {
        output += `\n  Context: ${JSON.stringify(context, null, 2)}`;
      }
      if (stack) {
        output += `\n  Stack: ${stack}`;
      }
      return output;
    } else {
      // JSON format for production (easier for log aggregation)
      return JSON.stringify(entry);
    }
  }

  /**
   * Creates a log entry
   */
  private createEntry(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      stack: error?.stack
    };
  }

  /**
   * Logs a debug message (only in development)
   * Debug logs are automatically suppressed in production
   * 
   * @param message - Human-readable log message
   * @param context - Optional structured data (user IDs, request IDs, etc.)
   * 
   * @example
   * logger.debug('Processing request', { requestId: '123', userId: 'abc' });
   */
  debug(message: string, context?: LogContext): void {
    if (!this.isDevelopment) return;
    
    const entry = this.createEntry('debug', message, context);
    console.log(this.formatLog(entry));
  }

  /**
   * Logs an informational message
   * Use for important application events and state changes
   * 
   * @param message - Human-readable log message
   * @param context - Optional structured data for better searchability
   * 
   * @example
   * logger.info('User logged in', { userId: '123', method: 'google' });
   */
  info(message: string, context?: LogContext): void {
    const entry = this.createEntry('info', message, context);
    console.log(this.formatLog(entry));
  }

  /**
   * Logs a warning message
   * Use for recoverable issues that need attention
   * 
   * @param message - Human-readable warning message
   * @param context - Optional context data
   * 
   * @example
   * logger.warn('Redis connection failed, using fallback', { error: err.message });
   */
  warn(message: string, context?: LogContext): void {
    const entry = this.createEntry('warn', message, context);
    console.warn(this.formatLog(entry));
  }

  /**
   * Logs an error message
   * Use for exceptions and critical failures
   * 
   * @param message - Human-readable error message
   * @param error - Optional Error object for stack trace
   * @param context - Optional context data for debugging
   * 
   * @example
   * logger.error('Database query failed', error, { query: 'findOne', collection: 'users' });
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const entry = this.createEntry('error', message, context, error);
    console.error(this.formatLog(entry));
  }

  /**
   * Creates a child logger with a specific context that will be included in all logs
   */
  child(defaultContext: LogContext): Logger {
    const childLogger = new Logger();
    
    // Override methods to include default context
    const originalDebug = childLogger.debug.bind(childLogger);
    const originalInfo = childLogger.info.bind(childLogger);
    const originalWarn = childLogger.warn.bind(childLogger);
    const originalError = childLogger.error.bind(childLogger);

    childLogger.debug = (message: string, context?: LogContext) => {
      originalDebug(message, { ...defaultContext, ...context });
    };

    childLogger.info = (message: string, context?: LogContext) => {
      originalInfo(message, { ...defaultContext, ...context });
    };

    childLogger.warn = (message: string, context?: LogContext) => {
      originalWarn(message, { ...defaultContext, ...context });
    };

    childLogger.error = (message: string, error?: Error, context?: LogContext) => {
      originalError(message, error, { ...defaultContext, ...context });
    };

    return childLogger;
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for context
export type { LogContext };

/**
 * Usage Examples:
 * 
 * // Basic logging
 * logger.info('User logged in', { userId: '123' });
 * logger.error('Database connection failed', error);
 * logger.debug('Processing request', { route: '/api/books' });
 * 
 * // Child logger with default context
 * const socketLogger = logger.child({ service: 'socket-io' });
 * socketLogger.info('User connected', { socketId: 'abc123' });
 * socketLogger.error('Connection failed', error);
 */
