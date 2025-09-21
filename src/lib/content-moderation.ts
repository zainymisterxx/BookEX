/**
 * Content Moderation System for BookEx platform
 * Implements automated content filtering, community management, and abuse prevention
 */

import { ObjectId } from 'mongodb';
import clientPromise from './mongodb';
import { createAppError, ErrorType } from './error-handling';
import type { Book, User, Community, Post as CommunityPost } from './types';

export interface ModerationResult {
  isApproved: boolean;
  confidence: number;
  flags: string[];
  reasons: string[];
  action: 'approve' | 'flag' | 'reject' | 'quarantine';
}

export interface ContentAnalysis {
  toxicity: number;
  spam: number;
  profanity: number;
  inappropriate: number;
  promotional: number;
}

export interface SpamDetection {
  isSpam: boolean;
  score: number;
  indicators: string[];
}

export interface UserReputation {
  score: number;
  level: 'new' | 'trusted' | 'flagged' | 'banned';
  violations: number;
  positiveActions: number;
}

/**
 * Content moderation and community management system
 */
export class ContentModerationSystem {
  private static readonly TOXICITY_THRESHOLD = 0.7;
  private static readonly SPAM_THRESHOLD = 0.8;
  private static readonly PROFANITY_THRESHOLD = 0.6;
  
  // Common problematic patterns
  private static readonly SPAM_PATTERNS = [
    /\b(buy now|click here|limited time|act fast|guaranteed|make money)\b/gi,
    /\b(free|cheap|discount|sale|offer|deal)\b.*\b(whatsapp|telegram|email|contact)\b/gi,
    /\b(call|text|message)\s*\d{10,}/gi,
    /\b(visit|check|goto)\s*(www\.|http|bit\.ly)/gi
  ];

  private static readonly PROFANITY_WORDS = [
    'damn', 'hell', 'shit', 'fuck', 'bitch', 'asshole', 'bastard',
    // Add more as needed - this is a basic list
  ];

  private static readonly PROMOTIONAL_PATTERNS = [
    /\b(selling|buy|purchase|order|payment|price|cost|money)\b/gi,
    /\b(instagram|facebook|twitter|youtube|tiktok)\b/gi,
    /\b(follow me|subscribe|like and share)\b/gi
  ];

