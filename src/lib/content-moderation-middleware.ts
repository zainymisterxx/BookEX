/**
 * Content Moderation Middleware
 * Automatically validates content during creation/updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { ContentModerationSystem } from '@/lib/content-moderation';
import { createAppError, ErrorType } from '@/lib/error-handling';

/**
 * Middleware to validate book content before saving
 */
export async function validateBookContentMiddleware(
  bookData: any,
  userId: string
): Promise<{ isApproved: boolean; warnings: string[]; errors: string[] }> {
  try {
    const result = await ContentModerationSystem.validateBookContent(bookData, userId);
    
    // Auto-record moderation action
    if (!result.isApproved) {
      await ContentModerationSystem.recordModerationAction(
        userId,
        bookData._id || 'pending',
        'book',
        result.action,
        result.flags
      );
    }

    return {
      isApproved: result.isApproved,
      warnings: result.action === 'flag' ? result.reasons : [],
      errors: !result.isApproved ? result.reasons : []
    };
  } catch (error) {
    throw createAppError(
      ErrorType.VALIDATION,
      'Content validation failed',
      undefined,
      undefined,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Middleware to validate post content before saving
 */
export async function validatePostContentMiddleware(
  postData: any,
  userId: string
): Promise<{ isApproved: boolean; warnings: string[]; errors: string[] }> {
  try {
    const result = await ContentModerationSystem.validatePostContent(postData, userId);
    
    // Auto-record moderation action
    if (!result.isApproved) {
      await ContentModerationSystem.recordModerationAction(
        userId,
        postData._id || 'pending',
        'post',
        result.action,
        result.flags
      );
    }

    return {
      isApproved: result.isApproved,
      warnings: result.action === 'flag' ? result.reasons : [],
      errors: !result.isApproved ? result.reasons : []
    };
  } catch (error) {
    throw createAppError(
      ErrorType.VALIDATION,
      'Content validation failed',
      undefined,
      undefined,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Middleware to validate profile content before saving
 */
export async function validateProfileContentMiddleware(
  profileData: any,
  userId: string
): Promise<{ isApproved: boolean; warnings: string[]; errors: string[] }> {
  try {
    const result = await ContentModerationSystem.validateProfileContent(profileData, userId);
    
    // Auto-record moderation action
    if (!result.isApproved) {
      await ContentModerationSystem.recordModerationAction(
        userId,
        userId, // Profile moderation uses userId as contentId
        'profile',
        result.action,
        result.flags
      );
    }

    return {
      isApproved: result.isApproved,
      warnings: result.action === 'flag' ? result.reasons : [],
      errors: !result.isApproved ? result.reasons : []
    };
  } catch (error) {
    throw createAppError(
      ErrorType.VALIDATION,
      'Content validation failed',
      undefined,
      undefined,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Pre-publish content filter
 */
export async function prePublishFilter(
  content: string,
  contentType: 'book' | 'post' | 'comment' | 'profile',
  userId: string
): Promise<{
  canPublish: boolean;
  requiresReview: boolean;
  blockedReasons: string[];
  warnings: string[];
}> {
  try {
    const result = await ContentModerationSystem.analyzeContent(content, contentType, userId);
    
    const canPublish = result.action !== 'reject';
    const requiresReview = result.action === 'quarantine' || result.action === 'flag';
    
    return {
      canPublish,
      requiresReview,
      blockedReasons: !canPublish ? result.reasons : [],
      warnings: requiresReview ? result.reasons : []
    };
  } catch (error) {
    throw createAppError(
      ErrorType.VALIDATION,
      'Pre-publish filter failed',
      undefined,
      undefined,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Real-time content validation for forms
 */
export async function validateContentRealtime(
  content: string,
  contentType: 'book' | 'post' | 'comment' | 'profile'
): Promise<{
  isValid: boolean;
  confidence: number;
  suggestions: string[];
  warnings: string[];
}> {
  try {
    // Basic validation without user context (for real-time feedback)
    const spam = ContentModerationSystem['detectSpam'](content);
    const hasInappropriate = /\b(sex|drugs|violence|explicit)\b/i.test(content);
    const hasProfanity = /\b(fuck|shit|damn|hell)\b/i.test(content);
    
    const suggestions: string[] = [];
    const warnings: string[] = [];
    
    if (spam.isSpam) {
      warnings.push('Content appears promotional - consider revising');
      suggestions.push('Remove promotional language and contact information');
    }
    
    if (hasInappropriate) {
      warnings.push('Content may contain inappropriate material');
      suggestions.push('Review content for inappropriate references');
    }
    
    if (hasProfanity) {
      warnings.push('Content contains strong language');
      suggestions.push('Consider using milder language');
    }
    
    const isValid = warnings.length === 0;
    const confidence = Math.max(0, 100 - (warnings.length * 30));
    
    return {
      isValid,
      confidence,
      suggestions,
      warnings
    };
  } catch (error) {
    throw createAppError(
      ErrorType.VALIDATION,
      'Real-time validation failed',
      undefined,
      undefined,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * User reputation checker middleware
 */
export async function checkUserReputationMiddleware(
  userId: string
): Promise<{
  canPost: boolean;
  canUpload: boolean;
  needsApproval: boolean;
  reputationLevel: string;
  warnings: string[];
}> {
  try {
    const reputation = await ContentModerationSystem.getUserReputation(userId);
    
    const canPost = reputation.level !== 'banned';
    const canUpload = reputation.level !== 'banned' && reputation.level !== 'flagged';
    const needsApproval = reputation.level === 'flagged' || reputation.level === 'new';
    
    const warnings: string[] = [];
    
    if (reputation.level === 'flagged') {
      warnings.push('Account is flagged - content requires approval');
    }
    
    if (reputation.violations > 3) {
      warnings.push('Multiple policy violations detected');
    }
    
    return {
      canPost,
      canUpload,
      needsApproval,
      reputationLevel: reputation.level,
      warnings
    };
  } catch (error) {
    throw createAppError(
      ErrorType.VALIDATION,
      'Reputation check failed',
      undefined,
      undefined,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}
