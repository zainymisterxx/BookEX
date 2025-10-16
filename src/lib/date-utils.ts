/**
 * Standardized Date Handling Utility for BookEx
 * Provides consistent date formatting, timezone handling, and date operations
 */

// Date format constants
export const DATE_FORMATS = {
  ISO_STRING: 'ISO_STRING', // 2024-01-15T10:30:00.000Z
  ISO_DATE: 'ISO_DATE', // 2024-01-15
  DISPLAY_DATE: 'DISPLAY_DATE', // Jan 15, 2024
  DISPLAY_DATETIME: 'DISPLAY_DATETIME', // Jan 15, 2024 at 10:30 AM
  RELATIVE_TIME: 'RELATIVE_TIME', // 2 hours ago, yesterday, etc.
} as const;

export type DateFormat = typeof DATE_FORMATS[keyof typeof DATE_FORMATS];

// Timezone handling
export const TIMEZONE = {
  UTC: 'UTC',
  LOCAL: 'LOCAL',
} as const;

export type Timezone = typeof TIMEZONE[keyof typeof TIMEZONE];

/**
 * Get current timestamp in ISO string format (consistent with database)
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Get current date in ISO date format (YYYY-MM-DD)
 */
export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Convert Date object to ISO string
 */
export function dateToISOString(date: Date | string | number): string {
  if (typeof date === 'string' || typeof date === 'number') {
    return new Date(date).toISOString();
  }
  return date.toISOString();
}

/**
 * Convert ISO string to Date object
 */
export function isoStringToDate(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Format date for display purposes
 */
export function formatDate(
  date: Date | string | number,
  format: DateFormat = DATE_FORMATS.DISPLAY_DATE,
  timezone: Timezone = TIMEZONE.LOCAL
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;

  // Handle invalid dates
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  const utcDate = timezone === TIMEZONE.UTC ? dateObj : new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000);
  const localDate = timezone === TIMEZONE.LOCAL ? dateObj : new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000);

  switch (format) {
    case DATE_FORMATS.ISO_STRING:
      return utcDate.toISOString();

    case DATE_FORMATS.ISO_DATE:
      return utcDate.toISOString().split('T')[0];

    case DATE_FORMATS.DISPLAY_DATE:
      return localDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

    case DATE_FORMATS.DISPLAY_DATETIME:
      return localDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

    case DATE_FORMATS.RELATIVE_TIME:
      return getRelativeTime(dateObj);

    default:
      return localDate.toLocaleDateString('en-US');
  }
}

/**
 * Get relative time string (e.g., "2 hours ago", "yesterday")
 */
export function getRelativeTime(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;

  const now = new Date();
  const diffInMs = now.getTime() - dateObj.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) {
    return 'just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  } else if (diffInDays === 1) {
    return 'yesterday';
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  } else if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  } else {
    const years = Math.floor(diffInDays / 365);
    return `${years} year${years === 1 ? '' : 's'} ago`;
  }
}

/**
 * Check if a date is expired (past a certain point)
 */
export function isExpired(date: Date | string | number, compareTo?: Date): boolean {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;

  const compareDate = compareTo || new Date();
  return dateObj.getTime() < compareDate.getTime();
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date | string | number, compareTo?: Date): boolean {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;

  const compareDate = compareTo || new Date();
  return dateObj.getTime() > compareDate.getTime();
}

/**
 * Add days to a date
 */
export function addDays(date: Date | string | number, days: number): Date {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;

  const result = new Date(dateObj);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add hours to a date
 */
export function addHours(date: Date | string | number, hours: number): Date {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;

  const result = new Date(dateObj);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * Calculate age from birth date
 */
export function calculateAge(birthDate: Date | string | number): number {
  const birth = typeof birthDate === 'string' || typeof birthDate === 'number'
    ? new Date(birthDate)
    : birthDate;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

/**
 * Validate date string format
 */
export function isValidDateString(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString === date.toISOString();
}

/**
 * Parse date from various formats
 */
export function parseDate(input: string | number | Date): Date | null {
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === 'number') {
    const date = new Date(input);
    return isNaN(date.getTime()) ? null : date;
  }

  if (typeof input === 'string') {
    // Try ISO string first
    const isoDate = new Date(input);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // Try common formats
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{2})\/(\d{2})\/(\d{4})$/, // MM/DD/YYYY
      /^(\d{2})-(\d{2})-(\d{4})$/, // MM-DD-YYYY
    ];

    for (const format of formats) {
      const match = input.match(format);
      if (match) {
        const date = new Date(input);
        return isNaN(date.getTime()) ? null : date;
      }
    }
  }

  return null;
}

/**
 * Get date range for filtering
 */
export function getDateRange(
  period: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear'
): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'yesterday':
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;

    case 'thisWeek':
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + (6 - dayOfWeek));
      end.setHours(23, 59, 59, 999);
      break;

    case 'lastWeek':
      const lastWeekStart = new Date(start);
      lastWeekStart.setDate(start.getDate() - start.getDay() - 7);
      lastWeekStart.setHours(0, 0, 0, 0);
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
      lastWeekEnd.setHours(23, 59, 59, 999);
      return { start: lastWeekStart, end: lastWeekEnd };

    case 'thisMonth':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'lastMonth':
      start.setMonth(start.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'thisYear':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
}

/**
 * Format date for database storage (ISO string)
 */
export function formatForDatabase(date: Date | string | number): string {
  return dateToISOString(date);
}

/**
 * Format date for API responses
 */
export function formatForAPI(date: Date | string | number): {
  iso: string;
  display: string;
  relative: string;
} {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;

  return {
    iso: dateToISOString(dateObj),
    display: formatDate(dateObj, DATE_FORMATS.DISPLAY_DATETIME),
    relative: getRelativeTime(dateObj)
  };
}

/**
 * Validate date range
 */
export function isValidDateRange(start: Date | string, end: Date | string): boolean {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;

  return startDate.getTime() <= endDate.getTime();
}

/**
 * Get business days between two dates (excluding weekends)
 */
export function getBusinessDays(start: Date | string, end: Date | string): number {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;

  let businessDays = 0;
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
      businessDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return businessDays;
}
