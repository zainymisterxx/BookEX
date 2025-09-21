/**
 * Password validation utilities for BookEx
 * Comprehensive password strength validation with detailed feedback
 */

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0-5 scale
  strength: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';
  feedback: string[];
  suggestions: string[];
}

/**
 * Validates password strength with detailed feedback
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const feedback: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Length check
  if (password.length < 8) {
    feedback.push('Password is too short');
    suggestions.push('Use at least 8 characters');
  } else if (password.length >= 12) {
    score += 1;
  } else if (password.length >= 10) {
    score += 0.5;
  }

  // Character variety checks
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasLowercase) {
    feedback.push('Missing lowercase letter');
    suggestions.push('Add lowercase letters (a-z)');
  } else {
    score += 1;
  }

  if (!hasUppercase) {
    feedback.push('Missing uppercase letter');
    suggestions.push('Add uppercase letters (A-Z)');
  } else {
    score += 1;
  }

  if (!hasNumber) {
    feedback.push('Missing number');
    suggestions.push('Add numbers (0-9)');
  } else {
    score += 1;
  }

  if (!hasSpecialChar) {
    feedback.push('Missing special character');
    suggestions.push('Add special characters (!@#$%^&*)');
  } else {
    score += 1;
  }

  // Common patterns to avoid
  const commonPatterns = [
    /(.)\1{2,}/, // Repeated characters (aaa, 111)
    /123456|654321/, // Sequential numbers
    /abcdef|fedcba/, // Sequential letters
    /qwerty|asdf|zxcv/, // Keyboard patterns
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password.toLowerCase())) {
      feedback.push('Contains common patterns');
      suggestions.push('Avoid common patterns like "123456" or "qwerty"');
      score -= 0.5;
      break;
    }
  }

  // Dictionary words check (basic)
  const commonWords = ['password', 'admin', 'user', 'login', 'welcome', 'bookex'];
  const lowerPassword = password.toLowerCase();
  for (const word of commonWords) {
    if (lowerPassword.includes(word)) {
      feedback.push('Contains common words');
      suggestions.push('Avoid common words like "password" or "admin"');
      score -= 0.5;
      break;
    }
  }

  // Ensure score doesn't go below 0
  score = Math.max(0, score);

  // Determine strength level
  let strength: PasswordValidationResult['strength'];
  if (score >= 4) {
    strength = 'strong';
  } else if (score >= 3) {
    strength = 'good';
  } else if (score >= 2) {
    strength = 'fair';
  } else if (score >= 1) {
    strength = 'weak';
  } else {
    strength = 'very-weak';
  }

  // If no feedback, password is valid
  const isValid = feedback.length === 0 && score >= 3;

  return {
    isValid,
    score,
    strength,
    feedback,
    suggestions
  };
}

/**
 * Simple password strength check (backward compatibility)
 */
export function isPasswordStrong(password: string): boolean {
  const result = validatePasswordStrength(password);
  return result.isValid;
}

/**
 * Gets user-friendly password requirements message
 */
export function getPasswordRequirementsMessage(): string {
  return 'Password must be at least 8 characters and contain: uppercase letter, lowercase letter, number, and special character.';
}

/**
 * Gets detailed password strength message
 */
export function getPasswordStrengthMessage(result: PasswordValidationResult): string {
  if (result.isValid) {
    return `Password strength: ${result.strength.replace('-', ' ')}`;
  }

  const issues = result.feedback.join(', ');
  return `Password issues: ${issues}`;
}

/**
 * Validates password doesn't contain personal information
 */
export function validatePasswordAgainstPersonalInfo(
  password: string,
  personalInfo: {
    name?: string;
    email?: string;
    phone?: string;
  }
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  const lowerPassword = password.toLowerCase();

  // Check against name
  if (personalInfo.name) {
    const nameParts = personalInfo.name.toLowerCase().split(' ');
    for (const part of nameParts) {
      if (part.length > 2 && lowerPassword.includes(part)) {
        issues.push('Contains parts of your name');
        break;
      }
    }
  }

  // Check against email
  if (personalInfo.email) {
    const emailPrefix = personalInfo.email.split('@')[0].toLowerCase();
    if (emailPrefix.length > 2 && lowerPassword.includes(emailPrefix)) {
      issues.push('Contains parts of your email');
    }
  }

  // Check against phone
  if (personalInfo.phone) {
    const phoneDigits = personalInfo.phone.replace(/\D/g, '');
    if (phoneDigits.length >= 4 && lowerPassword.includes(phoneDigits)) {
      issues.push('Contains parts of your phone number');
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}