  /**
   * Analyzes content for moderation flags
   */
  static async analyzeContent(
    content: string,
    contentType: 'book' | 'post' | 'comment' | 'profile',
    userId: string
  ): Promise<ModerationResult> {
    try {
      const analysis = await this.performContentAnalysis(content, contentType);
      const userReputation = await this.getUserReputation(userId);
      
      // Adjust thresholds based on user reputation
      const reputationMultiplier = this.getReputationMultiplier(userReputation.level);
      
      const flags: string[] = [];
      const reasons: string[] = [];
      let action: 'approve' | 'flag' | 'reject' | 'quarantine' = 'approve';
      
      // Check toxicity
      if (analysis.toxicity > (this.TOXICITY_THRESHOLD * reputationMultiplier)) {
        flags.push('toxicity');
        reasons.push('Content contains potentially harmful or toxic language');
        action = 'reject';
      }

      // Check spam
      if (analysis.spam > (this.SPAM_THRESHOLD * reputationMultiplier)) {
        flags.push('spam');
        reasons.push('Content appears to be spam or promotional');
        action = action === 'approve' ? 'flag' : action;
      }

      // Check profanity
      if (analysis.profanity > (this.PROFANITY_THRESHOLD * reputationMultiplier)) {
        flags.push('profanity');
        reasons.push('Content contains inappropriate language');
        action = action === 'approve' ? 'flag' : action;
      }

      // Check inappropriate content
      if (analysis.inappropriate > 0.5) {
        flags.push('inappropriate');
        reasons.push('Content may be inappropriate for this platform');
        action = action === 'approve' ? 'quarantine' : action;
      }

      // Check promotional content (more lenient for book descriptions)
      const promotionalThreshold = contentType === 'book' ? 0.9 : 0.7;
      if (analysis.promotional > promotionalThreshold) {
        flags.push('promotional');
        reasons.push('Content appears overly promotional');
        action = action === 'approve' ? 'flag' : action;
      }

      // Calculate overall confidence
      const maxScore = Math.max(
        analysis.toxicity,
        analysis.spam,
        analysis.profanity,
        analysis.inappropriate,
        analysis.promotional
      );

      const confidence = Math.min(maxScore * 100, 100);

      return {
        isApproved: action === 'approve',
        confidence,
        flags,
        reasons,
        action
      };

    } catch (error) {
      throw createAppError(
        ErrorType.INTERNAL,
        'Content analysis failed',
        undefined,
        undefined,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Performs detailed content analysis
   */
  private static async performContentAnalysis(
    content: string,
    contentType: string
  ): Promise<ContentAnalysis> {
    const lowercaseContent = content.toLowerCase();
    
    // Toxicity detection (simple keyword-based)
    const toxicWords = ['hate', 'kill', 'die', 'stupid', 'idiot', 'loser'];
    const toxicMatches = toxicWords.filter(word => lowercaseContent.includes(word));
    const toxicity = Math.min(toxicMatches.length / 3, 1); // Normalize to 0-1

    // Spam detection
    const spamScore = this.detectSpam(content);
    
    // Profanity detection
    const profanityMatches = this.PROFANITY_WORDS.filter(word => 
      lowercaseContent.includes(word.toLowerCase())
    );
    const profanity = Math.min(profanityMatches.length / 2, 1);

    // Inappropriate content (basic detection)
    const inappropriateWords = ['sex', 'drugs', 'violence', 'adult', 'explicit'];
    const inappropriateMatches = inappropriateWords.filter(word => 
      lowercaseContent.includes(word)
    );
    const inappropriate = Math.min(inappropriateMatches.length / 2, 1);

    // Promotional content
    const promotionalMatches = this.PROMOTIONAL_PATTERNS.filter(pattern => 
      pattern.test(content)
    );
    const promotional = Math.min(promotionalMatches.length / 3, 1);

    return {
      toxicity,
      spam: spamScore.score,
      profanity,
      inappropriate,
      promotional
    };
  }

  /**
   * Detects spam patterns in content
   */
  private static detectSpam(content: string): SpamDetection {
    const indicators: string[] = [];
    let score = 0;

    // Check for spam patterns
    this.SPAM_PATTERNS.forEach((pattern, index) => {
      if (pattern.test(content)) {
        indicators.push(`Spam pattern ${index + 1} detected`);
        score += 0.3;
      }
    });

    // Check for excessive capitalization
    const capsPercentage = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsPercentage > 0.3) {
      indicators.push('Excessive capitalization');
      score += 0.2;
    }

    // Check for repeated characters
    if (/(.)\1{3,}/.test(content)) {
      indicators.push('Repeated characters');
      score += 0.1;
    }

    // Check for excessive punctuation
    const punctuationCount = (content.match(/[!?.,;:]{3,}/g) || []).length;
    if (punctuationCount > 0) {
      indicators.push('Excessive punctuation');
      score += 0.1;
    }

    return {
      isSpam: score >= this.SPAM_THRESHOLD,
      score: Math.min(score, 1),
      indicators
    };
  }

  /**
   * Gets user reputation score
   */
  static async getUserReputation(userId: string): Promise<UserReputation> {
    const client = await clientPromise;
    const db = client.db('bookex');

    try {
      // Get user's moderation history
      const moderationHistory = await db.collection('moderationActions').find({
        userId,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() } // Last 30 days
      }).toArray();

      const violations = moderationHistory.filter(action => 
        ['flag', 'reject', 'ban'].includes(action.action)
      ).length;

      const positiveActions = moderationHistory.filter(action => 
        action.action === 'approve'
      ).length;

      // Get user account age
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }) as User | null;
      const accountAge = user?.createdAt 
        ? Date.now() - new Date(user.createdAt).getTime()
        : 0;
      const daysSinceCreation = accountAge / (24 * 60 * 60 * 1000);

      // Calculate reputation score
      let score = 50; // Base score
      score += positiveActions * 10; // +10 for each approved content
      score -= violations * 20; // -20 for each violation
      score += Math.min(daysSinceCreation * 0.5, 50); // Account age bonus (max 50)

      // Determine reputation level
      let level: 'new' | 'trusted' | 'flagged' | 'banned';
      if (score >= 80) level = 'trusted';
      else if (score >= 30) level = 'new';
      else if (score >= 10) level = 'flagged';
      else level = 'banned';

      return {
        score: Math.max(0, Math.min(100, score)),
        level,
        violations,
        positiveActions
      };

    } catch (error) {
      throw createAppError(
        ErrorType.DATABASE,
        'Failed to get user reputation',
        undefined,
        undefined,
        { userId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Gets reputation multiplier for thresholds
   */
  private static getReputationMultiplier(level: string): number {
    switch (level) {
      case 'trusted': return 1.2; // More lenient for trusted users
      case 'new': return 1.0; // Normal thresholds
      case 'flagged': return 0.8; // Stricter for flagged users
      case 'banned': return 0.5; // Very strict for banned users
      default: return 1.0;
    }
  }

  /**
   * Records moderation action
   */
  static async recordModerationAction(
    userId: string,
    contentId: string,
    contentType: 'book' | 'post' | 'comment' | 'profile' | 'community',
    action: 'approve' | 'flag' | 'reject' | 'quarantine' | 'ban',
    flags: string[],
    moderatorId?: string,
    autoModerated: boolean = true
  ): Promise<void> {
    const client = await clientPromise;
    const db = client.db('bookex');

    try {
      await db.collection('moderationActions').insertOne({
        userId,
        contentId,
        contentType,
        action,
        flags,
        moderatorId,
        autoModerated,
        createdAt: new Date().toISOString()
      });

      // Update user status if necessary
      if (action === 'ban') {
        await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { 
            $set: { 
              status: 'suspended',
              suspendedAt: new Date().toISOString(),
              suspensionReason: flags.join(', ')
            }
          }
        );
      }

    } catch (error) {
      throw createAppError(
        ErrorType.DATABASE,
        'Failed to record moderation action',
        undefined,
        undefined,
        { userId, contentId, action, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Validates book listing content
   */
  static async validateBookContent(book: Partial<Book>, userId: string): Promise<ModerationResult> {
    const combinedContent = [
      book.title,
      book.author,
      book.description
    ].filter(Boolean).join(' ');

    const result = await this.analyzeContent(combinedContent, 'book', userId);

    // Additional book-specific checks
    if (book.price && book.price < 0) {
      result.flags.push('invalid-price');
      result.reasons.push('Price cannot be negative');
      result.action = 'reject';
      result.isApproved = false;
    }

    return result;
  }

  /**
   * Validates community post content
   */
  static async validatePostContent(
    post: Partial<CommunityPost>, 
    userId: string
  ): Promise<ModerationResult> {
    const combinedContent = post.content || '';

    return await this.analyzeContent(combinedContent, 'post', userId);
  }

  /**
   * Validates community comment content
   */
  static async validateCommentContent(
    comment: { content: string }, 
    userId: string
  ): Promise<ModerationResult> {
    return await this.analyzeContent(comment.content, 'comment', userId);
  }

  /**
   * Validates community creation
   */
  static async validateCommunityContent(
    community: { name: string; description: string }, 
    userId: string
  ): Promise<ModerationResult> {
    const combinedContent = `${community.name} ${community.description}`;

    return await this.analyzeContent(combinedContent, 'post', userId); // Using 'post' as content type for communities
  }

  /**
   * Moderate community content (posts, comments, communities)
   */
  static async moderateCommunityContent(
    contentId: string,
    contentType: 'post' | 'comment' | 'community',
    content: string,
    userId: string
  ): Promise<{
    approved: boolean;
    action: 'approve' | 'flag' | 'reject' | 'quarantine';
    flags: string[];
    reasons: string[];
  }> {
    try {
      // Analyze content
      const analysis = await this.analyzeContent(content, contentType === 'community' ? 'post' : contentType, userId);
      const userReputation = await this.getUserReputation(userId);

      // Record moderation action
      await this.recordModerationAction(
        userId,
        contentId,
        contentType,
        analysis.action,
        analysis.flags,
        undefined, // No moderator for auto-moderation
        true // Auto-moderated
      );

      // Take action based on result
      if (analysis.action === 'reject') {
        await this.removeCommunityContent(contentId, contentType);
      } else if (analysis.action === 'quarantine') {
        await this.quarantineCommunityContent(contentId, contentType);
      }

      return {
        approved: analysis.isApproved,
        action: analysis.action,
        flags: analysis.flags,
        reasons: analysis.reasons
      };
    } catch (error) {
      console.error('Error moderating community content:', error);
      // Default to approve on error to avoid blocking legitimate content
      return {
        approved: true,
        action: 'approve',
        flags: [],
        reasons: ['Moderation check failed - approved by default']
      };
    }
  }

  /**
   * Remove community content
   */
  private static async removeCommunityContent(
    contentId: string, 
    contentType: 'post' | 'comment' | 'community'
  ): Promise<void> {
    const client = await clientPromise;
    const db = client.db('bookex');

    if (contentType === 'post') {
      await db.collection('communities').updateOne(
        { 'posts._id': contentId },
        { $pull: { posts: { _id: contentId } } } as any
      );
    } else if (contentType === 'comment') {
      await db.collection('communities').updateOne(
        { 'posts.comments._id': contentId },
        { $pull: { 'posts.$.comments': { _id: contentId } } } as any
      );
    } else if (contentType === 'community') {
      await db.collection('communities').deleteOne({ _id: new ObjectId(contentId) });
    }
  }

  /**
   * Quarantine community content (hide until reviewed)
   */
  private static async quarantineCommunityContent(
    contentId: string, 
    contentType: 'post' | 'comment' | 'community'
  ): Promise<void> {
    const client = await clientPromise;
    const db = client.db('bookex');

    const quarantineData = {
      quarantined: true,
      quarantinedAt: new Date().toISOString(),
      quarantineReason: 'Automated moderation'
    };

    if (contentType === 'post') {
      await db.collection('communities').updateOne(
        { 'posts._id': contentId },
        { $set: { 'posts.$.quarantined': true, 'posts.$.quarantinedAt': new Date().toISOString() } }
      );
    } else if (contentType === 'comment') {
      await db.collection('communities').updateOne(
        { 'posts.comments._id': contentId },
        { $set: { 'posts.comments.$.quarantined': true, 'posts.comments.$.quarantinedAt': new Date().toISOString() } }
      );
    }
  }

  /**
   * Get quarantined content for admin review
   */
  static async getQuarantinedContent(limit: number = 50): Promise<any[]> {
    const client = await clientPromise;
    const db = client.db('bookex');

    try {
      // Get quarantined posts
      const quarantinedPosts = await db.collection('communities').aggregate([
        { $unwind: '$posts' },
        { $match: { 'posts.quarantined': true } },
        {
          $project: {
            _id: '$posts._id',
            content: '$posts.content',
            authorId: '$posts.authorId',
            communityId: '$_id',
            communityName: '$name',
            quarantinedAt: '$posts.quarantinedAt',
            type: { $literal: 'post' }
          }
        }
      ]).limit(limit).toArray();

      // Get quarantined comments
      const quarantinedComments = await db.collection('communities').aggregate([
        { $unwind: '$posts' },
        { $unwind: '$posts.comments' },
        { $match: { 'posts.comments.quarantined': true } },
        {
          $project: {
            _id: '$posts.comments._id',
            content: '$posts.comments.content',
            authorId: '$posts.comments.author._id',
            communityId: '$_id',
            communityName: '$name',
            postId: '$posts._id',
            quarantinedAt: '$posts.comments.quarantinedAt',
            type: { $literal: 'comment' }
          }
        }
      ]).limit(limit).toArray();

      return [...quarantinedPosts, ...quarantinedComments]
        .sort((a, b) => new Date(b.quarantinedAt).getTime() - new Date(a.quarantinedAt).getTime())
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting quarantined content:', error);
      return [];
    }
  }

  /**
   * Approve quarantined content
   */
  static async approveQuarantinedContent(
    contentId: string,
    contentType: 'post' | 'comment',
    moderatorId: string
  ): Promise<boolean> {
    const client = await clientPromise;
    const db = client.db('bookex');

    try {
      let result;

      if (contentType === 'post') {
        result = await db.collection('communities').updateOne(
          { 'posts._id': contentId },
          {
            $unset: { 'posts.$.quarantined': 1, 'posts.$.quarantinedAt': 1 },
            $set: { 'posts.$.moderatedBy': moderatorId, 'posts.$.moderatedAt': new Date().toISOString() }
          }
        );
      } else if (contentType === 'comment') {
        result = await db.collection('communities').updateOne(
          { 'posts.comments._id': contentId },
          {
            $unset: { 'posts.comments.$.quarantined': 1, 'posts.comments.$.quarantinedAt': 1 },
            $set: { 'posts.comments.$.moderatedBy': moderatorId, 'posts.comments.$.moderatedAt': new Date().toISOString() }
          }
        );
      }

      return result?.modifiedCount === 1;
    } catch (error) {
      console.error('Error approving quarantined content:', error);
      return false;
    }
  }

  /**
   * Reject quarantined content (delete it)
   */
  static async rejectQuarantinedContent(
    contentId: string,
    contentType: 'post' | 'comment',
    moderatorId: string
  ): Promise<boolean> {
    const client = await clientPromise;
    const db = client.db('bookex');

    try {
      let result;

      if (contentType === 'post') {
        result = await db.collection('communities').updateOne(
          { 'posts._id': contentId },
          { $pull: { posts: { _id: contentId } } } as any
        );
      } else if (contentType === 'comment') {
        result = await db.collection('communities').updateOne(
          { 'posts.comments._id': contentId },
          { $pull: { 'posts.$.comments': { _id: contentId } } } as any
        );
      }

      return result?.modifiedCount === 1;
    } catch (error) {
      console.error('Error rejecting quarantined content:', error);
      return false;
    }
  }

  /**
   * Validates user profile content
   */
  static async validateProfileContent(user: Partial<User>, userId: string): Promise<ModerationResult> {
    const combinedContent = [
      user.name,
      user.bio
    ].filter(Boolean).join(' ');

    return await this.analyzeContent(combinedContent, 'profile', userId);
  }

  /**
   * Gets content moderation queue for admin review
   */
  static async getModerationQueue(
    limit: number = 50,
    filter: 'all' | 'flagged' | 'pending' = 'flagged'
  ): Promise<any[]> {
    const client = await clientPromise;
    const db = client.db('bookex');

    try {
      const query: any = {};
      
      if (filter === 'flagged') {
        query.action = { $in: ['flag', 'quarantine'] };
      } else if (filter === 'pending') {
        query.action = 'quarantine';
      }

      const moderationActions = await db.collection('moderationActions')
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      return moderationActions;

    } catch (error) {
      throw createAppError(
        ErrorType.DATABASE,
        'Failed to get moderation queue',
        undefined,
        undefined,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Bulk content cleanup - removes content flagged as spam/inappropriate
   */
  static async performContentCleanup(): Promise<{
    cleaned: number;
    actions: string[];
  }> {
    const client = await clientPromise;
    const db = client.db('bookex');

    let cleaned = 0;
    const actions: string[] = [];

    try {
      // Clean up rejected books
      const rejectedBooks = await db.collection('moderationActions').find({
        action: 'reject',
        contentType: 'book',
        autoModerated: true,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
      }).toArray();

      for (const modAction of rejectedBooks) {
        await db.collection('books').updateOne(
          { _id: new ObjectId(modAction.contentId) },
          { $set: { status: 'rejected', rejectedAt: new Date().toISOString() } }
        );
        cleaned++;
        actions.push(`Rejected book: ${modAction.contentId}`);
      }

      // Clean up quarantined content older than 7 days
      const oldQuarantined = await db.collection('moderationActions').find({
        action: 'quarantine',
        createdAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
      }).toArray();

      for (const modAction of oldQuarantined) {
        if (modAction.contentType === 'book') {
          await db.collection('books').deleteOne({ _id: new ObjectId(modAction.contentId) });
        } else if (modAction.contentType === 'post') {
          await db.collection('communityPosts').deleteOne({ _id: new ObjectId(modAction.contentId) });
        }
        cleaned++;
        actions.push(`Deleted quarantined ${modAction.contentType}: ${modAction.contentId}`);
      }

      return { cleaned, actions };

    } catch (error) {
      throw createAppError(
        ErrorType.INTERNAL,
        'Content cleanup failed',
        undefined,
        undefined,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }
}
