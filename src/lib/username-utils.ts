// Utility functions for validating and normalizing usernames

const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/; // lowercase only, 3-24 chars

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): { valid: boolean; error?: string } {
  const value = normalizeUsername(raw);
  if (!value) return { valid: false, error: 'Username is required.' };
  if (value.length < 3) return { valid: false, error: 'Username must be at least 3 characters.' };
  if (value.length > 24) return { valid: false, error: 'Username must be at most 24 characters.' };
  if (!USERNAME_REGEX.test(value)) return { valid: false, error: 'Only lowercase letters, numbers, and underscores allowed.' };
  if (/__/.test(value)) return { valid: false, error: 'Avoid multiple consecutive underscores.' };
  if (/^[0-9_]+$/.test(value)) return { valid: false, error: 'Username must contain at least one letter.' };
  return { valid: true };
}
