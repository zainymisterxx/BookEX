/**
 * Content Moderation API Routes
 * Provides endpoints for content analysis, user reputation, and moderation queue management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-config';
import { ContentModerationSystem } from '@/lib/content-moderation';
import { checkUserRateLimit, RATE_LIMITS } from '@/lib/rate-limiting';
import { handleApiError } from '@/lib/error-handling';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = await checkUserRateLimit(session.user.email, 'API_VALIDATION', RATE_LIMITS.API_VALIDATION);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', resetTime: rateLimitResult.resetTime },
        { status: 429 }
      );
    }

    const { action, ...params } = await request.json();

    switch (action) {
      case 'analyzeContent': {
        const { content, contentType } = params;
        const result = await ContentModerationSystem.analyzeContent(
          content,
          contentType,
          session.user.id
        );
        return NextResponse.json(result);
      }

      case 'validateBook': {
        const { bookData } = params;
        const result = await ContentModerationSystem.validateBookContent(
          bookData,
          session.user.id
        );
        return NextResponse.json(result);
      }

      case 'validatePost': {
        const { postData } = params;
        const result = await ContentModerationSystem.validatePostContent(
          postData,
          session.user.id
        );
        return NextResponse.json(result);
      }

      case 'validateProfile': {
        const { profileData } = params;
        const result = await ContentModerationSystem.validateProfileContent(
          profileData,
          session.user.id
        );
        return NextResponse.json(result);
      }

      case 'getUserReputation': {
        const { userId } = params;
        // Users can only check their own reputation, admins can check any
        if (userId !== session.user.id && session.user.role !== 'admin') {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        
        const reputation = await ContentModerationSystem.getUserReputation(userId || session.user.id);
        return NextResponse.json(reputation);
      }

      case 'recordAction': {
        const { contentId, contentType, actionType, flags, autoModerated } = params;
        await ContentModerationSystem.recordModerationAction(
          session.user.id,
          contentId,
          contentType,
          actionType,
          flags,
          session.user.role === 'admin' ? session.user.id : undefined,
          autoModerated !== false
        );
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// Admin-only endpoints
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const limit = parseInt(searchParams.get('limit') || '50');
    const filter = searchParams.get('filter') as 'all' | 'flagged' | 'pending' || 'flagged';

    switch (action) {
      case 'moderationQueue': {
        const queue = await ContentModerationSystem.getModerationQueue(limit, filter);
        return NextResponse.json(queue);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// Admin-only maintenance endpoint
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { action } = await request.json();

    switch (action) {
      case 'cleanup': {
        const result = await ContentModerationSystem.performContentCleanup();
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
