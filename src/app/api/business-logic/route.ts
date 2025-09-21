/**
 * Business Logic Security API Routes
 * Provides endpoints for book validation, duplicate checking, and inventory management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-config';
import { BusinessLogicSecurity } from '@/lib/business-logic-security';
import { checkUserRateLimit, RATE_LIMITS } from '@/lib/rate-limiting';
import { handleApiError } from '@/lib/error-handling';
import { ObjectId } from 'mongodb';

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
      case 'validateBookListing': {
        const { bookData, isUpdate } = params;
        const validation = await BusinessLogicSecurity.validateBookListing(
          bookData,
          session.user.id,
          isUpdate
        );
        return NextResponse.json(validation);
      }

      case 'checkDuplicates': {
        const { title, author, excludeBookId } = params;
        const duplicateCheck = await BusinessLogicSecurity.checkDuplicateBooks(
          title,
          author,
          session.user.id,
          excludeBookId
        );
        return NextResponse.json(duplicateCheck);
      }

      case 'validateExchange': {
        const { proposerBookId, responderBookId } = params;
        const validation = await BusinessLogicSecurity.validateExchangeProposal(
          proposerBookId,
          responderBookId,
          session.user.id
        );
        return NextResponse.json(validation);
      }

      case 'validateUserActivity': {
        const validation = await BusinessLogicSecurity.validateUserActivity(session.user.id);
        return NextResponse.json(validation);
      }

      case 'acquireLock': {
        const { resourceId, resourceType, operation } = params;
        const lockAcquired = await BusinessLogicSecurity.acquireLock(
          resourceId,
          resourceType,
          session.user.id,
          operation
        );
        return NextResponse.json({ lockAcquired });
      }

      case 'releaseLock': {
        const { resourceId } = params;
        await BusinessLogicSecurity.releaseLock(resourceId, session.user.id);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
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

    const { bookId, fromStatus, toStatus } = await request.json();

    // Validate ObjectId format
    if (!ObjectId.isValid(bookId)) {
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
    }

    const success = await BusinessLogicSecurity.updateBookStatusAtomic(
      bookId,
      fromStatus,
      toStatus,
      session.user.id
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update book status - book not found or status mismatch' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// Admin-only endpoint for inventory consistency enforcement
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const result = await BusinessLogicSecurity.enforceInventoryConsistency();
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
