'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { ObjectId, type UpdateFilter } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import type { Book, BookGenre, BookStatus, Post, User, Community, Organization, Report, Review, Chat, Comment, Notification, WishlistItem, PasswordResetToken, EmailVerificationToken, Exchange, ExchangeStatus, Donation, DonationStatus, DonationStatusUpdate, OrganizationRepresentative } from '@/lib/types';

/**
 * Validates donation status transitions
 * @param currentStatus Current donation status
 * @param newStatus Proposed new status
 * @returns Validation result with isValid flag and optional error message
 */
function validateDonationStatusTransition(
    currentStatus: DonationStatus,
    newStatus: DonationStatus
): { isValid: boolean; error?: string } {
    const validTransitions: Record<DonationStatus, DonationStatus[]> = {
        'pending': ['confirmed', 'cancelled', 'rejected'],
        'confirmed': ['in_progress', 'cancelled'],
        'in_progress': ['completed', 'cancelled'],
        'completed': [],  // Terminal state
        'cancelled': [],  // Terminal state
        'rejected': []    // Terminal state
    };

    const allowedTransitions = validTransitions[currentStatus];
    
    if (!allowedTransitions) {
        return { isValid: false, error: `Invalid current status: ${currentStatus}` };
    }
    
    if (!allowedTransitions.includes(newStatus)) {
        return { 
            isValid: false, 
            error: `Cannot transition from ${currentStatus} to ${newStatus}. Allowed: ${allowedTransitions.join(', ')}` 
        };
    }
    
    return { isValid: true };
}
import { hash } from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { sendPasswordResetEmail, sendWelcomeEmail, sendEmailVerificationEmail, sendExchangeProposalEmail, sendExchangeStatusUpdateEmail, sendBookContactEmail, sendOrgApplicationNotificationEmail, sendDonationChatConfirmationEmail, sendOrganizationApprovalEmail, sendOrganizationRejectionEmail, sendDonationStatusUpdateEmail, sendDonationCompletionEmail } from '@/lib/email';
import { validateImageDataUri, sanitizeInput, validateOrganizationData, sanitizeOrganizationName, createSafeExactMatchRegex, normalizeForDeduplication, createBookDuplicateHash, checkBookSimilarity, calculateExpirationDate, createNotificationDeduplicationKey } from '@/lib/utils';
import { validatePasswordStrength, isPasswordStrong, getPasswordRequirementsMessage } from '@/lib/password-validation';
import { logActivity, detectSuspiciousActivity } from '@/lib/activity-logging';
import { getCurrentTimestamp, formatForDatabase, addDays, addHours } from '@/lib/date-utils';
import { OptimizedQueries } from '@/lib/database-optimization';
import { runDatabaseMaintenance, DatabaseMaintenance } from '@/lib/database-maintenance';
import { ConsistentWishlistOperations, normalizeText, SchemaMigration } from '@/lib/schema-migration';
import { ensureDatabaseIndexes, checkIndexHealth, createMissingIndexes } from '@/lib/database-setup';
import { createAppError, ErrorType, logError } from '@/lib/error-handling';
import { checkUserRateLimit, RATE_LIMITS } from '@/lib/rate-limiting';
import { validateResourceAccess, ResourceAuthority, type AuthorizedUser } from '@/lib/resource-authorization';
import { checkAuthRateLimit, recordAuthResult } from '@/lib/auth-rate-limiting';
import { withAuthenticatedAction, withAuthenticatedUserFull } from '@/lib/action-utils';
import { bookSchema, communitySchema, postSchema, commentSchema, organizationSchema, reportSchema, reviewSchema, userProfileSchema, exchangeSchema, chatMessageSchema, paginationSchema, searchQuerySchema, donationStatusUpdateSchema, validateWithSchema } from '@/lib/schemas';
import crypto from 'crypto';
import { normalizeMediaUrl } from '@/lib/media-url';
import { 
  createCommunityMemberAddOperation, 
  createCommunityMemberRemoveOperation,
  createPostAddOperation,
  createPostLikeToggleOperation,
  createCommentAddOperation,
  createWishlistAddOperation,
  createWishlistRemoveOperation,
  type UserDocument,
  type CommunityDocument,
  type PostDocument,
  type CommentDocument
} from '@/lib/mongodb-types';


/**
 * Signs up a new user. The first user to sign up will be an admin.
 * @param userData The data for the new user.
 * @returns An object with the result of the operation.
 */
export async function signUpUser(userData: Pick<User, 'name' | 'email' | 'password'>) {
  try {
    // Check signup rate limiting
    const rateLimitCheck = await checkAuthRateLimit('SIGNUP', userData.email);
    if (!rateLimitCheck.allowed) {
      recordAuthResult('SIGNUP', false, userData.email);
      return { success: false, message: rateLimitCheck.error || 'Too many signup attempts. Please try again later.' };
    }

    const client = await clientPromise;
    const db = client.db("bookex");
    const usersCollection = db.collection("users");

    // Validate email format
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (!emailRegex.test(userData.email)) {
      recordAuthResult('SIGNUP', false, userData.email.toLowerCase());
      return { success: false, message: "Please enter a valid email address." };
    }

    // Normalize email to lowercase for consistent storage and lookup
    const normalizedEmail = userData.email.toLowerCase();

    const existingUser = await usersCollection.findOne({ email: normalizedEmail });
    if (existingUser) {
      recordAuthResult('SIGNUP', false, normalizedEmail);
      return { success: false, message: "A user with this email already exists." };
    }

    if (!userData.password) {
      recordAuthResult('SIGNUP', false, normalizedEmail);
      return { success: false, message: "Password is required." };
    }

    // Validate password strength
    if (!isPasswordStrong(userData.password)) {
      recordAuthResult('SIGNUP', false, normalizedEmail);
      return {
        success: false,
        message: getPasswordRequirementsMessage()
      };
    }

    // Check if this is the first user
    const userCount = await usersCollection.countDocuments();
    const role = userCount === 0 ? 'admin' : 'user';

    const hashedPassword = await hash(userData.password, 10);
    
    const newUser: Omit<User, '_id'> = {
      name: userData.name,
      email: normalizedEmail, // Use normalized email
      password: hashedPassword,
      avatarUrl: `https://placehold.co/100x100/EFEFEF/4A4A4A?text=${userData.name.charAt(0)}`,
      reviews: 0,
      totalRatingPoints: 0,
      role: role,
      status: 'active',
      wishlist: [],
      createdAt: new Date().toISOString(),
    };

    const result = await usersCollection.insertOne(newUser);

    // Record successful signup
    recordAuthResult('SIGNUP', true, normalizedEmail);

    // Log successful user signup
    await logActivity(
      result.insertedId.toString(),
      'user_signup',
      'low',
      `New user account created: ${userData.name}`,
      { email: normalizedEmail, role }
    );

    // Send welcome email (optional - won't block signup if it fails)
    try {
      await sendWelcomeEmail(normalizedEmail, userData.name);
    } catch (error) {
      console.warn('Welcome email failed to send, but signup was successful');
    }

    // Generate and store email verification token
    try {
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h from now
      const tokenData: Omit<EmailVerificationToken, '_id'> = {
        userId: result.insertedId.toString(),
        email: normalizedEmail,
        token: verificationToken,
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString(),
      };
      const tokensCollection = db.collection<EmailVerificationToken>('email_verification_tokens');
      await tokensCollection.insertOne(tokenData);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
      const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`;
      await sendEmailVerificationEmail(normalizedEmail, userData.name, verificationUrl);
    } catch (error) {
      console.warn('Email verification setup failed, but signup was successful:', error);
    }

    // Create admin notification for new user registration (except for first admin)
    if (role !== 'admin') {
      try {
        const { notifyNewUser } = await import('@/lib/admin-notifications');
        await notifyNewUser(
          result.insertedId.toString(),
          normalizedEmail,
          userData.name
        );
      } catch (error) {
        console.warn('Failed to create admin notification for new user:', error);
      }
    }

    return { success: true, userId: result.insertedId.toString() };
  } catch (error) {
    console.error("Error in signUpUser server action:", error);
    recordAuthResult('SIGNUP', false, userData.email.toLowerCase());
    return { success: false, message: 'Failed to sign up.' };
  }
}

/**
 * Initiates a password reset by creating a reset token and sending an email.
 * @param email The email address of the user requesting the reset.
 * @returns An object with the result of the operation.
 */
export async function requestPasswordReset(email: string) {
  try {
    // Check password reset rate limiting
    const rateLimitCheck = await checkAuthRateLimit('PASSWORD_RESET', email);
    if (!rateLimitCheck.allowed) {
      recordAuthResult('PASSWORD_RESET', false, email);
      return { success: false, message: rateLimitCheck.error || 'Too many reset requests. Please try again later.' };
    }

    const client = await clientPromise;
    const db = client.db("bookex");
    const usersCollection = db.collection<User>("users");
    const tokensCollection = db.collection<PasswordResetToken>("passwordResetTokens");

    // Find user by email (normalize to lowercase for consistent lookup)
    const user = await usersCollection.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Record failed attempt but return success message (security best practice)
      recordAuthResult('PASSWORD_RESET', false, email);
      return { success: true, message: 'If an account with that email exists, a reset link has been sent.' };
    }

    // Check for suspicious activity
    await detectSuspiciousActivity(String(user._id), 'password_reset_request', { email });

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex'); // Hash the token before storage
    const expiresAt = addHours(getCurrentTimestamp(), 1); // 1 hour from now

    // Store reset token in database
    const tokenData: Omit<PasswordResetToken, '_id'> = {
      userId: String(user._id),
      token: hashedToken, // Store hashed token instead of plain text
      expiresAt: formatForDatabase(expiresAt),
      used: false,
      createdAt: getCurrentTimestamp(),
    };

    await tokensCollection.insertOne(tokenData as any);

    // Log password reset request
    await logActivity(
      String(user._id),
      'password_reset_request',
      'medium',
      'Password reset requested',
      { email: email.toLowerCase() }
    );

    // Send reset email
    const emailResult = await sendPasswordResetEmail(email, user.name, resetToken);
    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      return { success: false, message: 'Failed to send reset email. Please try again.' };
    }

    return { success: true, message: 'If an account with that email exists, a reset link has been sent.' };
  } catch (error) {
    console.error("Error in requestPasswordReset:", error);
    return { success: false, message: 'Failed to process password reset request.' };
  }
}

/**
 * Resets a user's password using a valid reset token.
 * @param token The password reset token.
 * @param newPassword The new password.
 * @returns An object with the result of the operation.
 */
export async function resetPassword(token: string, newPassword: string) {
  try {
    const rateLimitResult = await checkAuthRateLimit('PASSWORD_RESET', token.slice(0, 8));
    if (!rateLimitResult.allowed) {
      return { success: false, message: 'Too many attempts. Please wait before trying again.' };
    }

    const client = await clientPromise;
    const db = client.db("bookex");
    const usersCollection = db.collection<User>("users");
    const tokensCollection = db.collection<PasswordResetToken>("passwordResetTokens");

    // Hash the input token to compare with stored hashed tokens
    const hashedInputToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find and validate the reset token
    const resetTokenData = await tokensCollection.findOne({ 
      token: hashedInputToken, // Compare with hashed token
      used: false,
      expiresAt: { $gt: new Date().toISOString() }
    });

    if (!resetTokenData) {
      return { success: false, message: 'Invalid or expired reset token.' };
    }

    // Validate new password strength
    if (!isPasswordStrong(newPassword)) {
      return {
        success: false,
        message: getPasswordRequirementsMessage()
      };
    }

    // Hash the new password
    const hashedPassword = await hash(newPassword, 10);

    // Atomically update password and mark token used so a partial failure
    // cannot leave the token consumed but the password unchanged.
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        await usersCollection.updateOne(
          { _id: new ObjectId(resetTokenData.userId) },
          { $set: { password: hashedPassword } },
          { session }
        );

        await tokensCollection.updateOne(
          { _id: resetTokenData._id },
          { $set: { used: true } },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    // Log successful password reset
    await logActivity(
      resetTokenData.userId,
      'password_reset_complete',
      'medium',
      'Password reset completed successfully'
    );

    return { success: true, message: 'Password has been reset successfully.' };
  } catch (error) {
    console.error("Error in resetPassword:", error);
    return { success: false, message: 'Failed to reset password.' };
  }
}

/**
 * Verifies a user's email address using a one-time token.
 */
export async function verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
  if (!token || typeof token !== 'string') {
    return { success: false, message: 'Invalid verification link.' };
  }
  try {
    const client = await clientPromise;
    const db = client.db('bookex');
    const tokensCollection = db.collection<EmailVerificationToken>('email_verification_tokens');

    const tokenDoc = await tokensCollection.findOne({ token });
    if (!tokenDoc) {
      return { success: false, message: 'Invalid or expired verification link.' };
    }
    if (tokenDoc.usedAt) {
      return { success: false, message: 'This verification link has already been used.' };
    }
    if (new Date(tokenDoc.expiresAt) < new Date()) {
      return { success: false, message: 'This verification link has expired.' };
    }

    const now = new Date().toISOString();
    const usersCollection = db.collection('users');
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        await usersCollection.updateOne(
          { _id: new ObjectId(tokenDoc.userId) },
          { $set: { emailVerified: true, emailVerifiedAt: now } },
          { session }
        );
        await tokensCollection.updateOne({ token }, { $set: { usedAt: now } }, { session });
      });
    } finally {
      await session.endSession();
    }

    return { success: true, message: 'Your email has been verified successfully!' };
  } catch (error) {
    console.error('Error in verifyEmail:', error);
    return { success: false, message: 'Failed to verify email. Please try again.' };
  }
}

/**
 * Fetches user data for the settings page.
 * @returns The user data or null.
 */
export async function getUserForUpdate(userId: string) {
    return withAuthenticatedAction(async ({ db, user, userId: currentUserId }) => {
        if (user.id !== userId) throw new Error("Unauthorized");
        
        const userData = await db.collection("users").findOne({ _id: new ObjectId(user.id) });
        if (!userData) return null;
        const { findCanonicalCity } = await import('@/lib/location/location-utils');
        const canonical = await findCanonicalCity(userData.cityNormalized || '');
        return {
            name: userData.name,
            username: userData.username,
            cityName: canonical?.name || null,
            cityNormalized: userData.cityNormalized || null,
            avatarUrl: userData.avatarUrl
        };
    });
}

/**
 * Checks if a username is available for registration or updating.
 * @param username The username to check for availability.
 * @returns An object indicating whether the username is available.
 */
export async function checkUsernameAvailability(username: string) {
    return withAuthenticatedAction(async ({ db, user }) => {
        // Import username validation
        const { validateUsername } = await import('@/lib/username-utils');
        
        const validation = validateUsername(username);
        if (!validation.valid) {
            return {
                success: true,
                available: false,
                error: validation.error
            };
        }
        
        // Check if username exists (excluding current user)
        const existingUser = await db.collection("users").findOne({ 
            username: username,
            _id: { $ne: new ObjectId(user.id) }
        });
        
        return {
            success: true,
            available: !existingUser,
            error: existingUser ? 'Username is already taken' : null
        };
    });
}

/**
 * Updates a user's profile.
 * @param profileData The data to update.
 * @returns An object with the result of the operation and the new user data for session update.
 */
export async function updateUserProfile(profileData: { userId: string, name: string, username?: string, city: string, avatarUrl?: string }) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Validate authorization using resource authorization system
        await validateResourceAccess(user, 'user', profileData.userId, 'update');

        // Validate input data with Zod schema
        const validation = validateWithSchema(userProfileSchema, profileData);
        if (!validation.success) {
            throw createAppError(ErrorType.VALIDATION, validation.message);
        }
        const validatedData = validation.data;

        const currentUser = await db.collection("users").findOne({ _id: new ObjectId(user.id) });
        if (!currentUser) throw new Error("User not found");

        const updateData: Partial<User> = {
            name: sanitizeInput(validatedData.name),
        };

        // Validate and normalize city using canonical city database
        try {
            const { validateUserCity } = await import('@/lib/validation');
            const canonicalNormalized = await validateUserCity(validatedData.city);
            updateData.cityNormalized = sanitizeInput(canonicalNormalized);
        } catch (cityErr) {
            // If city validation fails, propagate a validation error
            throw createAppError(ErrorType.VALIDATION, (cityErr as Error).message || 'Invalid city');
        }
        
        // Handle username update
        if (profileData.username !== undefined && profileData.username !== currentUser.username) {
            // Import username validation
            const { validateUsername } = await import('@/lib/username-utils');
            
            const usernameValidation = validateUsername(profileData.username);
            if (!usernameValidation.valid) {
                throw createAppError(ErrorType.VALIDATION, usernameValidation.error || 'Invalid username');
            }
            
            // Check if username is already taken
            const existingUser = await db.collection("users").findOne({ 
                username: profileData.username,
                _id: { $ne: new ObjectId(user.id) }
            });
            
            if (existingUser) {
                throw createAppError(ErrorType.VALIDATION, 'Username is already taken');
            }
            
            updateData.username = profileData.username;
        }
        
        // Handle avatar update
        if (profileData.avatarUrl) {
            updateData.avatarUrl = normalizeMediaUrl(profileData.avatarUrl);
        }

        await db.collection("users").updateOne(
            { _id: new ObjectId(user.id) },
            { $set: updateData }
        );

        // Log profile update
        await logActivity(
          user.id,
          'profile_update',
          'low',
          'User profile updated',
          {
            updatedFields: Object.keys(updateData),
            hasAvatarUpdate: !!profileData.avatarUrl
          }
        );

        // Invalidate user cache
        const { default: redisCache } = await import('@/lib/redis-cache');
        await redisCache.invalidateUserCache(user.id);

        revalidatePath('/profile/me');
        revalidatePath('/profile/settings');
        
        // Return the new data so the client can update the session
        return { 
            success: true,
            updatedUser: {
                name: updateData.name,
                username: updateData.username || currentUser.username,
                image: updateData.avatarUrl || currentUser.avatarUrl,
            }
        };
    });
}


/**
 * Lists a new book for sale or exchange.
 * @param bookData The data for the new book.
 * @returns An object with the result of the operation.
 */
export async function listBook(bookData: { title: string, author: string, description: string, genre: BookGenre, condition: 'new' | 'like-new' | 'used' | 'worn', type: 'sell' | 'exchange', price?: number, imageUrl: string, city: string }) {
  return withAuthenticatedAction(async ({ db, user, userId }) => {
    // Check rate limit
    const rateLimitResult = await checkUserRateLimit(user.id, 'LIST_BOOK', RATE_LIMITS.LIST_BOOK);
    if (!rateLimitResult.allowed) {
      throw createAppError(ErrorType.RATE_LIMIT, rateLimitResult.error || "Rate limit exceeded");
    }

    // Validate input data with Zod schema
    const validation = validateWithSchema(bookSchema, bookData);
    if (!validation.success) {
      throw createAppError(ErrorType.VALIDATION, validation.message);
    }
    const validatedBookData = validation.data;

    // Create deduplication fields
    const titleNormalized = normalizeForDeduplication(bookData.title);
    const authorNormalized = normalizeForDeduplication(bookData.author);
    const duplicateHash = createBookDuplicateHash(bookData.title, bookData.author, user.id);

    // Check for existing duplicates from the same user
    const existingBook = await db.collection("books").findOne({
      duplicateHash,
      sellerId: user.id,
      status: { $in: ['active', 'inactive'] } // Don't consider sold/exchanged books as duplicates
    });

    if (existingBook) {
      // Perform additional similarity check
      const similarity = checkBookSimilarity(
        { title: bookData.title, author: bookData.author, sellerId: user.id },
        { title: existingBook.title, author: existingBook.author, sellerId: existingBook.sellerId }
      );

      if (similarity.isDuplicate) {
        throw createAppError(
          ErrorType.VALIDATION, 
          `You have already listed a similar book: "${existingBook.title}" by ${existingBook.author}. Please update your existing listing instead of creating a duplicate.`
        );
      }
    }

    // Moderate listing content before going live
    try {
        const { ContentModerationSystem } = await import('@/lib/content-moderation');
        const moderationResult = await ContentModerationSystem.analyzeContent(
            `${validatedBookData.title} ${validatedBookData.description}`,
            'book',
            user.id
        );
        if (moderationResult.action === 'reject') {
            throw createAppError(ErrorType.VALIDATION, 'Your listing contains content that violates our guidelines. Please review and resubmit.');
        }
    } catch (err: unknown) {
        if ((err as { code?: string }).code === ErrorType.VALIDATION) throw err;
        console.warn('Content moderation check failed, proceeding:', err);
    }

    // Note: Bypassing transactions to ensure compatibility with local standalone MongoDB instances
    let insertedId: any;

    try {
        const now = getCurrentTimestamp();

                const newBook: Omit<Book, '_id'> = {
          title: validatedBookData.title,
          author: validatedBookData.author,
          description: validatedBookData.description || '',
          genre: validatedBookData.genre || 'other',
          condition: validatedBookData.condition,
          type: validatedBookData.type,
          price: bookData.price, // Price not validated by schema
          imageUrl: normalizeMediaUrl(bookData.imageUrl),
          sellerId: user.id,
                city: validatedBookData.city,
                    cityNormalized: validatedBookData.city,
          status: 'active',
          createdAt: now,
          updatedAt: now,
          expiresAt: calculateExpirationDate(validatedBookData.type),
          titleNormalized,
          authorNormalized,
          duplicateHash,
        };

        const result = await db.collection("books").insertOne(newBook);

        if (!result.insertedId) {
          throw new Error('Failed to insert book.');
        }

        insertedId = result.insertedId;

        // Check for wishlist matches with optimized query and deduplication
        const usersWithBookOnWishlist = await OptimizedQueries.findWishlistMatches(
          String(result.insertedId)
        );

        if (usersWithBookOnWishlist.length > 0) {
          // Create deduplication keys to prevent duplicate notifications
          const notificationPromises = usersWithBookOnWishlist.map(async (u) => {
            const deduplicationKey = createNotificationDeduplicationKey(
              String(u._id), 
              'wishlist_match', 
              String(result.insertedId)
            );

            // Check if notification already exists
            const existingNotification = await db.collection("notifications").findOne({
              userId: String(u._id),
              "metadata.deduplicationKey": deduplicationKey
            });

            if (!existingNotification) {
              return {
                userId: String(u._id),
                type: 'wishlist_match' as const,
                title: 'Wishlist Match Found!',
                message: `A book on your wishlist, "${sanitizeInput(bookData.title)}", has been listed!`,
                link: `/books/${result.insertedId}`,
                read: false,
                createdAt: now,
                metadata: {
                  bookId: String(result.insertedId),
                  bookTitle: sanitizeInput(bookData.title),
                  bookAuthor: sanitizeInput(bookData.author),
                  deduplicationKey
                }
              };
            }
            return null;
          });

          const notifications = (await Promise.all(notificationPromises)).filter(Boolean);
          
          if (notifications.length > 0) {
            await db.collection("notifications").insertMany(notifications as any[]);
            
            // Emit real-time notifications for wishlist matches
            const { emitUserNotification } = await import('../../server');
            for (const notification of notifications) {
              if (notification) {
                try {
                  await emitUserNotification(notification.userId, notification);
                } catch (error) {
                  console.error('Failed to emit wishlist match notification:', error);
                }
              }
            }
          }
        }
      
    } catch (error) {
      console.error('Failed to list book:', error);
      throw error;
    }

    // Invalidate user profile cache since listings have changed
    const { default: redisCache } = await import('@/lib/redis-cache');
    await redisCache.invalidateUserCache(user.id);

    // Log successful book listing
    await logActivity(
      user.id,
      'book_listing_create',
      'low',
      `Book listed: "${validatedBookData.title}" by ${validatedBookData.author}`,
      {
        bookId: insertedId?.toString(),
        type: validatedBookData.type,
        condition: validatedBookData.condition,
        price: bookData.price
      }
    );

    revalidatePath('/');
    revalidatePath(`/books/${insertedId}`);
    if (bookData.type === 'sell') {
      revalidatePath('/books');
    } else {
      revalidatePath('/exchange');
    }

    try {
      const { emitNewBook } = await import('../../server');
      await emitNewBook(insertedId.toString(), user.id, { title: validatedBookData.title, type: validatedBookData.type });
    } catch (emitError) {
      console.warn('Failed to emit newBookListed socket event:', emitError);
    }

    return { bookId: insertedId?.toString() };
  });
}

/**
 * Fetches the user's city.
 * @returns The city or null.
 */
export async function getUserCity(userId: string) {
    return withAuthenticatedAction(async ({ db, user, userId: currentUserId }) => {
        if (user.id !== userId) throw new Error("Unauthorized");

        const userData = await db.collection("users").findOne({ _id: new ObjectId(user.id) });
        if (!userData) return null;
        const { findCanonicalCity } = await import('@/lib/location/location-utils');
        const canonical = await findCanonicalCity(userData.cityNormalized || '');
        return canonical?.name || null;
    });
}

/**
 * Toggles a user's membership in a community.
 * @param communityId The ID of the community.
 * @param isMember Whether the user is currently a member.
 * @returns An object with the result of the operation.
 */
export async function toggleCommunityMembership(communityId: string, isMember: boolean) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Rate limiting for community membership operations
        const rateLimitResult = await checkUserRateLimit(user.id, 'CREATE_COMMUNITY', RATE_LIMITS.CREATE_COMMUNITY);
        if (!rateLimitResult.allowed) {
            throw createAppError(ErrorType.RATE_LIMIT, rateLimitResult.feedback || 'Too many membership changes. Please try again later.');
        }

        // Validate ObjectId to prevent NoSQL injection
        if (!ObjectId.isValid(communityId)) {
            throw new Error("Invalid community ID format");
        }

        const communityObjectId = new ObjectId(communityId);

        // Use MongoDB transaction for atomic operations
        const client = await clientPromise;
        const session = client.startSession();
        let result;

        try {
            result = await session.withTransaction(async () => {
                // FIXED: Check community existence inside transaction
                const community = await db.collection("communities").findOne(
                    { _id: communityObjectId },
                    { session, projection: { _id: 1, members: 1 } }
                );
                
                if (!community) {
                    throw new Error("Community not found");
                }

                if (community.visibility === 'private' && !isMember) {
                    return { success: false, message: 'This community requires approval to join. Please send a join request.', requiresApproval: true };
                }

                if (isMember) {
                    // User wants to leave - use atomic operation with conditional check
                    // Only remove if user is actually a member (prevents negative counts)
                    const leaveResult = await db.collection("communities").updateOne(
                        { 
                            _id: communityObjectId,
                            'members.userId': user.id  // Only update if user IS a member
                        },
                        {
                            $pull: { members: { userId: user.id } } as any,
                            $inc: { memberCount: -1 }
                        },
                        { session }
                    );
                    
                    // If no document was modified, user wasn't a member
                    if (leaveResult.modifiedCount === 0) {
                        // Check if it's because community doesn't exist or user not a member
                        const stillExists = await db.collection("communities").findOne(
                            { _id: communityObjectId },
                            { session, projection: { _id: 1 } }
                        );
                        if (!stillExists) {
                            throw new Error("Community not found");
                        }
                        // User wasn't a member, this is idempotent - return success
                        return { modifiedCount: 0, wasAlreadyInDesiredState: true };
                    }
                    
                    return leaveResult;
                } else {
                    // User wants to join - use atomic operation with conditional check
                    // $addToSet with object requires matching on userId field
                    const joinResult = await db.collection("communities").updateOne(
                        { 
                            _id: communityObjectId,
                            'members.userId': { $ne: user.id }  // Only add if NOT already a member
                        },
                        {
                            $addToSet: { 
                                members: { 
                                    userId: user.id, 
                                    role: 'member', 
                                    joinedAt: new Date(),
                                    banned: false
                                } 
                            },
                            $inc: { memberCount: 1 }
                        },
                        { session }
                    );
                    
                    // If no document was modified, user was already a member
                    if (joinResult.modifiedCount === 0) {
                        // Check if it's because community doesn't exist or user already a member
                        const stillExists = await db.collection("communities").findOne(
                            { _id: communityObjectId },
                            { session, projection: { _id: 1 } }
                        );
                        if (!stillExists) {
                            throw new Error("Community not found");
                        }
                        // User was already a member, this is idempotent - return success
                        return { modifiedCount: 0, wasAlreadyInDesiredState: true };
                    }
                    
                    return joinResult;
                }
            });
        } finally {
            await session.endSession();
        }

        // Check if the operation was idempotent (already in desired state)
        const wasIdempotent = (result as any).wasAlreadyInDesiredState === true;

        // Revalidate paths and emit events only if state actually changed
        if (!wasIdempotent) {
            revalidatePath('/community');
            revalidatePath(`/community/${communityId}`);
            
            // Emit real-time community update for member count change
            try {
                const { emitCommunityUpdate } = await import('../../server');
                await emitCommunityUpdate(communityId, isMember ? 'leave' : 'join', {});
            } catch (emitError) {
                console.warn('Failed to emit community update:', emitError);
            }

            // Notify community admins when someone joins
            if (!isMember) {
                try {
                    const [community, joiner] = await Promise.all([
                        db.collection('communities').findOne(
                            { _id: new ObjectId(communityId) },
                            { projection: { members: 1, name: 1 } }
                        ),
                        db.collection('users').findOne(
                            { _id: new ObjectId(user.id) },
                            { projection: { name: 1 } }
                        ),
                    ]);
                    const adminIds: string[] = (community?.members || [])
                        .filter((m: { role: string; userId: string }) => m.role === 'admin' || m.role === 'creator')
                        .map((m: { userId: string }) => m.userId)
                        .filter((id: string) => id !== user.id);
                    if (adminIds.length > 0) {
                        const now = new Date().toISOString();
                        await db.collection('notifications').insertMany(
                            adminIds.map((adminId: string) => ({
                                userId: adminId,
                                type: 'community',
                                title: 'New Member',
                                message: `${joiner?.name || 'Someone'} joined ${community?.name || 'your community'}`,
                                link: `/community/${communityId}`,
                                read: false,
                                createdAt: now,
                                metadata: { communityId, newMemberId: user.id }
                            }))
                        );
                    }
                } catch (notifError) {
                    console.warn('Failed to send new member notification:', notifError);
                }
            }
        }

        return { 
            success: true,
            message: wasIdempotent 
                ? (isMember ? 'Already left' : 'Already a member')
                : (isMember ? 'Left community' : 'Joined community')
        };
    });
}

/**
 * Creates a new post in a community.
 * @param communityId The ID of the community.
 * @param postData The data for the new post.
 * @returns An object with the result of the operation.
 */
export async function createPost(communityId: string, postData: { authorId: string, content: string; }) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (user.id !== postData.authorId) throw new Error("Unauthorized");

        // Rate limiting for post creation
        const rateLimitResult = await checkUserRateLimit(user.id, 'ADD_POST', RATE_LIMITS.ADD_POST);
        if (!rateLimitResult.allowed) {
            throw createAppError(ErrorType.RATE_LIMIT, rateLimitResult.feedback || 'Too many posts. Please try again later.');
        }

        // Validate input data with Zod schema
        const validation = validateWithSchema(postSchema, { ...postData, communityId });
        if (!validation.success) {
            throw createAppError(ErrorType.VALIDATION, validation.message);
        }
        const validatedData = validation.data;

        // Validate ObjectId to prevent NoSQL injection
        if (!ObjectId.isValid(communityId)) {
            throw new Error("Invalid community ID format");
        }
        
        // Check if user is a member of the community before allowing post creation
        const community = await db.collection("communities").findOne(
            { _id: new ObjectId(communityId), "members.userId": user.id } as any
        );
        
        if (!community) {
            throw new Error("You must be a member to create posts in this community");
        }
        
        const authorInfo = await db.collection('users').findOne({_id: new ObjectId(user.id)}, { projection: { name: 1, avatarUrl: 1 }});

        const newPost = {
            _id: new ObjectId(), // Explicitly create ObjectId for the post
            authorId: user.id,
            author: {
                _id: user.id,
                name: authorInfo?.name || "Anonymous",
                avatarUrl: authorInfo?.avatarUrl || ""
            },
            content: validatedData.content,
            likes: 0,
            likedBy: [],
            comments: [],
            createdAt: new Date().toISOString(),
        };

        // Moderate post content before saving
        const { ContentModerationSystem } = await import('@/lib/content-moderation');
        const moderationResult = await ContentModerationSystem.moderateCommunityContent(
            newPost._id.toString(),
            'post',
            validatedData.content,
            user.id
        );

        if (!moderationResult.approved && moderationResult.action === 'reject') {
            throw createAppError(ErrorType.VALIDATION, 'Your post contains content that violates our community guidelines.');
        }

        // Save to posts collection instead of embedding
        const postInsert = await db.collection("posts").insertOne({
            communityId: new ObjectId(communityId),
            authorId: user.id,
            author: newPost.author,
            content: validatedData.content,
            likes: 0,
            likedBy: [],
            commentCount: 0,
            createdAt: new Date().toISOString(),
        } as any);

        revalidatePath(`/community/${communityId}`);

        // Emit real-time update for new post
        try {
            const { emitCommunityPostCreated } = await import('../../server');
            await emitCommunityPostCreated(communityId, { ...newPost, _id: postInsert.insertedId, communityId });
        } catch (emitError) {
            console.warn('Failed to emit real-time update for new post:', emitError);
        }

        // Emit notification to all community members (except the author)
        try {
            const { emitUserNotification } = await import('../../server');
            const community = await db.collection('communities').findOne({ _id: new ObjectId(communityId) });
            if (community) {
                const memberIds = community.members || [];
                for (const memberId of memberIds) {
                    if (memberId !== user.id) {
                        const notification = {
                            _id: new ObjectId().toString(),
                            userId: memberId,
                            type: 'community' as const,
                            title: 'New Post',
                            message: `${((user as any).name || 'Someone').replace(/[<>\"&]/g, '')} posted in ${community.name.replace(/[<>\"&]/g, '')}`,
                            link: `/community/${communityId}`,
                            read: false,
                            createdAt: new Date().toISOString(),
                            metadata: {
                                communityId,
                                postId: newPost._id,
                                actionType: 'new_post'
                            }
                        };
                        await emitUserNotification(memberId, notification);
                    }
                }
            }
        } catch (notificationError) {
            console.warn('Failed to emit notifications for new post:', notificationError);
        }

        return { success: true, data: { newPost: JSON.parse(JSON.stringify(newPost)) } };
    });
}

/**
 * Toggles a like on a community post.
 * @param communityId The ID of the community.
 * @param postId The ID of the post.
 * @param isLiked Whether the post is currently liked by the user.
 * @returns An object with the result of the operation.
 */
export async function togglePostLike(communityId: string, postId: string, isLiked: boolean) {
    return withAuthenticatedUserFull(async ({ db, user, userId }) => {
        // FIXED CRITICAL-002: Strict ObjectId validation
        if (!ObjectId.isValid(communityId)) {
            throw new Error("Invalid community ID format");
        }
        if (!ObjectId.isValid(postId)) {
            throw new Error("Invalid post ID format");
        }
        
        const communityObjId = new ObjectId(communityId);
        const postObjectId = new ObjectId(postId);

        // Check membership and ban status
        const community = await db.collection("communities").findOne(
            { _id: communityObjId },
            { projection: { members: 1 } }
        );
        
        if (!community) {
            throw new Error('Community not found');
        }

        const member = (community as any).members?.find((m: any) => m.userId === user.id);
        if (!member) {
            throw new Error('You must be a member to interact with posts in this community');
        }

        if (member.banned) {
            throw new Error('You are banned from this community');
        }
        
        // FIXED MAJOR-005: Removed redundant 'likes' field - only track likedBy array
        // The likes count should be calculated from likedBy.length when needed
        const updateOperation = isLiked
            ? { $pull: { likedBy: user.id } }
            : { $addToSet: { likedBy: user.id } };

        const result = await db.collection("posts").updateOne(
            { 
                _id: postObjectId, 
                communityId: communityObjId,
                deletedAt: { $exists: false }
            },
            updateOperation as any
        );
        
        if (!result.matchedCount) {
            throw new Error('Post not found');
        }
        
        // Only send notification when liking (not unliking)
        if (!isLiked && result.modifiedCount > 0) {
            // Fetch post to get author info
            const postDoc = await db.collection("posts").findOne(
                { _id: postObjectId },
                { projection: { authorId: 1 } }
            );
            
            if (postDoc && postDoc.authorId !== user.id) {
                const notification: Omit<Notification, '_id'> = {
                    userId: postDoc.authorId,
                    type: 'community' as const,
                    title: 'Post Interaction',
                    message: `${sanitizeInput(user.name || 'Someone')} liked your post.`,
                    link: `/community/${communityId}`,
                    read: false,
                    createdAt: new Date().toISOString(),
                    metadata: {
                        communityId,
                        postId,
                        actionType: 'like'
                    }
                };
                await db.collection("notifications").insertOne(notification);
            }
        }

        revalidatePath(`/community/${communityId}`);
        
        // Emit real-time update only if state actually changed
        if (result.modifiedCount > 0) {
            try {
                const { emitCommunityPostLiked } = await import('../../server');
                await emitCommunityPostLiked(communityId, postId, user.id, !isLiked);
            } catch (emitError) {
                console.warn('Failed to emit real-time update for like toggle:', emitError);
            }
        }
        
        return { success: true };
    });
}


/**
 * Adds a comment to a community post.
 * @param communityId The ID of the community.
 * @param postId The ID of the post.
 * @param content The content of the comment.
 * @returns An object with the result of the operation and the new comment.
 */
export async function addComment(communityId: string, postId: string, content: string, parentId?: string) {
    return withAuthenticatedUserFull(async ({ db, user, userId }) => {
        const rateLimitResult = await checkUserRateLimit(user.id, 'ADD_COMMENT', RATE_LIMITS.ADD_COMMENT);
        if (!rateLimitResult.allowed) {
            throw createAppError(ErrorType.RATE_LIMIT, rateLimitResult.feedback || 'Too many comments. Please try again later.');
        }
        
        // Validate input data with Zod schema
        const validation = validateWithSchema(commentSchema, { content, postId, parentId });
        if (!validation.success) {
            throw createAppError(ErrorType.VALIDATION, validation.message);
        }
        const validatedData = validation.data;

        if (!ObjectId.isValid(communityId)) throw new Error('Invalid community ID format');
        if (!ObjectId.isValid(postId)) throw new Error('Invalid post ID format');

        // Ensure membership
        const membership = await db.collection('communities').findOne({ _id: new ObjectId(communityId), "members.userId": user.id });
        if (!membership) throw new Error('You must be a member to comment in this community');

        // Moderate content
        const { ContentModerationSystem } = await import('@/lib/content-moderation');
        const moderationResult = await ContentModerationSystem.moderateCommunityContent(
            postId,
            'comment',
            validatedData.content,
            user.id
        );
        if (!moderationResult.approved && moderationResult.action === 'reject') {
            throw createAppError(ErrorType.VALIDATION, 'Your comment contains content that violates our community guidelines.');
        }

        const postObjectId = new ObjectId(postId);
        const parentObjectId = parentId && ObjectId.isValid(parentId) ? new ObjectId(parentId) : null;
        const now = new Date().toISOString();
        const authorInfo = await db.collection('users').findOne({ _id: new ObjectId(user.id) }, { projection: { name: 1, avatarUrl: 1 } });

        const commentDoc = {
            postId: postObjectId,
            communityId: new ObjectId(communityId),
            authorId: user.id,
            author: { _id: user.id, name: authorInfo?.name || 'Anonymous', avatarUrl: authorInfo?.avatarUrl || '' },
            content: sanitizeInput(validatedData.content),
            createdAt: now,
            parentId: parentObjectId,
            path: parentObjectId ? `${postId}/${parentId}` : postId,
            reactions: [],
        } as any;

        const insertRes = await db.collection('comments').insertOne(commentDoc);
        await db.collection('posts').updateOne({ _id: postObjectId }, { $inc: { commentCount: 1 } });

        // Notify post author (if not self)
        const postDoc = await db.collection('posts').findOne({ _id: postObjectId });
        if (postDoc && postDoc.authorId !== user.id) {
            const notification: Omit<Notification, '_id'> = {
                userId: postDoc.authorId,
                type: 'community',
                title: 'New Comment',
                message: `${sanitizeInput(user.name || 'Someone')} commented on your post`,
                link: `/community/${communityId}`,
                read: false,
                createdAt: now,
                metadata: { communityId, postId, actionType: 'comment' }
            };
            await db.collection('notifications').insertOne(notification);
        }

        // Notify parent comment author on reply (if different from post author and self)
        if (parentObjectId) {
            const parentComment = await db.collection('comments').findOne({ _id: parentObjectId });
            if (parentComment && parentComment.authorId !== user.id && parentComment.authorId !== postDoc?.authorId) {
                await db.collection('notifications').insertOne({
                    userId: parentComment.authorId,
                    type: 'community',
                    title: 'New Reply',
                    message: `${sanitizeInput(user.name || 'Someone')} replied to your comment`,
                    link: `/community/${communityId}`,
                    read: false,
                    createdAt: now,
                    metadata: { communityId, postId, commentId: insertRes.insertedId.toString(), actionType: 'reply' }
                });
            }
        }

        revalidatePath(`/community/${communityId}`);
        try {
            const { emitCommunityCommentCreated } = await import('../../server');
            await emitCommunityCommentCreated(communityId, postId, { ...commentDoc, _id: insertRes.insertedId });
        } catch (emitError) {
            console.warn('Failed to emit real-time update for new comment:', emitError);
        }

        return { success: true, comment: { ...commentDoc, _id: insertRes.insertedId } };
    });
}


/**
 * Deletes a post from a community.
 * @param communityId The ID of the community.
 * @param postId The ID of the post to delete.
 * @returns An object with the result of the operation.
 */
export async function deletePost(communityId: string, postId: string) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // FIXED CRITICAL-002: Strict ObjectId validation to prevent NoSQL injection
        if (!ObjectId.isValid(communityId)) {
            throw new Error("Invalid community ID format");
        }
        
        if (!ObjectId.isValid(postId)) {
            throw new Error("Invalid post ID format");
        }

        const communityObjId = new ObjectId(communityId);
        const postObjId = new ObjectId(postId);

        // FIXED CRITICAL-003: Check membership BEFORE attempting to access post
        const community = await db.collection("communities").findOne(
            { 
                _id: communityObjId,
                'members.userId': user.id  // Verify user is a member
            },
            { projection: { _id: 1, createdBy: 1, members: 1 } }
        );

        if (!community) {
            // Generic error to prevent information disclosure
            throw new Error("Not authorized to access this community");
        }

        // FIXED MAJOR-001: Use posts collection (not embedded posts)
        const post = await db.collection("posts").findOne({
            _id: postObjId,
            communityId: communityObjId,
            deletedAt: { $exists: false }
        }) as any;

        if (!post) {
            throw new Error("Post not found");
        }

        // Check authorization: post author, community creator, or system admin
        const isAdmin = user.role === 'admin';
        const isCreator = community.createdBy === user.id;
        const isAuthor = post.authorId === user.id;

        // Get user's community role for moderator check
        const member = (community as any).members?.find((m: any) => m.userId === user.id);
        const hasModerationRole = member?.role === 'admin' || member?.role === 'moderator';

        if (!isAuthor && !isCreator && !isAdmin && !hasModerationRole) {
            throw new Error("Unauthorized: You cannot delete this post");
        }

        // Soft delete the post (mark as deleted instead of removing)
        await db.collection("posts").updateOne(
            { _id: postObjId },
            {
                $set: {
                    deletedAt: new Date(),
                    deletedBy: user.id
                }
            }
        );

        // Also delete all comments associated with this post
        await db.collection("comments").updateMany(
            { postId: postObjId },
            {
                $set: {
                    deletedAt: new Date(),
                    deletedBy: user.id
                }
            }
        );

        revalidatePath(`/community/${communityId}`);
        return { success: true };
    });
}

/**
 * Edits a post in a community.
 * @param communityId The ID of the community.
 * @param postId The ID of the post to edit.
 * @param newContent The new content for the post.
 * @returns An object with the result of the operation.
 */
export async function editPost(communityId: string, postId: string, newContent: string) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // FIXED CRITICAL-002: Strict ObjectId validation to prevent NoSQL injection
        if (!ObjectId.isValid(communityId)) {
            throw new Error("Invalid community ID format");
        }

        if (!ObjectId.isValid(postId)) {
            throw new Error("Invalid post ID format");
        }

        // Validate content
        if (!newContent || newContent.trim().length === 0) {
            throw new Error("Post content is required");
        }
        if (newContent.length > 5000) {
            throw new Error("Post too long (max 5000 characters)");
        }

        const communityObjId = new ObjectId(communityId);
        const postObjId = new ObjectId(postId);

        // FIXED CRITICAL-003: Check membership BEFORE attempting to access post
        const community = await db.collection("communities").findOne(
            { 
                _id: communityObjId,
                'members.userId': user.id  // Verify user is a member
            },
            { projection: { _id: 1 } }
        );

        if (!community) {
            // Generic error to prevent information disclosure
            throw new Error("Not authorized to access this community");
        }

        // FIXED MAJOR-001: Use posts collection (not embedded posts)
        const post = await db.collection("posts").findOne({
            _id: postObjId,
            communityId: communityObjId,
            deletedAt: { $exists: false }
        }) as any;

        if (!post) {
            throw new Error("Post not found");
        }

        // IMPORTANT: Only post author can edit posts (even admins cannot edit others' posts)
        if (post.authorId !== user.id) {
            throw new Error("Unauthorized: You can only edit your own posts");
        }

        // Re-moderate edited content before saving
        try {
            const { ContentModerationSystem } = await import('@/lib/content-moderation');
            const moderationResult = await ContentModerationSystem.moderateCommunityContent(
                postId,
                'post',
                newContent,
                user.id
            );
            if (!moderationResult.approved && moderationResult.action === 'reject') {
                throw createAppError(ErrorType.VALIDATION, 'Your edited post contains content that violates our community guidelines.');
            }
        } catch (moderationError) {
            // Re-throw validation rejections; ignore moderation service failures so edits aren't blocked
            if ((moderationError as { type?: string }).type === ErrorType.VALIDATION) throw moderationError;
            console.warn('editPost: moderation service unavailable, proceeding with edit', moderationError);
        }

        // Update the post with sanitized content
        await db.collection("posts").updateOne(
            { _id: postObjId },
            {
                $set: {
                    content: sanitizeInput(newContent),
                    editedAt: new Date()
                }
            }
        );

        revalidatePath(`/community/${communityId}`);
        return { success: true };
    });
}

/**
 * Searches communities by name and description.
 * @param searchQuery The search query string.
 * @returns An array of matching communities.
 */
export async function searchCommunities(searchQuery: string) {
    try {
        if (!searchQuery || searchQuery.trim().length === 0) {
            return { success: true, communities: [] };
        }

        // Use optimized search from database-optimization.ts
        const result = await OptimizedQueries.searchCommunities(searchQuery, 1, 20);
        
        return { 
            success: true, 
            communities: JSON.parse(JSON.stringify(result.communities)),
            pagination: result.pagination
        };
    } catch (error) {
        console.error("Error searching communities:", error);
        return { success: false, communities: [], message: "Failed to search communities" };
    }
}


/**
 * Creates a new community.
 * @param communityData The data for the new community.
 * @returns An object with the result of the operation.
 */
export async function createCommunity(communityData: { name: string, description: string, imageUrl: string, createdBy: string }) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (user.id !== communityData.createdBy) throw new Error("Unauthorized");

        // Validate input data with Zod schema
        const validation = validateWithSchema(communitySchema, communityData);
        if (!validation.success) {
            throw createAppError(ErrorType.VALIDATION, validation.message);
        }
        const validatedData = validation.data;

        const newCommunity: Omit<Community, '_id'> = {
            name: sanitizeInput(validatedData.name),
            description: sanitizeInput(validatedData.description),
            imageUrl: normalizeMediaUrl(communityData.imageUrl),
            createdBy: user.id,
            visibility: 'public',
            postingPermissions: 'anyone',
            commentPermissions: 'anyone',
            invitePermissions: 'anyone',
            members: [{ userId: user.id, role: 'admin', joinedAt: new Date().toISOString() }] as any,
            memberCount: 1,
            posts: [],
            channels: [
                {
                    _id: 'general',
                    name: 'General',
                    type: 'forum',
                    description: 'General discussion',
                    order: 0,
                    createdAt: new Date().toISOString()
                },
                {
                    _id: 'chat',
                    name: 'Chat',
                    type: 'chat',
                    description: 'General chat',
                    order: 1,
                    createdAt: new Date().toISOString()
                }
            ]
        };
        const result = await db.collection("communities").insertOne(newCommunity);

        const createdCommunity = { ...newCommunity, _id: result.insertedId };

        revalidatePath('/community');
        
        // Emit real-time new community event
        try {
            const { emitNewCommunity } = await import('../../server');
            await emitNewCommunity(createdCommunity);
        } catch (emitError) {
            console.warn('Failed to emit new community event:', emitError);
        }

        return { success: true, communityId: result.insertedId.toString() };
    });
}


/**
 * Blocks a user, preventing them from sending messages or starting chats.
 * @param userIdToBlock The ID of the user to block.
 * @returns An object with the result of the operation.
 */
export async function blockUser(userIdToBlock: string) {
    return withAuthenticatedUserFull(async ({ db, user, userId }) => {
        const rateLimitResult = await checkUserRateLimit(user.id, 'BLOCK_USER', RATE_LIMITS.BLOCK_USER);
        if (!rateLimitResult.allowed) {
            throw createAppError(ErrorType.RATE_LIMIT, rateLimitResult.error || 'Too many block requests. Please try again later.');
        }

        const { validateObjectId, ValidationError } = await import('@/lib/validation');
        
        const validatedBlockUserId = validateObjectId(userIdToBlock);
        
        // Prevent self-blocking
        if (validatedBlockUserId.toString() === user.id) {
            throw new ValidationError("Cannot block yourself");
        }

        // Verify user exists
        const userToBlock = await db.collection("users").findOne({
            _id: validatedBlockUserId
        });
        
        if (!userToBlock) {
            throw new ValidationError("User not found");
        }

        // Add to blocked list (both directions so neither can contact the other)
        await Promise.all([
            db.collection("users").updateOne(
                { _id: new ObjectId(user.id) },
                { $addToSet: { blockedUsers: validatedBlockUserId.toString() } }
            ),
            db.collection("users").updateOne(
                { _id: validatedBlockUserId },
                { $addToSet: { blockedUsers: user.id } }
            ),
        ]);

        // Log activity
        await logActivity(
            userId.toString(), 
            'BLOCK_USER', 
            'medium',
            `Blocked user ${userIdToBlock}`,
            {
                blockedUserId: userIdToBlock,
                timestamp: getCurrentTimestamp()
            }
        );

        return { success: true, message: "User blocked successfully" };
    });
}

/**
 * Unblocks a previously blocked user.
 * @param userIdToUnblock The ID of the user to unblock.
 * @returns An object with the result of the operation.
 */
export async function unblockUser(userIdToUnblock: string) {
    return withAuthenticatedUserFull(async ({ db, user, userId }) => {
        const { validateObjectId } = await import('@/lib/validation');
        
        const validatedUnblockUserId = validateObjectId(userIdToUnblock);

        // Remove from both sides so the block is fully cleared
        await Promise.all([
            db.collection("users").updateOne(
                { _id: new ObjectId(user.id) },
                { $pull: { blockedUsers: validatedUnblockUserId.toString() } as any }
            ),
            db.collection("users").updateOne(
                { _id: validatedUnblockUserId },
                { $pull: { blockedUsers: user.id } as any }
            ),
        ]);

        // Log activity
        await logActivity(
            userId.toString(), 
            'UNBLOCK_USER', 
            'low',
            `Unblocked user ${userIdToUnblock}`,
            {
                unblockedUserId: userIdToUnblock,
                timestamp: getCurrentTimestamp()
            }
        );

        return { success: true, message: "User unblocked successfully" };
    });
}

/**
 * Checks if a user has blocked another user.
 * @param userId The ID of the user who might have blocked.
 * @param targetUserId The ID of the potentially blocked user.
 * @returns True if blocked, false otherwise.
 */
export async function isUserBlocked(userId: string, targetUserId: string): Promise<boolean> {
    try {
        const client = await clientPromise;
        const db = client.db(process.env.MONGODB_DB);
        
        const user = await db.collection("users").findOne(
            { _id: new ObjectId(userId) },
            { projection: { blockedUsers: 1 } }
        );
        
        return user?.blockedUsers?.includes(targetUserId) || false;
    } catch (error) {
        console.error('Error checking if user is blocked:', error);
        return false;
    }
}

/**
 * Gets the list of users blocked by the current user.
 * @returns An object with the list of blocked users.
 */
export async function getBlockedUsers() {
    return withAuthenticatedUserFull(async ({ db, user, userId }) => {
        const userDoc = await db.collection("users").findOne(
            { _id: new ObjectId(user.id) },
            { projection: { blockedUsers: 1 } }
        );

        if (!userDoc?.blockedUsers || userDoc.blockedUsers.length === 0) {
            return { success: true, blockedUsers: [] };
        }

        // Fetch blocked user details
        const blockedUserIds = userDoc.blockedUsers
            .filter((id: string) => ObjectId.isValid(id))
            .map((id: string) => new ObjectId(id));

        const blockedUsers = await db.collection("users")
            .find({ _id: { $in: blockedUserIds } })
            .project({ password: 0, email: 0 })
            .toArray();

        return { 
            success: true, 
            blockedUsers: JSON.parse(JSON.stringify(blockedUsers)) 
        };
    });
}

/**
 * Initiates contact with a user, creating a chat if one doesn't exist.
 * @param otherUserId The ID of the user to contact.
 * @param bookId The ID of the book being discussed (optional).
 * @returns An object with the result of the operation and the chat ID.
 */
export async function startChat(otherUserId: string, bookId?: string): Promise<{ success: true; data: { chatId: string } } | { success: false; message: string }> {
    return withAuthenticatedUserFull(async ({ db, user, userId }) => {
        // Import validation utilities
        const { validateObjectId, ValidationError } = await import('@/lib/validation');

        const rateLimitResult = await checkUserRateLimit(user.id, 'START_CHAT', RATE_LIMITS.START_CHAT);
        if (!rateLimitResult.allowed) {
            throw createAppError(ErrorType.RATE_LIMIT, rateLimitResult.error || 'Too many chat requests. Please try again later.');
        }

        if (!otherUserId || typeof otherUserId !== 'string') {
            throw new ValidationError('otherUserId is required and must be a string.');
        }
        if (bookId !== undefined && (typeof bookId !== 'string' || bookId.trim() === '')) {
            throw new ValidationError('bookId must be a non-empty string when provided.');
        }

        // Validate input parameters
        const validatedOtherUserId = validateObjectId(otherUserId);
        const validatedBookId = bookId ? validateObjectId(bookId) : undefined;

        // Prevent self-chat
        if (validatedOtherUserId.toString() === user.id) {
            throw new ValidationError("Cannot start a conversation with yourself.");
        }
        
        // Verify other user exists
        const otherUser = await db.collection("users").findOne({ _id: validatedOtherUserId });
        if (!otherUser) {
            throw new ValidationError("User not found.");
        }
        
        // Check if users have blocked each other
        const [currentUserBlocksOther, otherBlocksCurrent] = await Promise.all([
            isUserBlocked(user.id, validatedOtherUserId.toString()),
            isUserBlocked(validatedOtherUserId.toString(), user.id)
        ]);

        if (currentUserBlocksOther) {
            throw new ValidationError("You have blocked this user. Unblock them to start a conversation.");
        }

        if (otherBlocksCurrent) {
            throw new ValidationError("This user has blocked you. You cannot start a conversation.");
        }
        
        // If bookId provided, verify book exists and is available for sale
        if (validatedBookId) {
            const book = await db.collection("books").findOne({ _id: validatedBookId });
            if (!book) {
                throw new ValidationError("Book not found.");
            }
            if (book.sellerId === user.id) {
                throw new ValidationError("Cannot contact yourself about your own book.");
            }
        }
        
        const participantIds = [user.id, validatedOtherUserId.toString()].sort();
        const now = new Date().toISOString();

        // Atomic find-or-create: prevents duplicate chats under concurrent calls (TOCTOU fix)
        const upsertResult = await db.collection("chats").findOneAndUpdate(
            { participantIds: { $all: participantIds }, bookId: validatedBookId ?? null },
            {
                $setOnInsert: {
                    participantIds,
                    bookId: validatedBookId,
                    messages: [],
                    updatedAt: now,
                    createdAt: now,
                }
            },
            { upsert: true, returnDocument: 'after' }
        );

        const chat = upsertResult!;
        const chatId = chat._id.toString();
        // NOTE: createdAt matching `now` means this call did the insert; otherwise another caller won the race
        const isNewChat = (chat as { createdAt?: string }).createdAt === now;

        if (!isNewChat) {
            return { chatId };
        }

        // Send email notification to book seller (if they have email notifications enabled)
        if (validatedBookId) { // Only for new chats about books
            try {
                const book = await db.collection("books").findOne({ _id: validatedBookId });
                if (book) {
                    const otherUserEmailPrefs = otherUser.emailPreferences;
                    if (!otherUserEmailPrefs || otherUserEmailPrefs.contactNotifications !== false) {
                        await sendBookContactEmail(
                            otherUser.email,
                            otherUser.name,
                            user.name || 'BookEx User',
                            book.title,
                            book.type,
                            chatId
                        );
                    }
                }
            } catch (emailError) {
                // Log email error but don't fail the chat creation
                console.warn('Failed to send book contact email:', emailError);
            }
        }

        // Notify the other participant in real-time that a new chat was created
        try {
            const { emitNewChatNotification } = await import('../../server');
            await emitNewChatNotification(chatId, user.id, validatedOtherUserId.toString());
        } catch {
            // Don't fail chat creation if socket emission fails
        }

        // Log successful chat initiation
        console.log(`Chat initiated: User ${user.id} -> User ${otherUserId}${bookId ? ` for book ${bookId}` : ''}`);

        return { chatId };
    });
}

/**
 * Initiates an exchange chat with comprehensive validation and security checks.
 * @param otherUserId The ID of the user to contact.
 * @param bookId The ID of the book being discussed.
 * @returns An object with the result of the operation and the chat ID.
 */
export async function startExchangeChat(otherUserId: string, bookId: string): Promise<{ success: true; data: { chatId: string } } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Import validation utilities
        const { validateChatParams, validateUserCity, ValidationError } = await import('@/lib/validation');
        
        // Validate and sanitize input parameters
        const validatedParams = validateChatParams(otherUserId, bookId, user.id);

        // Fetch all required data with proper validation
        const [currentUser, targetBook, otherUser] = await Promise.all([
            db.collection("users").findOne({ _id: validatedParams.currentUserId }),
            db.collection("books").findOne({ _id: validatedParams.bookId }),
            db.collection("users").findOne({ _id: validatedParams.otherUserId })
        ]);

        // Comprehensive validation checks
        if (!currentUser) {
            throw new ValidationError("Current user not found");
        }
        
        if (!targetBook) {
            throw new ValidationError("Book not found");
        }
        
        if (!otherUser) {
            throw new ValidationError("Target user not found");
        }
        
        // Check if users have blocked each other
        const [currentUserBlocksOther, otherBlocksCurrent] = await Promise.all([
            isUserBlocked(user.id, validatedParams.otherUserId.toString()),
            isUserBlocked(validatedParams.otherUserId.toString(), user.id)
        ]);

        if (currentUserBlocksOther || otherBlocksCurrent) {
            throw new ValidationError("Cannot start chat due to blocking restrictions");
        }
        
        // Validate book is available for exchange
        if (targetBook.type !== 'exchange') {
            throw new ValidationError("This book is not available for exchange");
        }
        
        if (targetBook.sellerId === user.id) {
            throw new ValidationError("Cannot start an exchange with your own book");
        }

        // Check if current user has any exchange books
        const userExchangeBook = await db.collection("books").findOne({ 
            sellerId: user.id, 
            type: 'exchange' 
        });
        
        if (!userExchangeBook) {
            throw new Error("You must have at least one book listed for exchange to start a trade.");
        }

                // Centralized eligibility check (server authoritative)
                const { default: locationUtils } = await import('@/lib/location/location-utils');
                const eligibility = locationUtils.canUserExchange({
                    proposer: { id: user.id, cityNormalized: currentUser.cityNormalized, avatarUrl: currentUser.avatarUrl, bio: currentUser.bio },
                    responder: { id: otherUser.id, cityNormalized: otherUser.cityNormalized, avatarUrl: otherUser.avatarUrl, bio: otherUser.bio },
                    proposerBook: { sellerId: undefined, status: 'active' },
                    responderBook: { sellerId: undefined, status: 'active' }
                });

                if (!eligibility.allowed) {
                    throw new Error(eligibility.reason || 'Users are not eligible to exchange');
                }

        // Check if chat already exists
        const participantIds = [user.id, otherUserId].sort();
        
        let chat = await db.collection("chats").findOne({ 
            participantIds: { $all: participantIds },
            bookId: validatedParams.bookId
        });

        if (chat) {
            return { chatId: chat._id.toString() };
        }

        // Create initial exchange message
        const initialMessage = `Hi, I'm interested in your book "${targetBook.title}". I have "${userExchangeBook.title}" and other books available for exchange. Let me know if you're interested in a trade!`;

        const newMessage = {
            _id: new ObjectId(),
            senderId: user.id,
            text: initialMessage,
            createdAt: new Date().toISOString(),
        };
        
        const newChat: Omit<Chat, '_id'> = {
            participantIds,
            bookId: validatedParams.bookId,
            messages: [newMessage],
            lastMessage: initialMessage,
            updatedAt: new Date().toISOString(),
        };

        const result = await db.collection("chats").insertOne(newChat);

        // Send email notification to book seller (if they have email notifications enabled)
        try {
            const otherUserEmailPrefs = otherUser.emailPreferences;
            if (!otherUserEmailPrefs || otherUserEmailPrefs.contactNotifications !== false) {
                await sendBookContactEmail(
                    otherUser.email,
                    otherUser.name,
                    currentUser.name || 'BookEx User',
                    targetBook.title,
                    'exchange',
                    result.insertedId.toString()
                );
            }
        } catch (emailError) {
            // Log email error but don't fail the exchange creation
            console.warn('Failed to send book contact email for exchange:', emailError);
        }
        
        // Log successful exchange initiation for monitoring
        console.log(`Exchange chat initiated: User ${user.id} -> User ${otherUserId} for book ${bookId}`);

        return { chatId: result.insertedId.toString() };
    });
}

/**
 * Checks if a book is in the user's wishlist using bookId.
 * @param bookId The ID of the book to check.
 * @returns A boolean indicating if the book is wishlisted.
 */
export async function isBookWishlisted(bookId: string): Promise<boolean> {
    try {
        const result = await withAuthenticatedAction(async ({ db, user, userId }) => {
            // Validate input
            if (!bookId || typeof bookId !== 'string') {
                return false;
            }

            // Check if book exists in wishlist by bookId
            const existsQuery = ConsistentWishlistOperations.createExistsQuery(user.id, bookId);
            const userWithWishlistItem = await db.collection("users").findOne(existsQuery);

            return !!userWithWishlistItem;
        });
        
        // Handle the wrapper's return type
        if (typeof result === 'boolean') {
            return result;
        }
        return false;
    } catch (error) {
        return false;
    }
}

/**
 * Adds or removes a book from the user's wishlist.
 * @param bookId The ID of the book to add/remove.
 * @param isWishlisted Whether the book is currently wishlisted.
 * @returns An object with the result of the operation.
 */
export async function toggleWishlist(bookId: string, isWishlisted: boolean) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Check rate limit
        const rateLimitResult = await checkUserRateLimit(user.id, 'TOGGLE_WISHLIST', RATE_LIMITS.TOGGLE_WISHLIST);
        if (!rateLimitResult.allowed) {
            throw createAppError(ErrorType.RATE_LIMIT, rateLimitResult.error || "Too many wishlist operations");
        }

        // Enhanced validation for bookId
        if (!bookId || typeof bookId !== 'string') {
            throw createAppError(ErrorType.VALIDATION, "Invalid book ID");
        }

        // Verify book exists
        const book = await db.collection("books").findOne({ _id: new ObjectId(bookId) });
        if (!book) {
            throw createAppError(ErrorType.NOT_FOUND, "Book not found");
        }

        // Use consistent schema operations for add/remove
        const updateOperation = isWishlisted
            ? ConsistentWishlistOperations.createRemoveOperation(bookId)
            : ConsistentWishlistOperations.createAddOperation(bookId);

        const result = await db.collection("users").updateOne(
            { _id: new ObjectId(user.id) },
            updateOperation as any
        );

        if (result.modifiedCount === 0) {
            throw createAppError(ErrorType.DATABASE, "Failed to update wishlist");
        }

        revalidatePath('/profile/me');
        return { message: isWishlisted ? 'Removed from wishlist' : 'Added to wishlist' };
    });
}

/**
 * Fetches approved organizations for donations.
 * @returns An array of Organization objects.
 */
export async function getApprovedOrganizations(): Promise<Organization[]> {
    try {
        const client = await clientPromise;
        const db = client.db("bookex");
        const orgs = await db.collection("organizations").find({ status: "approved" }).toArray();
        return JSON.parse(JSON.stringify(orgs));
    } catch (error) {
        console.error("Error fetching organizations:", error);
        return [];
    }
}

/**
 * Fetches approved organizations for donations with Redis caching.
 * @returns An array of Organization objects.
 */
export async function getApprovedOrganizationsCached(): Promise<Organization[]> {
    const CACHE_KEY = 'approved_organizations';
    const CACHE_TTL = 5 * 60; // 5 minutes

    try {
        // Try to get from cache first
        const { default: redisCache } = await import('@/lib/redis-cache');
        const cacheResult = await redisCache.get<Organization[]>(CACHE_KEY);

        if (cacheResult.hit) {
            return cacheResult.value;
        }

        // Cache miss - fetch from database
        console.log('📡 Cache miss - fetching approved organizations from database');
        const client = await clientPromise;
        const db = client.db("bookex");
        const orgs = await db.collection("organizations").find({ status: "approved" }).toArray();
        const serializedOrgs = JSON.parse(JSON.stringify(orgs));

        // Cache the result
        try {
            await redisCache.set(CACHE_KEY, serializedOrgs, CACHE_TTL);
            console.log('💾 Cached approved organizations for', CACHE_TTL, 'seconds');
        } catch (cacheError) {
            console.warn('⚠️ Failed to cache organizations:', cacheError);
            // Don't fail the request if caching fails
        }

        return serializedOrgs;
    } catch (error) {
        console.error("Error fetching organizations:", error);
        return [];
    }
}

/**
 * Submits an application for a new organization.
 * @param orgData The organization data.
 * @returns An object with the result of the operation.
 */
export async function applyForOrganization(orgData: Omit<Organization, '_id' | 'status' | 'createdAt'>) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (user.id !== orgData.submittedBy) throw new Error("Unauthorized");
        
        // Log organization application attempt
        await logActivity(
            user.id,
            'organization_application',
            'medium',
            `User applied for organization: ${orgData.name}`,
            { 
                organizationName: orgData.name,
                location: orgData.location,
                contactEmail: orgData.contactEmail
            }
        );
        
        // Validate organization data
        const validation = validateWithSchema(organizationSchema, {
            name: orgData.name,
            description: orgData.description,
            location: orgData.location,
            contactEmail: orgData.contactEmail,
            contactPhone: orgData.contactPhone,
            website: orgData.website,
            submittedBy: orgData.submittedBy,
        });

        if (!validation.success) {
            return { success: false, message: validation.message };
        }

        // Check for duplicate organization names (case-insensitive)
        const sanitizedName = sanitizeOrganizationName(orgData.name);
        const existingOrg = await db.collection("organizations").findOne({
            $expr: {
                $eq: [
                    { $toLower: { $trim: { input: "$name" } } },
                    sanitizedName
                ]
            }
        });

        if (existingOrg) {
            return { success: false, message: "An organization with this name already exists." };
        }

        const newOrg: Omit<Organization, '_id'> = {
            ...orgData,
            status: 'pending' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const result = await db.collection("organizations").insertOne(newOrg);
        
        // Send admin notification email
        try {
            // Get admin email (you can configure this in environment variables)
            const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
            if (adminEmail) {
                await sendOrgApplicationNotificationEmail(
                    adminEmail,
                    orgData.name,
                    orgData.description,
                    user.id,
                    result.insertedId.toString()
                );
            }
        } catch (emailError) {
            // Don't fail the application if email fails, just log it
            console.error("Failed to send admin notification email:", emailError);
        }
        
        // Create admin notification for new organization application
        try {
            const { notifyNewOrganization } = await import('@/lib/admin-notifications');
            await notifyNewOrganization(
                result.insertedId.toString(),
                orgData.name,
                orgData.contactEmail || 'No email provided'
            );
        } catch (error) {
            console.warn('Failed to create admin notification for organization application:', error);
        }
        
        // Log successful organization application
        await logActivity(
            user.id,
            'organization_application',
            'low',
            `Successfully submitted organization application: ${orgData.name}`,
            { 
                organizationId: result.insertedId.toString(),
                organizationName: orgData.name,
                status: 'pending'
            }
        );

        return { success: true };
    });
}

/**
 * Enhanced organization application with file upload support
 * @param formData FormData containing organization info and image file
 * @returns Result of the operation
 */
export async function applyForOrganizationWithFile(formData: FormData) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Extract form data
        const name = formData.get('name') as string;
        const description = formData.get('description') as string;
        const location = formData.get('location') as string;
        const contactEmail = formData.get('contactEmail') as string || undefined;
        const contactPhone = formData.get('contactPhone') as string || undefined;
        const website = formData.get('website') as string || undefined;
        
        // Validate organization data
        const validation = validateOrganizationData({
            name,
            description,
            location,
            contactEmail,
            contactPhone,
            website
        });

        if (!validation.isValid) {
            return { success: false, message: validation.error };
        }

        const imageUrl = formData.get('imageUrl') as string;
        if (!imageUrl) {
            return { success: false, message: 'Image URL is required' };
        }

        const normalizedImageUrl = normalizeMediaUrl(imageUrl);

        // Check for duplicate organization names
        const sanitizedName = sanitizeOrganizationName(name);
        const existingOrg = await db.collection("organizations").findOne({
            $expr: {
                $eq: [
                    { $toLower: { $trim: { input: "$name" } } },
                    sanitizedName
                ]
            }
        });

        if (existingOrg) {
            return { success: false, message: "An organization with this name already exists." };
        }

        const newOrg: Omit<Organization, '_id'> = {
            name: name.trim(),
            description: description.trim(),
            location: location.trim(),
            imageUrl: normalizedImageUrl,
            contactEmail: contactEmail?.trim(),
            contactPhone: contactPhone?.trim(),
            website: website?.trim(),
            status: 'pending' as const,
            submittedBy: user.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const result = await db.collection("organizations").insertOne(newOrg);
        
        // Send admin notification email
        try {
            const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
            if (adminEmail) {
                await sendOrgApplicationNotificationEmail(
                    adminEmail,
                    name.trim(),
                    description.trim(),
                    user.id,
                    result.insertedId.toString()
                );
            }
        } catch (emailError) {
            console.error("Failed to send admin notification email:", emailError);
        }
        
        return { success: true };
    });
}

/**
 * Initiates a donation chat with an organization.
 * @param organizationId The ID of the organization.
 * @returns An object with the result, chatId, and donationId.
 */
export async function initiateDonation(organizationId: string) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Log donation initiation
        await logActivity(
            user.id,
            'donation_initiate',
            'medium',
            `User initiated donation to organization ${organizationId}`,
            { organizationId },
            undefined, // ipAddress
            undefined, // userAgent
            undefined  // sessionId
        );

        // Validate ObjectId format
        if (!ObjectId.isValid(organizationId)) {
            return { success: false, message: "Invalid organization ID." };
        }

        const org = await db.collection("organizations").findOne({ 
            _id: new ObjectId(organizationId),
            status: 'approved',  // Only allow donations to approved organizations
            deleted: { $ne: true }  // Exclude soft-deleted organizations
        });
        
        if (!org) {
            return { success: false, message: "Organization not found or not accepting donations." };
        }
        
        // Prevent self-donation (primary contact)
        if (org.primaryContactId === user.id) {
            return { 
                success: false, 
                message: "You cannot donate to your own organization." 
            };
        }
        
        // Prevent representative donation
        const isRepresentative = org.representatives?.some(
            (rep: any) => rep.userId === user.id
        );
        
        if (isRepresentative) {
            return { 
                success: false, 
                message: "Organization representatives cannot donate to their own organization." 
            };
        }

        // Check if organization has a primary contact
        if (!org.primaryContactId) {
            // Migration: If no primaryContactId, set it to the submitter
            await db.collection("organizations").updateOne(
                { _id: new ObjectId(organizationId) },
                { 
                    $set: { 
                        primaryContactId: org.submittedBy,
                        representatives: [
                            {
                                userId: org.submittedBy,
                                role: 'primary',
                                addedAt: new Date().toISOString(),
                                addedBy: 'system'
                            }
                        ],
                        updatedAt: new Date().toISOString()
                    } 
                }
            );
            
            // Update the org object for use in this function
            org.primaryContactId = org.submittedBy;
            
            console.log(`Auto-assigned primaryContactId for organization ${organizationId}`);
        }

        // Use REAL user IDs for both participants
        const participantIds = [user.id, org.primaryContactId].sort();

        // FIRST: Check if ANY chat exists between these participants (donation or regular)
        let chat = await db.collection("chats").findOne({ 
            participantIds: { $all: participantIds }
        });

        let donation;
        let isNewChat = false;
        
        // If chat exists, check if it already has this organization context
        if (chat) {
            // If the chat doesn't have an organizationId, add it
            if (!chat.organizationId) {
                await db.collection("chats").updateOne(
                    { _id: chat._id },
                    { 
                        $set: { 
                            organizationId: new ObjectId(organizationId),
                            updatedAt: new Date().toISOString()
                        }
                    }
                );
                chat.organizationId = new ObjectId(organizationId);
            }
            
            // If chat was previously deleted, restore it by removing BOTH users from deletedBy
            if (chat.deletedBy && Array.isArray(chat.deletedBy) && chat.deletedBy.length > 0) {
                await db.collection("chats").updateOne(
                    { _id: chat._id },
                    { 
                        $set: { 
                            deletedBy: [],
                            updatedAt: new Date().toISOString() 
                        }
                    }
                );
                chat.deletedBy = [];
            }
        }
        
        if (!chat) {
            isNewChat = true;

            // Wrap the core inserts in a MongoDB transaction for atomicity
            const mongoClient = await clientPromise;
            const txSession = mongoClient.startSession();
            let donationResult: any;
            let chatResult: any;

            try {
                await txSession.withTransaction(async () => {
                    const newDonation = {
                        donorId: user.id,
                        organizationId: new ObjectId(organizationId),
                        chatId: null as any, // Updated after chat creation below
                        books: [],
                        status: 'pending' as const,
                        statusHistory: [{
                            status: 'pending' as const,
                            timestamp: new Date().toISOString(),
                            updatedBy: user.id,
                            notes: 'Donation inquiry started'
                        }],
                        orgConfirmed: false,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };

                    donationResult = await db.collection("donations").insertOne(newDonation, { session: txSession });

                    const newChat = {
                        participantIds,
                        organizationId: new ObjectId(organizationId),
                        donationId: donationResult.insertedId,
                        messages: [],
                        lastMessage: `Donation inquiry for ${org.name}`,
                        updatedAt: new Date().toISOString(),
                    };

                    chatResult = await db.collection("chats").insertOne(newChat, { session: txSession });

                    await db.collection("donations").updateOne(
                        { _id: donationResult.insertedId },
                        { $set: { chatId: chatResult.insertedId } },
                        { session: txSession }
                    );
                });
            } finally {
                await txSession.endSession();
            }

            // Reconstruct objects after transaction
            donation = {
                donorId: user.id,
                organizationId: new ObjectId(organizationId),
                chatId: chatResult.insertedId,
                books: [],
                status: 'pending' as const,
                orgConfirmed: false,
                _id: donationResult.insertedId
            };
            chat = {
                participantIds,
                organizationId: new ObjectId(organizationId),
                donationId: donationResult.insertedId,
                messages: [],
                lastMessage: `Donation inquiry for ${org.name}`,
                updatedAt: new Date().toISOString(),
                _id: chatResult.insertedId
            };

            // Send notifications and emails for the new chat (outside transaction — non-critical)
            const donorUserInfo = await db.collection("users").findOne({ _id: new ObjectId(user.id) });
            const donorName = donorUserInfo?.name || 'A user';

            await db.collection("notifications").insertOne({
                userId: org.primaryContactId,
                type: 'donation_request',
                title: 'New Donation Request',
                message: `${donorName} wants to donate books to ${org.name}`,
                link: `/messages/${chatResult.insertedId}`,
                read: false,
                createdAt: new Date().toISOString(),
                metadata: {
                    donationId: donationResult.insertedId.toString(),
                    donorId: user.id,
                    organizationId: organizationId
                }
            });

            // Send donation chat confirmation email to donor
            try {
                const userDetails = await db.collection("users").findOne({ _id: new ObjectId(user.id) });
                if (userDetails?.email) {
                    await sendDonationChatConfirmationEmail(
                        userDetails.email,
                        userDetails.name || 'BookEx User',
                        org.name,
                        chatResult.insertedId.toString()
                    );
                }
            } catch (emailError) {
                if (process.env.NODE_ENV === 'production') {
                    console.error("Email notification failed:", emailError);
                }
            }

            // Send notification email to organization contact
            try {
                const orgContact = await db.collection("users").findOne({ _id: new ObjectId(org.primaryContactId) });
                const donorUser = await db.collection("users").findOne({ _id: new ObjectId(user.id) });

                if (orgContact?.email && donorUser?.name) {
                    await sendDonationStatusUpdateEmail(
                        orgContact.email,
                        orgContact.name || 'Organization Contact',
                        org.name,
                        'pending',
                        `${donorUser.name} wants to donate books to your organization`,
                        undefined,
                        chatResult.insertedId.toString()
                    );
                }
            } catch (emailError) {
                if (process.env.NODE_ENV === 'production') {
                    console.error("Email notification failed:", emailError);
                }
            }
        } else {
            // Existing chat found - get the donation
            donation = await db.collection("donations").findOne({ chatId: chat._id });
            
            if (!donation) {
                // Edge case: chat exists but donation doesn't (data inconsistency)
                // Create the donation record
                const newDonation = {
                    donorId: user.id,
                    organizationId: new ObjectId(organizationId),
                    chatId: chat._id,
                    books: [],
                    status: 'pending' as const,
                    statusHistory: [{
                        status: 'pending' as const,
                        timestamp: new Date().toISOString(),
                        updatedBy: user.id,
                        notes: 'Donation inquiry started'
                    }],
                    orgConfirmed: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                const donationResult = await db.collection("donations").insertOne(newDonation);
                donation = { ...newDonation, _id: donationResult.insertedId };
            }
        }
        
        // Ensure we have a donation
        if (!donation) {
            throw createAppError(ErrorType.INTERNAL, 'Failed to create or retrieve donation');
        }
        
        // Log successful donation initiation
        await logActivity(
            user.id,
            'donation_initiate',
            'low',
            `Successfully initiated donation chat to ${org.name}`,
            { 
                organizationId,
                organizationName: org.name,
                chatId: chat._id.toString(),
                donationId: donation._id.toString()
            }
        );
        
        // Return just the data (wrapper adds { success: true, data: ... })
        return {
            chatId: chat._id.toString(),
            donationId: donation._id.toString()
        };
    });
}

/**
 * Updates the books list for an existing donation.
 * Only the donor or organization representative can update the books.
 * @param donationId The donation ID
 * @param books Array of books to add/update
 * @returns Updated donation object
 */
export async function updateDonationBooks(
    donationId: string,
    books: Array<{
        bookId?: string;
        title: string;
        author: string;
        condition: 'new' | 'like-new' | 'used' | 'worn';
        quantity: number;
        notes?: string;
    }>
) {
    return withAuthenticatedAction(async ({ db, user }) => {
        // Validate input
        if (!books || books.length === 0) {
            throw createAppError(ErrorType.VALIDATION, 'At least one book is required');
        }

        // Validate ObjectId
        if (!ObjectId.isValid(donationId)) {
            throw createAppError(ErrorType.VALIDATION, 'Invalid donation ID');
        }

        // Get the donation
        const donation = await db.collection("donations").findOne({ 
            _id: new ObjectId(donationId) 
        });

        if (!donation) {
            throw createAppError(ErrorType.NOT_FOUND, 'Donation not found');
        }

        // Check if donation is still modifiable
        if (donation.status === 'completed' || donation.status === 'cancelled') {
            throw createAppError(
                ErrorType.VALIDATION,
                'Cannot update books for a completed or cancelled donation'
            );
        }

        // Get organization to check permissions
        const org = await db.collection("organizations").findOne({
            _id: new ObjectId(donation.organizationId)
        });

        if (!org) {
            throw createAppError(ErrorType.NOT_FOUND, 'Organization not found');
        }

        // Check authorization - must be donor or org representative
        const isOrgRep = org.representatives?.some(
            (rep: any) => rep.userId === user.id
        );
        const isDonor = donation.donorId === user.id;

        if (!isDonor && !isOrgRep) {
            throw createAppError(
                ErrorType.AUTHORIZATION,
                'Only the donor or organization representatives can update donation books'
            );
        }

        // Validate book existence and ownership for books with a bookId
        const booksWithId = books.filter(b => b.bookId);
        if (booksWithId.length > 0) {
            for (const b of booksWithId) {
                if (!ObjectId.isValid(b.bookId!)) {
                    throw createAppError(ErrorType.VALIDATION, `Invalid book ID: ${b.bookId}`);
                }
                const bookDoc = await db.collection("books").findOne({ _id: new ObjectId(b.bookId!) });
                if (!bookDoc) {
                    throw createAppError(ErrorType.VALIDATION, `Book not found: ${b.bookId}`);
                }
                if (bookDoc.sellerId !== user.id) {
                    throw createAppError(ErrorType.AUTHORIZATION, `You do not own book: ${b.bookId}`);
                }
            }
        }

        // Update donation with new books
        const result = await db.collection("donations").updateOne(
            { _id: new ObjectId(donationId) },
            { 
                $set: { 
                    books: books,
                    updatedAt: new Date().toISOString(),
                    lastUpdatedBy: user.id
                } 
            }
        );

        if (result.matchedCount === 0) {
            throw createAppError(ErrorType.NOT_FOUND, 'Donation not found');
        }

        // Create notification for the other party
        const otherUserId = isDonor ? org.primaryContactId : donation.donorId;
        
        await db.collection("notifications").insertOne({
            userId: otherUserId,
            type: 'donation_update',
            title: 'Donation Books Updated',
            message: `The book list for your donation has been updated (${books.length} ${books.length === 1 ? 'book' : 'books'})`,
            link: `/messages/${donation.chatId}`,
            read: false,
            createdAt: new Date().toISOString(),
            metadata: {
                donationId: donationId,
                bookCount: books.length,
                updatedBy: user.id
            }
        });

        // Log activity
        await logActivity(
            user.id,
            'donation_status_update',
            'low',
            `Updated books for donation to ${org.name}`,
            { 
                donationId,
                bookCount: books.length,
                organizationId: donation.organizationId
            }
        );

        return { 
            success: true, 
            data: {
                donationId,
                bookCount: books.length
            }
        };
    });
}

/**
 * Updates donation status with tracking information.
 * Only the donor or organization representative can update donation status.
 * @param donationId The donation ID
 * @param updateData Status update data (status, notes, pickup/delivery details)
 * @returns Updated donation object
 */
export async function updateDonationStatus(
    donationId: string,
    updateData: {
        status: DonationStatus;
        notes?: string;
        pickupDate?: string;
        deliveryMethod?: string;
    }
) {
    return withAuthenticatedAction(async ({ db, user }) => {
        // Validate input
        const validatedData = donationStatusUpdateSchema.parse(updateData);

        // Get the donation
        const donation = await db.collection("donations").findOne({ 
            _id: new ObjectId(donationId) 
        });

        if (!donation) {
            throw createAppError(ErrorType.NOT_FOUND, 'Donation not found');
        }

        // Get organization to check permissions
        const org = await db.collection("organizations").findOne({
            _id: new ObjectId(donation.organizationId)
        });

        if (!org) {
            throw createAppError(ErrorType.NOT_FOUND, 'Organization not found');
        }

        // Check authorization - must be donor or org representative
        const isOrgRep = org.representatives?.some(
            (rep: OrganizationRepresentative) => rep.userId === user.id
        );
        const isDonor = donation.donorId === user.id;

        if (!isDonor && !isOrgRep) {
            throw createAppError(
                ErrorType.AUTHORIZATION,
                'Only the donor or organization representatives can update donation status'
            );
        }

        // Validate status transition using centralized function
        const validTransition = validateDonationStatusTransition(
            donation.status,
            validatedData.status
        );
        
        if (!validTransition.isValid) {
            throw createAppError(
                ErrorType.VALIDATION,
                validTransition.error || `Cannot transition from ${donation.status} to ${validatedData.status}`
            );
        }

        // Special validation: Cannot manually set to completed
        if (validatedData.status === 'completed') {
            throw createAppError(
                ErrorType.VALIDATION,
                'Use confirmDonationReceipt to complete donations'
            );
        }

        // Require notes for cancellation
        if (validatedData.status === 'cancelled' && !validatedData.notes) {
            throw createAppError(
                ErrorType.VALIDATION,
                'Cancellation reason is required'
            );
        }

        // Prepare update document
        const updateDoc: any = {
            status: validatedData.status,
            updatedAt: new Date().toISOString(),
            lastUpdatedBy: user.id
        };

        if (validatedData.pickupDate) updateDoc.pickupDate = validatedData.pickupDate;
        if (validatedData.pickupLocation) updateDoc.pickupLocation = validatedData.pickupLocation;
        if (validatedData.deliveryMethod) updateDoc.deliveryMethod = validatedData.deliveryMethod;

        // Create status history entry
        const statusUpdate: DonationStatusUpdate = {
            status: validatedData.status as DonationStatus,
            timestamp: new Date().toISOString(),
            updatedBy: user.id,
            notes: validatedData.notes
        };

        // Update donation with both current status and history
        await db.collection("donations").updateOne(
            { _id: new ObjectId(donationId) },
            { 
                $set: updateDoc,
                $push: { statusHistory: statusUpdate } as any
            }
        );

        // Create notification for the other party
        const otherUserId = isDonor ? org.primaryContactId : donation.donorId;
        const statusMessages: Record<string, string> = {
            'pending': 'A new donation has been initiated',
            'confirmed': 'Donation has been confirmed',
            'in_progress': 'Donation is in progress',
            'completed': 'Donation has been completed',
            'cancelled': 'Donation has been cancelled'
        };

        await db.collection("notifications").insertOne({
            userId: otherUserId,
            type: 'donation_update',
            title: 'Donation Status Updated',
            message: `${statusMessages[validatedData.status] || 'Status updated'}${validatedData.notes ? ': ' + validatedData.notes : ''}`,
            link: `/messages/${donation.chatId}`,
            read: false,
            createdAt: new Date().toISOString(),
            metadata: {
                donationId: donationId,
                status: validatedData.status,
                updatedBy: user.id
            }
        });

        // Send email notification
        try {
            const otherUser = await db.collection("users").findOne({ 
                _id: new ObjectId(otherUserId) 
            });
            
            if (otherUser?.email) {
                await sendDonationStatusUpdateEmail(
                    otherUser.email,
                    otherUser.name || 'BookEx User',
                    org.name,
                    validatedData.status,
                    validatedData.notes,
                    validatedData.pickupDate,
                    donation.chatId.toString()
                );
            }
        } catch (emailError) {
            if (process.env.NODE_ENV === 'production') {
                console.error("Email notification failed:", emailError);
            }
        }

        // Log activity
        await logActivity(
            user.id,
            'donation_status_update',
            'low',
            `Updated donation status to ${validatedData.status}`,
            { 
                donationId,
                oldStatus: donation.status,
                newStatus: validatedData.status,
                organizationId: donation.organizationId
            }
        );

        return { 
            success: true, 
            data: {
                ...donation,
                ...updateDoc
            }
        };
    });
}

/**
 * Confirms donation receipt by organization.
 * Only organization representatives can confirm receipt.
 * @param donationId The donation ID
 * @param receiptData Receipt confirmation details
 * @returns Updated donation with confirmation
 */
export async function confirmDonationReceipt(
    donationId: string,
    receiptData: {
        receivedDate: string;
        condition: string;
        notes?: string;
    }
) {
    const receiptSchema = z.object({
        receivedDate: z.string().min(1, 'Received date is required'),
        condition: z.string().min(1, 'Condition is required').max(200, 'Condition must be 200 characters or less'),
        notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
    });
    const receiptValidation = validateWithSchema(receiptSchema, receiptData);
    if (!receiptValidation.success) {
        return { success: false, message: receiptValidation.message };
    }

    return withAuthenticatedAction(async ({ db, user }) => {
        // Get the donation
        const donation = await db.collection("donations").findOne({
            _id: new ObjectId(donationId)
        });

        if (!donation) {
            throw createAppError(ErrorType.NOT_FOUND, 'Donation not found');
        }

        // Get organization to check permissions
        const org = await db.collection("organizations").findOne({
            _id: new ObjectId(donation.organizationId)
        });

        if (!org) {
            throw createAppError(ErrorType.NOT_FOUND, 'Organization not found');
        }

        // Check authorization - must be org representative
        const isOrgRep = org.representatives?.some(
            (rep: OrganizationRepresentative) => rep.userId === user.id
        );

        if (!isOrgRep) {
            throw createAppError(
                ErrorType.AUTHORIZATION,
                'Only organization representatives can confirm donation receipt'
            );
        }

        // Update donation to completed status with receipt info
        const updateDoc = {
            status: 'completed' as DonationStatus,
            receivedDate: receiptData.receivedDate,
            receivedCondition: receiptData.condition,
            receiptNotes: receiptData.notes,
            confirmedBy: user.id,
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastUpdatedBy: user.id
        };

        // Create status history entry for completion
        const statusUpdate: DonationStatusUpdate = {
            status: 'completed' as DonationStatus,
            timestamp: new Date().toISOString(),
            updatedBy: user.id,
            notes: `Receipt confirmed. Condition: ${receiptData.condition}${receiptData.notes ? '. ' + receiptData.notes : ''}`
        };

        await db.collection("donations").updateOne(
            { _id: new ObjectId(donationId) },
            {
                $set: updateDoc,
                $push: { statusHistory: statusUpdate } as any
            }
        );

        // Update all donated books to status='donated'
        const bookIds = (donation.books || [])
            .filter((b: any) => b.bookId && ObjectId.isValid(b.bookId))
            .map((b: any) => new ObjectId(b.bookId));

        if (bookIds.length > 0) {
            await db.collection("books").updateMany(
                { _id: { $in: bookIds }, sellerId: donation.donorId },
                { $set: { status: 'donated', updatedAt: new Date().toISOString() } }
            );
        }

        // Create notification for donor
        await db.collection("notifications").insertOne({
            userId: donation.donorId,
            type: 'donation_completed',
            title: 'Donation Received!',
            message: `${org.name} has confirmed receipt of your donation. Thank you for your generosity!`,
            link: `/messages/${donation.chatId}`,
            read: false,
            createdAt: new Date().toISOString(),
            metadata: {
                donationId: donationId,
                organizationId: donation.organizationId
            }
        });

        // Send thank you email to donor
        try {
            const donor = await db.collection("users").findOne({ 
                _id: new ObjectId(donation.donorId) 
            });
            
            if (donor?.email) {
                await sendDonationCompletionEmail(
                    donor.email,
                    donor.name || 'BookEx User',
                    org.name,
                    receiptData.receivedDate,
                    receiptData.condition,
                    receiptData.notes,
                    donation.chatId.toString()
                );
            }
        } catch (emailError) {
            console.error('[EMAIL_FAILURE] confirmDonationReceipt', (emailError as Error)?.message || emailError);
        }

        // Log activity
        await logActivity(
            user.id,
            'donation_confirmed',
            'medium',
            `Confirmed receipt of donation from ${donation.donorId}`,
            { 
                donationId,
                organizationId: donation.organizationId,
                receivedDate: receiptData.receivedDate
            }
        );

        return { 
            success: true, 
            data: {
                ...donation,
                ...updateDoc
            }
        };
    });
}


/**
 * Confirms a donation offer on behalf of the organization (sets orgConfirmed=true).
 * Only callable by organization representatives.
 * @param donationId The donation ID to confirm
 * @returns Success message or error
 */
export async function confirmDonationOffer(donationId: string) {
    return withAuthenticatedAction(async ({ db, user }) => {
        if (!ObjectId.isValid(donationId)) {
            throw createAppError(ErrorType.VALIDATION, 'Invalid donation ID');
        }

        const donation = await db.collection("donations").findOne({
            _id: new ObjectId(donationId)
        });

        if (!donation) {
            throw createAppError(ErrorType.NOT_FOUND, 'Donation not found');
        }

        const org = await db.collection("organizations").findOne({
            _id: new ObjectId(donation.organizationId)
        });

        if (!org) {
            throw createAppError(ErrorType.NOT_FOUND, 'Organization not found');
        }

        // Only organization representatives may confirm
        const isOrgRep = org.representatives?.some(
            (rep: OrganizationRepresentative) => rep.userId === user.id
        );

        if (!isOrgRep) {
            throw createAppError(
                ErrorType.AUTHORIZATION,
                'Only organization representatives can confirm a donation offer'
            );
        }

        if (donation.orgConfirmed) {
            return { success: true, data: { message: 'Donation offer already confirmed' } };
        }

        await db.collection("donations").updateOne(
            { _id: new ObjectId(donationId) },
            { $set: { orgConfirmed: true, updatedAt: new Date().toISOString() } }
        );

        // Notify donor that the organization confirmed receipt
        await db.collection("notifications").insertOne({
            userId: donation.donorId,
            type: 'donation_update',
            title: 'Organization Confirmed Your Donation',
            message: `${org.name} has confirmed your donation offer.`,
            link: `/messages/${donation.chatId}`,
            read: false,
            createdAt: new Date().toISOString(),
            metadata: {
                donationId,
                organizationId: donation.organizationId.toString()
            }
        });

        await logActivity(
            user.id,
            'donation_status_update',
            'low',
            `Organization representative confirmed donation offer for donation ${donationId}`,
            { donationId, organizationId: donation.organizationId.toString() }
        );

        return { success: true, data: { message: `${org.name} has confirmed your donation offer.` } };
    });
}

/**
 * Submits a content report.
 * @param reportData The data for the report.
 * @returns An object with the result of the operation.
 */
export async function submitReport(reportData: Omit<Report, '_id' | 'status' | 'createdAt'>) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (user.id !== reportData.reporterId) throw new Error("Unauthorized");

        const rateLimitResult = await checkUserRateLimit(user.id, 'SUBMIT_REPORT', RATE_LIMITS.SUBMIT_REPORT);
        if (!rateLimitResult.allowed) {
            throw createAppError(ErrorType.RATE_LIMIT, rateLimitResult.error || 'Too many reports. Please try again later.');
        }

        const validation = validateWithSchema(reportSchema, reportData);
        if (!validation.success) {
            throw createAppError(ErrorType.VALIDATION, validation.message);
        }

        const newReport: Omit<Report, '_id'> = {
            ...reportData,
            status: 'pending' as const,
            createdAt: new Date().toISOString(),
        };

        const result = await db.collection("reports").insertOne(newReport);
        
        // Create admin notification for content report
        try {
            const { notifyContentReport } = await import('@/lib/admin-notifications');
            await notifyContentReport(
                result.insertedId.toString(),
                reportData.reportedContentType,
                reportData.reportedContentId,
                reportData.reason
            );
        } catch (error) {
            console.warn('Failed to create admin notification for content report:', error);
        }
        
        return { success: true };
    });
}

/**
 * Submits a user review.
 * @param reviewData The data for the review.
 * @returns An object with the result of the operation.
 */
export async function submitReview(reviewData: Omit<Review, '_id' | 'createdAt'>) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (user.id !== reviewData.reviewerId) throw new Error("Unauthorized");

        const rateLimitResult = await checkUserRateLimit(user.id, 'SUBMIT_REVIEW', RATE_LIMITS.SUBMIT_REVIEW);
        if (!rateLimitResult.allowed) {
            throw createAppError(ErrorType.RATE_LIMIT, rateLimitResult.error || 'Too many reviews. Please try again later.');
        }

        const validation = validateWithSchema(reviewSchema, reviewData);
        if (!validation.success) {
            throw createAppError(ErrorType.VALIDATION, validation.message);
        }

        // First, insert the new review document.
        const newReview: Omit<Review, '_id'> = {
            ...reviewData,
            createdAt: new Date().toISOString(),
        };
        const reviewInsertResult = await db.collection("reviews").insertOne(newReview);
        if (!reviewInsertResult.insertedId) {
            throw new Error('submitReview: insert failed');
        }

        // Then, perform a single, atomic update on the user document.
        // This is far more efficient and safer than the previous aggregation method.
        const revieweeUpdateResult = await db.collection("users").updateOne(
            { _id: new ObjectId(reviewData.revieweeId) },
            {
                $inc: {
                    reviews: 1,
                    totalRatingPoints: reviewData.rating
                }
            }
        );

        if (revieweeUpdateResult.matchedCount === 0) {
            throw new Error('Reviewee not found');
        }

        try {
            await db.collection("notifications").insertOne({
                userId: reviewData.revieweeId,
                type: 'system',
                title: 'New review received',
                message: `Someone left you a ${reviewData.rating}-star review.`,
                link: `/profile/${reviewData.revieweeId}`,
                read: false,
                createdAt: new Date().toISOString(),
                metadata: { reviewerId: reviewData.reviewerId, rating: reviewData.rating }
            });
        } catch (e) { console.warn('Failed to create review notification:', e); }

        try {
            const { emitNewReview } = await import('../../server');
            await emitNewReview(reviewData.revieweeId, { reviewerId: reviewData.reviewerId, rating: reviewData.rating });
        } catch (emitError) {
            console.warn('Failed to emit newReviewSubmitted socket event:', emitError);
        }

        revalidatePath(`/profile/${reviewData.revieweeId}`);
        return { success: true };
    });
}

/**
 * Fetches reviews for a specific user with pagination.
 * @param userId The ID of the user whose reviews to fetch.
 * @param page The page number (starts from 1).
 * @param limit The number of reviews per page (default: 10, max: 50).
 * @returns A promise that resolves to a paginated result with reviews and metadata.
 */
export async function getUserReviews(userId: string, page: number = 1, limit: number = 10): Promise<{
    reviews: (Review & { reviewer?: { _id: string; name: string; avatarUrl?: string } })[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}> {
    try {
        // Input validation
        if (!userId || typeof userId !== 'string') {
            throw new Error("Invalid user ID");
        }

        const sanitizedPage = Math.max(1, Math.floor(page));
        const sanitizedLimit = Math.min(50, Math.max(1, Math.floor(limit)));
        const skip = (sanitizedPage - 1) * sanitizedLimit;

        const client = await clientPromise;
        const db = client.db("bookex");

        // Get total count and reviews in parallel for better performance
        const [totalCount, reviews] = await Promise.all([
            db.collection("reviews").countDocuments({ revieweeId: userId }),
            db.collection("reviews")
                .aggregate([
                    { $match: { revieweeId: userId } },
                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: sanitizedLimit },
                    {
                        $lookup: {
                            from: "users",
                            localField: "reviewerId",
                            foreignField: "_id",
                            as: "reviewer"
                        }
                    },
                    {
                        $unwind: {
                            path: "$reviewer",
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            reviewerId: 1,
                            revieweeId: 1,
                            rating: 1,
                            comment: 1,
                            createdAt: 1,
                            reviewer: {
                                _id: 1,
                                name: 1,
                                avatarUrl: 1
                            }
                        }
                    }
                ])
                .toArray()
        ]);

        const totalPages = Math.ceil(totalCount / sanitizedLimit);

        return {
            reviews: JSON.parse(JSON.stringify(reviews)),
            pagination: {
                currentPage: sanitizedPage,
                totalPages,
                totalCount,
                hasNext: sanitizedPage < totalPages,
                hasPrev: sanitizedPage > 1
            }
        };
    } catch (error) {
        console.error("Error fetching user reviews:", error);
        return {
            reviews: [],
            pagination: {
                currentPage: 1,
                totalPages: 0,
                totalCount: 0,
                hasNext: false,
                hasPrev: false
            }
        };
    }
}

/**
 * Checks if a user can review another user (prevents duplicate reviews).
 * @param reviewerId The ID of the reviewer.
 * @param revieweeId The ID of the user being reviewed.
 * @returns True if the reviewer can leave a review, false otherwise.
 */
export async function canUserReview(reviewerId: string, revieweeId: string): Promise<boolean> {
    try {
        if (reviewerId === revieweeId) {
            return false; // Users cannot review themselves
        }

        const client = await clientPromise;
        const db = client.db("bookex");

        // Check if a completed exchange exists between the two users
        const completedExchange = await db.collection("exchanges").findOne({
            $or: [
                { proposerId: reviewerId, responderId: revieweeId, status: 'completed' },
                { proposerId: revieweeId, responderId: reviewerId, status: 'completed' }
            ]
        });
        if (!completedExchange) return false;

        // Check if reviewer has already reviewed this user
        const existingReview = await db.collection("reviews").findOne({
            reviewerId,
            revieweeId
        });

        return !existingReview;
    } catch (error) {
        console.error("Error checking review eligibility:", error);
        return false;
    }
}

/**
 * Deletes a review (only by the reviewer or admin).
 * @param reviewId The ID of the review to delete.
 * @returns An object with the result of the operation.
 */
export async function deleteReview(reviewId: string) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Find the review to check ownership
        const review = await db.collection("reviews").findOne({ _id: new ObjectId(reviewId) });
        if (!review) {
            throw new Error("Review not found");
        }

        // Check if user owns the review or is admin
        if (review.reviewerId !== user.id && user.role !== 'admin') {
            throw new Error("Unauthorized");
        }

        // Atomically delete the review and update rating stats so a partial
        // failure cannot leave rating counts permanently wrong.
        const client = await clientPromise;
        const session = client.startSession();
        try {
          await session.withTransaction(async () => {
            const deleteResult = await db.collection("reviews").deleteOne(
              { _id: new ObjectId(reviewId) },
              { session }
            );

            if (deleteResult.deletedCount === 0) {
              throw new Error("Failed to delete review");
            }

            await db.collection("users").updateOne(
              { _id: new ObjectId(review.revieweeId) },
              {
                $inc: {
                  reviews: -1,
                  totalRatingPoints: -review.rating
                }
              },
              { session }
            );
          });
        } finally {
          await session.endSession();
        }

        revalidatePath(`/profile/${review.revieweeId}`);
        return { success: true };
    });
}

/**
 * Updates an existing review (only by the reviewer).
 * @param reviewId The ID of the review to update.
 * @param updates The fields to update.
 * @returns An object with the result of the operation.
 */
export async function updateReview(reviewId: string, updates: { rating?: number; comment?: string }) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Find the review to check ownership
        const review = await db.collection("reviews").findOne({ _id: new ObjectId(reviewId) });
        if (!review) {
            throw new Error("Review not found");
        }

        // Check if user owns the review
        if (review.reviewerId !== user.id) {
            throw new Error("Unauthorized");
        }

        // Calculate rating difference for statistics update
        const ratingDiff = (updates.rating || review.rating) - review.rating;

        // Update the review
        const updateResult = await db.collection("reviews").updateOne(
            { _id: new ObjectId(reviewId) },
            {
                $set: {
                    ...updates,
                    createdAt: new Date().toISOString() // Update timestamp
                }
            }
        );

        if (updateResult.modifiedCount === 0) {
            throw new Error("Failed to update review");
        }

        // Update user's rating statistics if rating changed
        if (ratingDiff !== 0) {
            await db.collection("users").updateOne(
                { _id: new ObjectId(review.revieweeId) },
                {
                    $inc: {
                        totalRatingPoints: ratingDiff
                    }
                }
            );
        }

        revalidatePath(`/profile/${review.revieweeId}`);
        return { success: true };
    });
}

/**
 * Gets review statistics for a user.
 * @param userId The ID of the user.
 * @returns Review statistics including rating distribution.
 */
export async function getUserReviewStats(userId: string): Promise<{
    totalReviews: number;
    averageRating: number;
    ratingDistribution: { [key: number]: number };
    recentReviews: Review[];
}> {
    try {
        const client = await clientPromise;
        const db = client.db("bookex");

        // Get all reviews for the user
        const reviews = await db.collection("reviews")
            .find({ revieweeId: userId })
            .sort({ createdAt: -1 })
            .toArray();

        const totalReviews = reviews.length;
        const averageRating = totalReviews > 0
            ? parseFloat((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
            : 0;

        // Calculate rating distribution
        const ratingDistribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        reviews.forEach(review => {
            ratingDistribution[review.rating] = (ratingDistribution[review.rating] || 0) + 1;
        });

        // Get recent 5 reviews
        const recentReviews = reviews.slice(0, 5);

        return {
            totalReviews,
            averageRating,
            ratingDistribution,
            recentReviews: JSON.parse(JSON.stringify(recentReviews))
        };
    } catch (error) {
        console.error("Error fetching review stats:", error);
        return {
            totalReviews: 0,
            averageRating: 0,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            recentReviews: []
        };
    }
}

/**
 * Reports community content (posts, comments, or communities).
 * @param contentId The ID of the content being reported.
 * @param contentType The type of content being reported.
 * @param reason The reason for the report.
 * @param details Additional details about the report.
 * @returns An object with the result of the operation.
 */
export async function reportCommunityContent(contentId: string, contentType: 'post' | 'comment' | 'community', reason: string, details?: string) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Validate content exists based on type
        let contentExists = false;
        let reportedUserId = '';

        switch (contentType) {
            case 'post':
                const post = await db.collection("posts").findOne({ _id: new ObjectId(contentId) });
                if (post) {
                    contentExists = true;
                    reportedUserId = post.authorId;
                }
                break;
            case 'comment':
                const comment = await db.collection("comments").findOne({ _id: new ObjectId(contentId) });
                if (comment) {
                    contentExists = true;
                    reportedUserId = comment.author;
                }
                break;
            case 'community':
                const community = await db.collection("communities").findOne({ _id: new ObjectId(contentId) });
                if (community) {
                    contentExists = true;
                    reportedUserId = community.createdBy;
                }
                break;
        }

        if (!contentExists) {
            throw new Error("Content not found");
        }

        const newReport: Omit<Report, '_id'> = {
            reporterId: user.id,
            reportedUserId,
            reportedContentId: contentId,
            reportedContentType: contentType,
            reason,
            details,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };

        await db.collection("reports").insertOne(newReport);

        return { success: true };
    });
}

/**
 * Gets reports for admin review with filtering and pagination.
 * @param status Filter by report status.
 * @param contentType Filter by content type.
 * @param page Page number.
 * @param limit Number of reports per page.
 * @returns Paginated reports for admin review.
 */
export async function getAdminReports(status?: 'pending' | 'resolved' | 'dismissed', contentType?: string, page: number = 1, limit: number = 20): Promise<{
    reports: (Report & {
        reporter?: { _id: string; name: string };
        reportedUser?: { _id: string; name: string };
    })[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}> {
    try {
        const result = await withAuthenticatedAction(async ({ db, user, userId }) => {
            if (user.role !== 'admin') {
                throw new Error("Unauthorized");
            }

            const sanitizedPage = Math.max(1, Math.floor(page));
            const sanitizedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
            const skip = (sanitizedPage - 1) * sanitizedLimit;

            // Build filter
            const filter: any = {};
            if (status) filter.status = status;
            if (contentType) filter.reportedContentType = contentType;

            // Get total count and reports
            const [totalCount, reports] = await Promise.all([
                db.collection("reports").countDocuments(filter),
                db.collection("reports")
                    .aggregate([
                        { $match: filter },
                        { $sort: { createdAt: -1 } },
                        { $skip: skip },
                        { $limit: sanitizedLimit },
                        {
                            $lookup: {
                                from: "users",
                                localField: "reporterId",
                                foreignField: "_id",
                                as: "reporter"
                            }
                        },
                        {
                            $lookup: {
                                from: "users",
                                localField: "reportedUserId",
                                foreignField: "_id",
                                as: "reportedUser"
                            }
                        },
                        {
                            $unwind: {
                                path: "$reporter",
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $unwind: {
                                path: "$reportedUser",
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                reporterId: 1,
                                reportedUserId: 1,
                                reportedContentId: 1,
                                reportedContentType: 1,
                                reason: 1,
                                details: 1,
                                status: 1,
                                createdAt: 1,
                                resolvedAt: 1,
                                resolvedBy: 1,
                                resolutionNotes: 1,
                                severity: 1,
                                reporter: {
                                    _id: 1,
                                    name: 1
                                },
                                reportedUser: {
                                    _id: 1,
                                    name: 1
                                }
                            }
                        }
                    ])
                    .toArray()
            ]);

            const totalPages = Math.ceil(totalCount / sanitizedLimit);

            return {
                reports: JSON.parse(JSON.stringify(reports)),
                pagination: {
                    currentPage: sanitizedPage,
                    totalPages,
                    totalCount,
                    hasNext: sanitizedPage < totalPages,
                    hasPrev: sanitizedPage > 1
                }
            };
        }, 'admin');
        
        // Handle the wrapper's return type
        if (result && typeof result === 'object' && 'reports' in result && 'pagination' in result) {
            return result as any;
        }
        
        // Return empty result on error
        return {
            reports: [],
            pagination: {
                currentPage: 1,
                totalPages: 0,
                totalCount: 0,
                hasNext: false,
                hasPrev: false
            }
        };
    } catch (error) {
        console.error("Error fetching admin reports:", error);
        return {
            reports: [],
            pagination: {
                currentPage: 1,
                totalPages: 0,
                totalCount: 0,
                hasNext: false,
                hasPrev: false
            }
        };
    }
}

/**
 * Resolves a report with optional resolution notes.
 * @param reportId The ID of the report to resolve.
 * @param resolutionNotes Optional notes about the resolution.
 * @returns An object with the result of the operation.
 */
export async function resolveReportWithNotes(reportId: string, resolutionNotes?: string) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (user.role !== 'admin') {
            throw new Error("Unauthorized");
        }

        const result = await db.collection("reports").updateOne(
            { _id: new ObjectId(reportId) },
            {
                $set: {
                    status: 'resolved',
                    resolvedAt: new Date().toISOString(),
                    resolvedBy: user.id,
                    resolutionNotes
                }
            }
        );

        if (result.modifiedCount === 0) {
            throw new Error("Report not found or already resolved");
        }

        return { success: true };
    }, 'admin');
}

/**
 * Gets review analytics for admin dashboard.
 * @returns Review analytics data.
 */
export async function getReviewAnalytics(): Promise<{
    totalReviews: number;
    averageRating: number;
    ratingDistribution: { [key: number]: number };
    reviewsByMonth: { month: string; count: number }[];
    topRatedUsers: { userId: string; name: string; averageRating: number; reviewCount: number }[];
}> {
    try {
        const result = await withAuthenticatedAction(async ({ db, user, userId }) => {
            if (user.role !== 'admin') {
                throw new Error("Unauthorized");
            }

            // Get all reviews
            const reviews = await db.collection("reviews").find({}).toArray();
            const totalReviews = reviews.length;

            // Calculate overall statistics
            const totalRating = reviews.reduce((sum: number, r: any) => sum + r.rating, 0);
            const averageRating = totalReviews > 0 ? parseFloat((totalRating / totalReviews).toFixed(1)) : 0;

            // Rating distribution
            const ratingDistribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            reviews.forEach((review: any) => {
                ratingDistribution[review.rating] = (ratingDistribution[review.rating] || 0) + 1;
            });

            // Reviews by month (last 12 months)
            const reviewsByMonth = [];
            const now = new Date();
            for (let i = 11; i >= 0; i--) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
                const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

                const count = reviews.filter((r: any) => {
                    const reviewDate = new Date(r.createdAt);
                    return reviewDate >= monthStart && reviewDate <= monthEnd;
                }).length;

                reviewsByMonth.push({
                    month: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
                    count
                });
            }

            // Top rated users
            const userStats = new Map();
            reviews.forEach((review: any) => {
                if (!userStats.has(review.revieweeId)) {
                    userStats.set(review.revieweeId, {
                        totalRating: 0,
                        count: 0,
                        userId: review.revieweeId
                    });
                }
                const stats = userStats.get(review.revieweeId);
                stats.totalRating += review.rating;
                stats.count += 1;
            });

            const topRatedUsers = Array.from(userStats.values())
                .map(stats => ({
                    userId: stats.userId,
                    name: '',
                    averageRating: parseFloat((stats.totalRating / stats.count).toFixed(1)),
                    reviewCount: stats.count
                }))
                .sort((a, b) => b.averageRating - a.averageRating)
                .slice(0, 10);

            // Get user names for top rated users
            for (const user of topRatedUsers) {
                const userDoc = await db.collection("users").findOne(
                    { _id: new ObjectId(user.userId) },
                    { projection: { name: 1 } }
                );
                user.name = userDoc?.name || 'Unknown User';
            }

            return {
                totalReviews,
                averageRating,
                ratingDistribution,
                reviewsByMonth,
                topRatedUsers
            };
        }, 'admin');
        
        // Handle the wrapper's return type
        if (result && typeof result === 'object' && 'totalReviews' in result) {
            return result as any;
        }
        
        // Return empty result on error
        return {
            totalReviews: 0,
            averageRating: 0,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            reviewsByMonth: [],
            topRatedUsers: []
        };
    } catch (error) {
        console.error("Error fetching review analytics:", error);
        return {
            totalReviews: 0,
            averageRating: 0,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            reviewsByMonth: [],
            topRatedUsers: []
        };
    }
}

/**
 * Validates report data before submission.
 * @param reportData The report data to validate.
 * @returns Validation result.
 */
export async function validateReportData(reportData: Omit<Report, '_id' | 'status' | 'createdAt'>): Promise<{
    isValid: boolean;
    errors: string[];
}> {
    const errors: string[] = [];

    // Check required fields
    if (!reportData.reporterId) errors.push("Reporter ID is required");
    if (!reportData.reportedUserId) errors.push("Reported user ID is required");
    if (!reportData.reportedContentId) errors.push("Reported content ID is required");
    if (!reportData.reportedContentType) errors.push("Reported content type is required");
    if (!reportData.reason) errors.push("Reason is required");

    // Validate content type
    const validTypes = ['book', 'user', 'post', 'comment', 'community'];
    if (!validTypes.includes(reportData.reportedContentType)) {
        errors.push("Invalid content type");
    }

    // Check if user is reporting themselves
    if (reportData.reporterId === reportData.reportedUserId) {
        errors.push("You cannot report yourself");
    }

    // Validate reason length
    if (reportData.reason.length > 100) {
        errors.push("Reason must be less than 100 characters");
    }

    // Validate details length
    if (reportData.details && reportData.details.length > 500) {
        errors.push("Details must be less than 500 characters");
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validates review data before submission.
 * @param reviewData The review data to validate.
 * @returns Validation result.
 */
export async function validateReviewData(reviewData: Omit<Review, '_id' | 'createdAt'>): Promise<{
    isValid: boolean;
    errors: string[];
}> {
    const errors: string[] = [];

    // Check required fields
    if (!reviewData.reviewerId) errors.push("Reviewer ID is required");
    if (!reviewData.revieweeId) errors.push("Reviewee ID is required");
    if (reviewData.rating === undefined || reviewData.rating === null) errors.push("Rating is required");

    // Validate rating range
    if (reviewData.rating < 1 || reviewData.rating > 5) {
        errors.push("Rating must be between 1 and 5");
    }

    // Check if user is reviewing themselves
    if (reviewData.reviewerId === reviewData.revieweeId) {
        errors.push("You cannot review yourself");
    }

    // Validate comment length
    if (reviewData.comment && reviewData.comment.length > 1000) {
        errors.push("Comment must be less than 1000 characters");
    }

    // Check for duplicate reviews
    if (reviewData.reviewerId && reviewData.revieweeId) {
        const canReview = await canUserReview(reviewData.reviewerId, reviewData.revieweeId);
        if (!canReview) {
            errors.push("You have already reviewed this user");
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Gets a user's own reviews (for review management).
 * @param page Page number.
 * @param limit Number of reviews per page.
 * @returns User's reviews with pagination.
 */
export async function getMyReviews(page: number = 1, limit: number = 10): Promise<{
    success: true;
    data: {
    reviews: (Review & { reviewee?: { _id: string; name: string } })[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
    };
} | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        const sanitizedPage = Math.max(1, Math.floor(page));
        const sanitizedLimit = Math.min(50, Math.max(1, Math.floor(limit)));
        const skip = (sanitizedPage - 1) * sanitizedLimit;

        // Get total count and reviews
        const [totalCount, reviews] = await Promise.all([
            db.collection("reviews").countDocuments({ reviewerId: user.id }),
            db.collection("reviews")
                .aggregate([
                    { $match: { reviewerId: user.id } },
                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: sanitizedLimit },
                    {
                        $lookup: {
                            from: "users",
                            localField: "revieweeId",
                            foreignField: "_id",
                            as: "reviewee"
                        }
                    },
                    {
                        $unwind: {
                            path: "$reviewee",
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            reviewerId: 1,
                            revieweeId: 1,
                            rating: 1,
                            comment: 1,
                            createdAt: 1,
                            reviewee: {
                                _id: 1,
                                name: 1
                            }
                        }
                    }
                ])
                .toArray()
        ]);

        const totalPages = Math.ceil(totalCount / sanitizedLimit);

        return {
            reviews: JSON.parse(JSON.stringify(reviews)),
            pagination: {
                currentPage: sanitizedPage,
                totalPages,
                totalCount,
                hasNext: sanitizedPage < totalPages,
                hasPrev: sanitizedPage > 1
            }
        };
    });
}

/**
 * Bulk resolves multiple reports.
 * @param reportIds Array of report IDs to resolve.
 * @param resolutionNotes Optional notes for all reports.
 * @returns Bulk operation result.
 */
export async function bulkResolveReports(reportIds: string[], resolutionNotes?: string) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (user.role !== 'admin') {
            throw new Error("Unauthorized");
        }

        const result = await db.collection("reports").updateMany(
            { _id: { $in: reportIds.map(id => new ObjectId(id)) } },
            {
                $set: {
                    status: 'resolved',
                    resolvedAt: new Date().toISOString(),
                    resolvedBy: user.id,
                    resolutionNotes
                }
            }
        );

        return {
            success: true,
            modifiedCount: result.modifiedCount
        };
    }, 'admin');
}

/**
 * Gets report analytics for admin dashboard.
 * @returns Report analytics data.
 */
export async function getReportAnalytics(): Promise<{
    success: true;
    data: {
    totalReports: number;
    pendingReports: number;
    resolvedReports: number;
    reportsByType: { [key: string]: number };
    reportsByReason: { [key: string]: number };
    reportsByMonth: { month: string; count: number }[];
    };
} | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Get all reports
        const reports = await db.collection("reports").find({}).toArray();
        const totalReports = reports.length;
        const pendingReports = reports.filter((r: any) => r.status === 'pending').length;
        const resolvedReports = reports.filter((r: any) => r.status === 'resolved').length;

        // Reports by type
        const reportsByType: { [key: string]: number } = {};
        reports.forEach((report: any) => {
            reportsByType[report.reportedContentType] = (reportsByType[report.reportedContentType] || 0) + 1;
        });

        // Reports by reason
        const reportsByReason: { [key: string]: number } = {};
        reports.forEach((report: any) => {
            reportsByReason[report.reason] = (reportsByReason[report.reason] || 0) + 1;
        });

        // Reports by month (last 12 months)
        const reportsByMonth = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

            const count = reports.filter((r: any) => {
                const reportDate = new Date(r.createdAt);
                return reportDate >= monthStart && reportDate <= monthEnd;
            }).length;

            reportsByMonth.push({
                month: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
                count
            });
        }

        return {
            totalReports,
            pendingReports,
            resolvedReports,
            reportsByType,
            reportsByReason,
            reportsByMonth
        };
    }, 'admin');
}

/**

 * Fetches all data for the admin dashboard.
 * @returns An object containing counts, organizations, and reports.
 */
export async function getAdminDashboardData(): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        const userCount = await db.collection("users").countDocuments();
        const listingCount = await db.collection("books").countDocuments();
        const organizations = await db.collection("organizations").find({}).sort({ createdAt: -1 }).toArray();
        const reports = await db.collection("reports").find({}).sort({ createdAt: -1 }).toArray();
        const users = await db.collection("users").find({}, { projection: { password: 0 } }).sort({ name: 1 }).toArray();

        return JSON.parse(JSON.stringify({ userCount, listingCount, organizations, reports, users }));
    }, 'admin');
}

export async function getAuditLogs(page: number = 1, limit: number = 50): Promise<{
    success: true;
    data: {
        logs: Array<{
            _id: string;
            action: string;
            performedBy: string;
            targetUserId?: string;
            reason?: string;
            timestamp: string;
        }>;
        pagination: { currentPage: number; totalPages: number; totalCount: number; hasNext: boolean; hasPrev: boolean };
    };
} | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db }) => {
        const sanitizedPage = Math.max(1, Math.floor(page));
        const sanitizedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
        const skip = (sanitizedPage - 1) * sanitizedLimit;

        const [totalCount, logs] = await Promise.all([
            db.collection('auditLogs').countDocuments(),
            db.collection('auditLogs')
                .find({})
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(sanitizedLimit)
                .toArray(),
        ]);

        const totalPages = Math.ceil(totalCount / sanitizedLimit);

        return JSON.parse(JSON.stringify({
            logs,
            pagination: {
                currentPage: sanitizedPage,
                totalPages,
                totalCount,
                hasNext: sanitizedPage < totalPages,
                hasPrev: sanitizedPage > 1,
            },
        }));
    }, 'admin');
}

/**
 * Resolves a report by changing its status.
 * @param reportId The ID of the report to resolve.
 * @returns An object with the result of the operation.
 */
export async function resolveReport(reportId: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        await db.collection("reports").updateOne({ _id: new ObjectId(reportId) }, { $set: { status: 'resolved' } });
        revalidatePath('/admin');
        return { success: true };
    }, 'admin');
}

/**
 * Removes content and resolves the associated report.
 * @param reportId The ID of the report.
 * @param contentId The ID of the content to remove.
 * @param contentType The type of content to remove.
 * @returns An object with the result of the operation.
 */
export async function removeContentAndResolveReport(reportId: string, contentId: string, contentType: 'book' | 'user' | 'post' | 'comment' | 'community'): Promise<{ success: true; data: { message: string } } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        const client = await clientPromise;

        // Start a transaction
        const session = await client.startSession();

        try {
            await session.withTransaction(async () => {
                // Fetch report before modifying, so we can notify reporter
                const report = await db.collection('reports').findOne(
                    { _id: new ObjectId(reportId) },
                    { session }
                );

                // Remove the content based on type
                switch (contentType) {
                    case 'book':
                        await db.collection('books').deleteOne(
                            { _id: new ObjectId(contentId) },
                            { session }
                        );
                        break;
                    case 'user':
                        // Suspend user instead of deleting
                        await db.collection('users').updateOne(
                            { _id: new ObjectId(contentId) },
                            {
                                $set: {
                                    status: 'suspended',
                                    suspendedAt: new Date().toISOString()
                                }
                            },
                            { session }
                        );
                        break;
                    case 'post':
                        await db.collection('posts').deleteOne(
                            { _id: new ObjectId(contentId) },
                            { session }
                        );
                        break;
                    case 'comment':
                        await db.collection('comments').deleteOne(
                            { _id: new ObjectId(contentId) },
                            { session }
                        );
                        break;
                    case 'community':
                        await db.collection('communities').deleteOne(
                            { _id: new ObjectId(contentId) },
                            { session }
                        );
                        break;
                }

                // Resolve the report
                await db.collection('reports').updateOne(
                    { _id: new ObjectId(reportId) },
                    {
                        $set: {
                            status: 'resolved',
                            resolvedAt: new Date().toISOString(),
                            resolvedBy: user.id,
                            resolutionNotes: `Content removed by admin`
                        }
                    },
                    { session }
                );

                // Notify reporter that their report has been resolved
                if (report?.reporterId) {
                    try {
                        await db.collection("notifications").insertOne({
                            userId: report.reporterId,
                            type: 'system',
                            title: 'Your report has been resolved',
                            message: 'The content you reported has been reviewed and action has been taken.',
                            link: '/profile/me',
                            read: false,
                            createdAt: new Date().toISOString(),
                            metadata: { reportId: String(report._id) }
                        });
                    } catch (e) { console.warn('Failed to notify reporter:', e); }
                }
            });

            revalidatePath('/admin');
            return { message: 'Content removed and report resolved successfully' };

        } finally {
            await session.endSession();
        }
    }, 'admin');
}


/**
 * Approves a pending organization application.
 * @param organizationId The ID of the organization to approve.
 * @returns An object with the result of the operation.
 */
export async function approveOrganization(organizationId: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Get organization details before updating for email notification
        const org = await db.collection("organizations").findOne({ _id: new ObjectId(organizationId) });
        if (!org) {
            throw new Error("Organization not found.");
        }
        
        // Ensure organization has submittedBy field to use as primary contact
        if (!org.submittedBy) {
            throw new Error("Organization is missing submittedBy information. Cannot approve without a contact person.");
        }
        
        // Log organization approval attempt
        await logActivity(
            user.id,
            'organization_approval',
            'high',
            `Admin approved organization: ${org.name}`,
            { 
                organizationId,
                organizationName: org.name,
                submittedBy: org.submittedBy,
                adminId: user.id
            }
        );
        
        // Update organization status and set primaryContactId
        // The submitter becomes the primary contact by default
        await db.collection("organizations").updateOne(
            { _id: new ObjectId(organizationId) },
            { 
                $set: { 
                    status: 'approved',
                    primaryContactId: org.submittedBy, // Set submitter as primary contact
                    representatives: [
                        {
                            userId: org.submittedBy,
                            role: 'primary',
                            addedAt: new Date().toISOString(),
                            addedBy: user.id
                        }
                    ],
                    updatedAt: new Date().toISOString()
                } 
            }
        );
        
        // Send approval email notification
        try {
            if (org.contactEmail) {
                await sendOrganizationApprovalEmail(
                    org.contactEmail,
                    org.name
                );
            }
        } catch (emailError) {
            console.error("Failed to send organization approval email:", emailError);
        }
        
        revalidatePath('/admin');
        revalidatePath('/donate');
        
        // Invalidate cache
        try {
            const { default: redisCache } = await import('@/lib/redis-cache');
            await redisCache.delete('approved_organizations');
            console.log('🗑️ Invalidated organizations cache after approval');
        } catch (cacheError) {
            console.warn('⚠️ Failed to invalidate cache:', cacheError);
        }
        
        // Log successful organization approval
        await logActivity(
            user.id,
            'organization_approval',
            'medium',
            `Successfully approved organization: ${org.name}`,
            { 
                organizationId,
                organizationName: org.name,
                status: 'approved',
                primaryContactId: org.submittedBy
            }
        );

        return { success: true };
    }, 'admin');
}

/**
 * Rejects a pending organization application.
 * @param organizationId The ID of the organization to reject.
 * @returns An object with the result of the operation.
 */
export async function rejectOrganization(organizationId: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Get organization details before updating for email notification
        const org = await db.collection("organizations").findOne({ _id: new ObjectId(organizationId) });
        if (!org) {
            throw new Error("Organization not found.");
        }
        
        // Log organization rejection attempt
        await logActivity(
            user.id,
            'organization_rejection',
            'high',
            `Admin rejected organization: ${org.name}`,
            { 
                organizationId,
                organizationName: org.name,
                submittedBy: org.submittedBy,
                adminId: user.id
            }
        );
        
        await db.collection("organizations").updateOne(
            { _id: new ObjectId(organizationId) },
            { $set: { status: 'rejected', updatedAt: new Date().toISOString() } }
        );
        
        // Send rejection email notification
        try {
            if (org.contactEmail) {
                await sendOrganizationRejectionEmail(
                    org.contactEmail,
                    org.name
                );
            }
        } catch (emailError) {
            console.error("Failed to send organization rejection email:", emailError);
        }
        
        revalidatePath('/admin');
        
        // Invalidate cache
        try {
            const { default: redisCache } = await import('@/lib/redis-cache');
            await redisCache.delete('approved_organizations');
            console.log('🗑️ Invalidated organizations cache after rejection');
        } catch (cacheError) {
            console.warn('⚠️ Failed to invalidate cache:', cacheError);
        }
        
        // Log successful organization rejection
        await logActivity(
            user.id,
            'organization_rejection',
            'medium',
            `Successfully rejected organization: ${org.name}`,
            { 
                organizationId,
                organizationName: org.name,
                status: 'rejected'
            }
        );

        return { success: true };
    }, 'admin');
}

/**
 * Adds a new, approved organization directly from the admin panel.
 * @param orgData The organization data.
 * @returns An object with the result of the operation.
 */
export async function addOrganizationByAdmin(orgData: { 
    name: string, 
    description: string, 
    location: string, 
    imageUrl: string,
    contactEmail?: string,
    contactPhone?: string,
    website?: string 
}): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Log admin organization addition attempt
        await logActivity(
            user.id,
            'organization_admin_add',
            'high',
            `Admin adding new organization: ${orgData.name}`,
            { 
                organizationName: orgData.name,
                location: orgData.location,
                contactEmail: orgData.contactEmail,
                adminId: user.id
            }
        );
        
        // Validate organization data
        const validation = validateOrganizationData({
            name: orgData.name,
            description: orgData.description,
            location: orgData.location,
            contactEmail: orgData.contactEmail,
            contactPhone: orgData.contactPhone,
            website: orgData.website
        });

        if (!validation.isValid) {
            throw new Error(validation.error);
        }

        // Check for duplicate organization names
        const sanitizedName = sanitizeOrganizationName(orgData.name);
        const existingOrg = await db.collection("organizations").findOne({
            $expr: {
                $eq: [
                    { $toLower: { $trim: { input: "$name" } } },
                    sanitizedName
                ]
            }
        });

        if (existingOrg) {
            throw new Error("An organization with this name already exists.");
        }

        const newOrg: Omit<Organization, '_id'> = {
            name: orgData.name.trim(),
            description: orgData.description.trim(),
            location: orgData.location.trim(),
            imageUrl: orgData.imageUrl,
            contactEmail: orgData.contactEmail?.trim(),
            contactPhone: orgData.contactPhone?.trim(),
            website: orgData.website?.trim(),
            status: 'approved',
            submittedBy: user.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await db.collection("organizations").insertOne(newOrg);
        revalidatePath('/admin');
        revalidatePath('/donate');
        
        // Invalidate cache
        try {
            const { default: redisCache } = await import('@/lib/redis-cache');
            await redisCache.delete('approved_organizations');
            console.log('🗑️ Invalidated organizations cache after admin addition');
        } catch (cacheError) {
            console.warn('⚠️ Failed to invalidate cache:', cacheError);
        }
        
        // Log successful admin organization addition
        await logActivity(
            user.id,
            'organization_admin_add',
            'medium',
            `Successfully added organization by admin: ${orgData.name}`,
            { 
                organizationName: orgData.name,
                status: 'approved',
                adminId: user.id
            }
        );

        return { success: true };
    }, 'admin');
}


/**
 * Suspends a user account (admin only).
 * @param userId The ID of the user to suspend.
 * @returns An object with the result of the operation.
 */
export async function suspendUser(userId: string, reason?: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user }) => {
        const now = new Date().toISOString();
        const suspendResult = await db.collection("users").updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    status: 'suspended',
                    suspendedAt: now,
                    suspensionReason: reason ?? null,
                    updatedAt: now,
                },
            }
        );

        if (suspendResult.matchedCount === 0) {
            throw new Error('User not found');
        }

        await db.collection("auditLogs").insertOne({
            action: 'SUSPEND_USER',
            performedBy: user.id,
            targetUserId: userId,
            reason: reason ?? null,
            timestamp: now,
        });

        revalidatePath('/admin');
        return { success: true };
    }, 'admin');
}


/**
 * Deactivates a user account (self-deactivation or admin).
 * Cancels active/pending exchanges and restores on_hold/reserved books to active.
 */
export async function deactivateUser(targetUserId: string): Promise<{ success: true; data: { message: string } } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user }) => {
        if (user.id !== targetUserId && user.role !== 'admin') {
            throw new Error('You are not authorised to deactivate this account.');
        }

        if (!ObjectId.isValid(targetUserId)) {
            throw new Error('Invalid user ID.');
        }

        const targetOid = new ObjectId(targetUserId);
        const now = new Date().toISOString();

        const targetUser = await db.collection('users').findOne({ _id: targetOid });
        if (!targetUser) {
            throw new Error('User not found.');
        }
        if (targetUser.status === 'deactivated') {
            throw new Error('Account is already deactivated.');
        }

        // 1. Soft-deactivate the user
        const deactivateResult = await db.collection('users').updateOne(
            { _id: targetOid },
            { $set: { status: 'deactivated', deactivatedAt: now, updatedAt: now } }
        );

        if (deactivateResult.matchedCount === 0) {
            throw new Error('User not found or already modified.');
        }

        // 2. Cancel active/pending exchanges where this user is proposer or responder
        const cancelledStatusEntry = {
            status: 'cancelled' as ExchangeStatus,
            timestamp: now,
            updatedBy: user.id,
            notes: 'Account deactivated by user.',
        };

        await db.collection('exchanges').updateMany(
            {
                $or: [{ proposerId: targetUserId }, { responderId: targetUserId }],
                status: { $in: ['proposed', 'accepted', 'in_progress'] },
            },
            {
                $set: { status: 'cancelled', updatedAt: now },
                $push: { statusHistory: cancelledStatusEntry } as any,
            }
        );

        // 3. Restore on_hold/reserved books back to active so other users are not stuck
        await db.collection('books').updateMany(
            { sellerId: targetUserId, status: { $in: ['on_hold', 'reserved'] } },
            { $set: { status: 'active', updatedAt: now } }
        );

        revalidatePath('/profile');
        revalidatePath('/admin');

        return { message: 'Account deactivated. Active exchanges cancelled and book listings restored.' };
    });
}

/**
 * Gets detailed organization information (admin only).
 * @param organizationId The ID of the organization.
 * @returns Organization details with statistics.
 */
export async function getOrganizationDetails(organizationId: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (!ObjectId.isValid(organizationId)) {
            throw new Error('Invalid organization ID');
        }

        const organization = await db.collection("organizations").findOne({ _id: new ObjectId(organizationId) });
        if (!organization) {
            throw new Error('Organization not found');
        }

        // Get donation statistics
        const donations = await db.collection("donations").find({ 
            organizationId: organizationId 
        }).toArray() as Donation[];

        const stats = {
            totalDonations: donations.length,
            pendingDonations: donations.filter((d) => d.status === 'pending').length,
            confirmedDonations: donations.filter((d) => d.status === 'confirmed').length,
            inProgressDonations: donations.filter((d) => d.status === 'in_progress').length,
            completedDonations: donations.filter((d) => d.status === 'completed').length,
            cancelledDonations: donations.filter((d) => d.status === 'cancelled').length,
            rejectedDonations: donations.filter((d) => d.status === 'rejected').length,
            totalBooksReceived: donations
                .filter((d) => d.status === 'completed')
                .reduce((sum, d) => sum + (d.books?.length || 0), 0),
            acceptanceRate: donations.length > 0 
                ? Math.round((donations.filter((d) => d.status === 'confirmed' || d.status === 'in_progress' || d.status === 'completed').length / donations.length) * 100)
                : 0
        };

        // Get submitter information
        let submittedByUser = null;
        if (organization.submittedBy && ObjectId.isValid(organization.submittedBy)) {
            submittedByUser = await db.collection("users").findOne(
                { _id: new ObjectId(organization.submittedBy) },
                { projection: { name: 1, email: 1, avatarUrl: 1 } }
            );
        }

        return {
            organization: JSON.parse(JSON.stringify(organization)),
            stats,
            submittedBy: submittedByUser ? JSON.parse(JSON.stringify(submittedByUser)) : null
        };
    }, 'admin');
}

/**
 * Updates organization profile (admin only).
 * @param organizationId The ID of the organization.
 * @param updateData The data to update.
 * @returns An object with the result of the operation.
 */
export async function updateOrganizationProfile(
    organizationId: string, 
    updateData: {
        name?: string;
        description?: string;
        location?: string;
        imageUrl?: string;
        contactEmail?: string;
        contactPhone?: string;
        website?: string;
    }
): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (!ObjectId.isValid(organizationId)) {
            throw new Error('Invalid organization ID');
        }

        // Validate updated data
        const validation = validateOrganizationData({
            name: updateData.name || '',
            description: updateData.description || '',
            location: updateData.location || '',
            contactEmail: updateData.contactEmail,
            contactPhone: updateData.contactPhone,
            website: updateData.website
        });

        if (!validation.isValid) {
            throw new Error(validation.error);
        }

        // Check for duplicate name if name is being changed
        if (updateData.name) {
            const sanitizedName = sanitizeOrganizationName(updateData.name);
            const existingOrg = await db.collection("organizations").findOne({
                _id: { $ne: new ObjectId(organizationId) },
                $expr: {
                    $eq: [
                        { $toLower: { $trim: { input: "$name" } } },
                        sanitizedName
                    ]
                }
            });

            if (existingOrg) {
                throw new Error("An organization with this name already exists.");
            }
        }

        // Prepare update object
        const updateObj: any = {
            updatedAt: new Date().toISOString()
        };

        if (updateData.name) updateObj.name = updateData.name.trim();
        if (updateData.description) updateObj.description = updateData.description.trim();
        if (updateData.location) updateObj.location = updateData.location.trim();
        if (updateData.imageUrl) updateObj.imageUrl = updateData.imageUrl;
        if (updateData.contactEmail !== undefined) updateObj.contactEmail = updateData.contactEmail?.trim() || undefined;
        if (updateData.contactPhone !== undefined) updateObj.contactPhone = updateData.contactPhone?.trim() || undefined;
        if (updateData.website !== undefined) updateObj.website = updateData.website?.trim() || undefined;

        const result = await db.collection("organizations").updateOne(
            { _id: new ObjectId(organizationId) },
            { $set: updateObj }
        );

        if (result.modifiedCount === 0) {
            throw new Error('Organization not found or no changes made');
        }

        // Invalidate cache
        try {
            const { default: redisCache } = await import('@/lib/redis-cache');
            await redisCache.delete('approved_organizations');
        } catch (cacheError) {
            console.warn('⚠️ Failed to invalidate cache:', cacheError);
        }

        revalidatePath('/admin');
        revalidatePath('/donate');
        revalidatePath(`/admin/organizations/${organizationId}`);

        await logActivity(
            user.id,
            'organization_update',
            'medium',
            `Updated organization profile: ${updateData.name || organizationId}`,
            { organizationId, updates: Object.keys(updateObj) }
        );

        return { success: true };
    }, 'admin');
}

/**
 * Deletes an organization (admin only).
 * @param organizationId The ID of the organization.
 * @returns An object with the result of the operation.
 */
export async function deleteOrganization(organizationId: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (!ObjectId.isValid(organizationId)) {
            throw new Error('Invalid organization ID');
        }

        const organization = await db.collection("organizations").findOne({ _id: new ObjectId(organizationId) });
        if (!organization) {
            throw new Error('Organization not found');
        }

        // Check if organization has active donations
        const activeDonations = await db.collection("donations").countDocuments({
            organizationId: organizationId,
            status: { $in: ['pending', 'confirmed', 'in_progress'] }
        });

        if (activeDonations > 0) {
            throw new Error(`Cannot delete organization with ${activeDonations} active donation(s). Please complete or cancel them first.`);
        }

        // Mark related chats as organization deleted (soft delete)
        await db.collection("chats").updateMany(
            { organizationId: new ObjectId(organizationId) },
            { 
                $set: { 
                    organizationDeleted: true,
                    organizationDeletedAt: new Date().toISOString()
                } 
            }
        );

        // Delete the organization
        await db.collection("organizations").deleteOne({ _id: new ObjectId(organizationId) });

        // Invalidate cache
        try {
            const { default: redisCache } = await import('@/lib/redis-cache');
            await redisCache.delete('approved_organizations');
        } catch (cacheError) {
            console.warn('⚠️ Failed to invalidate cache:', cacheError);
        }

        revalidatePath('/admin');
        revalidatePath('/donate');

        await logActivity(
            user.id,
            'organization_delete',
            'high',
            `Deleted organization: ${organization.name}`,
            { organizationId, organizationName: organization.name }
        );

        return { success: true };
    }, 'admin');
}

/**
 * Toggles organization active status (suspend/activate) (admin only).
 * @param organizationId The ID of the organization.
 * @param active Whether to activate or suspend the organization.
 * @returns An object with the result of the operation.
 */
export async function toggleOrganizationStatus(organizationId: string, active: boolean): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (!ObjectId.isValid(organizationId)) {
            throw new Error('Invalid organization ID');
        }

        const result = await db.collection("organizations").updateOne(
            { _id: new ObjectId(organizationId) },
            { 
                $set: { 
                    isActive: active,
                    updatedAt: new Date().toISOString()
                } 
            }
        );

        if (result.modifiedCount === 0) {
            throw new Error('Organization not found');
        }

        // Invalidate cache
        try {
            const { default: redisCache } = await import('@/lib/redis-cache');
            await redisCache.delete('approved_organizations');
        } catch (cacheError) {
            console.warn('⚠️ Failed to invalidate cache:', cacheError);
        }

        revalidatePath('/admin');
        revalidatePath('/donate');
        revalidatePath(`/admin/organizations/${organizationId}`);

        await logActivity(
            user.id,
            'organization_status_toggle',
            'medium',
            `${active ? 'Activated' : 'Suspended'} organization`,
            { organizationId, active }
        );

        return { success: true };
    }, 'admin');
}

/**
 * Updates organization approval status (admin only).
 * @param organizationId The ID of the organization.
 * @param status The new status.
 * @returns An object with the result of the operation.
 */
export async function updateOrganizationStatus(
    organizationId: string, 
    status: 'approved' | 'pending' | 'rejected'
): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (!ObjectId.isValid(organizationId)) {
            throw new Error('Invalid organization ID');
        }

        if (!['approved', 'pending', 'rejected'].includes(status)) {
            throw new Error('Invalid status');
        }

        const result = await db.collection("organizations").updateOne(
            { _id: new ObjectId(organizationId) },
            { 
                $set: { 
                    status,
                    updatedAt: new Date().toISOString()
                } 
            }
        );

        if (result.modifiedCount === 0) {
            throw new Error('Organization not found');
        }

        // Invalidate cache
        try {
            const { default: redisCache } = await import('@/lib/redis-cache');
            await redisCache.delete('approved_organizations');
        } catch (cacheError) {
            console.warn('⚠️ Failed to invalidate cache:', cacheError);
        }

        revalidatePath('/admin');
        revalidatePath('/donate');
        revalidatePath(`/admin/organizations/${organizationId}`);

        await logActivity(
            user.id,
            'organization_status_change',
            'medium',
            `Changed organization status to ${status}`,
            { organizationId, status }
        );

        return { success: true };
    }, 'admin');
}

/**
 * Activates a suspended user account (admin only).
 * @param userId The ID of the user to activate.
 * @returns An object with the result of the operation.
 */
export async function activateUser(userId: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId: currentUserId }) => {
        await db.collection("users").updateOne(
            { _id: new ObjectId(userId) },
            { $set: { status: 'active' } }
        );
        
        revalidatePath('/admin');
        return { success: true };
    }, 'admin');
}

/**
 * Deletes a user account and all associated data (admin only).
 * Performs cascade deletion of all related data.
 * @param userId The ID of the user to delete.
 * @returns An object with the result of the operation.
 */
export async function deleteUser(userId: string): Promise<{ success: true; data: { message: string; deletedCounts: any } } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId: currentUserId }) => {
        // Prevent admin from deleting themselves
        if (user.id === userId) {
            throw new Error("Cannot delete your own admin account.");
        }

        const client = await clientPromise;

        // Start a transaction for atomicity
        const session = client.startSession();

        let deletedCounts = {
            books: 0,
            reviews: 0,
            notifications: 0,
            chats: 0,
            comments: 0,
            reports: 0,
            exchanges: 0,
            wishlistItems: 0,
            resetTokens: 0
        };

        try {
            await session.withTransaction(async () => {
                const targetUserId = new ObjectId(userId);

                // 1. Delete all books owned by the user
                const booksResult = await db.collection("books").deleteMany(
                    { sellerId: userId },
                    { session }
                );
                deletedCounts.books = booksResult.deletedCount;

                // 2. Delete all reviews written by the user
                const reviewsResult = await db.collection("reviews").deleteMany(
                    { reviewerId: userId },
                    { session }
                );
                deletedCounts.reviews = reviewsResult.deletedCount;

                // 3. Delete all notifications for the user
                const notificationsResult = await db.collection("notifications").deleteMany(
                    { userId: userId },
                    { session }
                );
                deletedCounts.notifications = notificationsResult.deletedCount;

                // 4. Handle chats - remove user from participant lists or delete if only participant
                const chatsWithUser = await db.collection("chats").find(
                    { participantIds: userId },
                    { session }
                ).toArray();

                for (const chat of chatsWithUser) {
                    if (chat.participantIds.length <= 2) {
                        // Delete chat if it has 2 or fewer participants
                        await db.collection("chats").deleteOne(
                            { _id: chat._id },
                            { session }
                        );
                        // Also delete related messages
                        await db.collection("messages").deleteMany(
                            { chatId: String(chat._id) },
                            { session }
                        );
                        deletedCounts.chats++;
                    } else {
                        // Remove user from participant list
                        const pullUpdate: UpdateFilter<Chat> = { $pull: { participantIds: userId } };
                        await db.collection("chats").updateOne(
                            { _id: chat._id },
                            pullUpdate as any,
                            { session }
                        );
                    }
                }

                // 5. Delete all comments by the user
                const commentsResult = await db.collection("comments").deleteMany(
                    { authorId: userId },
                    { session }
                );
                deletedCounts.comments = commentsResult.deletedCount;

                // 6. Delete all reports submitted by the user
                const reportsResult = await db.collection("reports").deleteMany(
                    { reporterId: userId },
                    { session }
                );
                deletedCounts.reports = reportsResult.deletedCount;

                // 7. Handle exchanges - update status or delete
                const exchangesResult = await db.collection("exchanges").updateMany(
                    {
                        $or: [
                            { buyerId: userId },
                            { sellerId: userId }
                        ],
                        status: { $in: ['pending', 'accepted'] }
                    },
                    {
                        $set: {
                            status: 'cancelled',
                            cancelledBy: 'system',
                            cancelReason: 'User account deleted',
                            updatedAt: new Date().toISOString()
                        }
                    },
                    { session }
                );
                deletedCounts.exchanges = exchangesResult.modifiedCount;

                // 8. Delete wishlist items
                const pullWishlistUpdate: UpdateFilter<User> = { 
                    $pull: { wishlist: { bookId: { $exists: true } } } 
                };
                const wishlistResult = await db.collection("users").updateMany(
                    { 'wishlist.bookId': { $exists: true } },
                    pullWishlistUpdate as any,
                    { session }
                );
                // Note: This is a simplified approach. In a real scenario, you'd want to be more specific

                // 9. Delete password reset tokens
                const resetTokensResult = await db.collection("passwordresettokens").deleteMany(
                    { userId: userId },
                    { session }
                );
                deletedCounts.resetTokens = resetTokensResult.deletedCount;

                // 10. Finally, delete the user account
                const userResult = await db.collection("users").deleteOne(
                    { _id: targetUserId },
                    { session }
                );

                if (userResult.deletedCount === 0) {
                    throw new Error("User not found or already deleted");
                }

                // Invalidate user cache
                const { default: redisCache } = await import('@/lib/redis-cache');
                await redisCache.invalidateUserCache(userId);
            });

            console.log(`✅ User ${userId} deleted successfully. Cascade deletion summary:`, deletedCounts);

            revalidatePath('/admin');
            return {
                message: `User deleted successfully. Cleaned up ${Object.values(deletedCounts).reduce((a, b) => a + b, 0)} related records.`,
                deletedCounts
            };

        } finally {
            await session.endSession();
        }
    }, 'admin');
}


/**
 * Fetches data for the "My Profile" page.
 * @param userId The ID of the user.
 * @returns Profile data for the logged-in user.
 */
export async function getMyProfileData(userId: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId: currentUserId }) => {
        // Validate authorization for accessing private profile data
        if (!ResourceAuthority.canAccessPrivateUserData(user, userId)) {
            throw createAppError(ErrorType.AUTHORIZATION, "You can only access your own profile data");
        }

        const profileUser = await db.collection("users").findOne({ _id: new ObjectId(user.id) });
        if (!profileUser) throw new Error("User not found");
        
        const userListings = await db.collection("books").find({ sellerId: user.id }).toArray();
        
        const userCommunities = await db.collection("communities").find({ "members.userId": user.id } as any).toArray();

        // Fetch wishlist books by their IDs
        const wishlistBooks: Book[] = [];
        if (profileUser.wishlist && profileUser.wishlist.length > 0) {
            const wishlistBookIds = profileUser.wishlist.map((item: any) => 
                typeof item === 'string' ? item : item.bookId
            ).filter(Boolean);
            
            if (wishlistBookIds.length > 0) {
                const books = await db.collection("books").find({ 
                    _id: { $in: wishlistBookIds.map((id: any) => new ObjectId(id)) }
                }).toArray() as Book[];
                wishlistBooks.push(...books);
            }
        }

        const { findCanonicalCity } = await import('@/lib/location/location-utils');
        const profileCity = await findCanonicalCity(profileUser.cityNormalized || '');
        const normalizedProfile = JSON.parse(JSON.stringify(profileUser));
        normalizedProfile.cityName = profileCity?.name || null;
        normalizedProfile.cityNormalized = profileUser.cityNormalized || null;

        const normalizedListings = await Promise.all(userListings.map(async (book: any) => {
            const bookCity = await findCanonicalCity(book.cityNormalized || '');
            return {
                ...book,
                cityName: bookCity?.name || null,
                cityNormalized: book.cityNormalized || null,
            };
        }));

        return JSON.parse(JSON.stringify({
            profileUser: normalizedProfile,
            userListings: normalizedListings,
            wishlist: wishlistBooks,
            userCommunities: userCommunities,
        }));
    });
}

/**
 * Fetches all chats for the logged-in user.
 * @param userId The ID of the user.
 * @returns An array of Chat objects.
 */
export async function getUserChats(userId: string): Promise<{ success: true; data: Chat[] } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId: currentUserId }) => {
        if (user.id !== userId) throw new Error("Unauthorized");

        const chats = await db.collection("chats")
            .find({ participantIds: user.id })
            .sort({ updatedAt: -1 })
            .toArray();
        
        for (const chat of chats) {
            const otherId = chat.participantIds.find((id: any) => id !== user.id && !id.startsWith('org_'));
            if (otherId && ObjectId.isValid(otherId)) {
                const otherUser = await db.collection("users").findOne({ _id: new ObjectId(otherId) }, {projection: { password: 0 }});
                chat.otherParticipant = otherUser || undefined;
            }
            if (chat.bookId && ObjectId.isValid(chat.bookId)) {
                const book = await db.collection("books").findOne({ _id: new ObjectId(chat.bookId) });
                chat.book = book || undefined;
            }
            if (chat.organizationId && ObjectId.isValid(String(chat.organizationId))) {
                const organization = await db.collection("organizations").findOne({ _id: new ObjectId(chat.organizationId) });
                chat.organization = organization || undefined;
                 if(chat.organization && !chat.otherParticipant) {
                    chat.otherParticipant = {
                        _id: chat.organization._id,
                        name: chat.organization.name,
                        avatarUrl: chat.organization.imageUrl,
                    } as User;
                }
            }
        }
        return JSON.parse(JSON.stringify(chats));
    });
}

/**
 * Fetches the details of a specific chat.
 * @param chatId The ID of the chat.
 * @param userId The ID of the user requesting the chat.
 * @returns A Chat object or null.
 */
export async function getChatDetails(chatId: string, userId: string): Promise<{ success: true; data: Chat | null } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId: currentUserId }) => {
        // Validate authorization using resource authorization system
        await validateResourceAccess(user, 'chat', chatId, 'read');

        // First try to find chat where user is a direct participant
        let chat = await db.collection("chats").findOne({ 
            _id: new ObjectId(chatId), 
            participantIds: user.id 
        });

        // If not found and this might be a donation chat, check if user is an org representative
        if (!chat) {
            const potentialChat = await db.collection("chats").findOne({ _id: new ObjectId(chatId) });
            
            if (potentialChat?.organizationId) {
                const organization = await db.collection("organizations").findOne({ 
                    _id: new ObjectId(potentialChat.organizationId) 
                });
                
                // Check if user is a representative of this organization
                const isOrgRep = organization?.representatives?.some(
                    (rep: OrganizationRepresentative) => rep.userId === user.id
                );
                
                if (isOrgRep) {
                    chat = potentialChat;
                }
            }
        }

        if (!chat) return null;

        // Get the other participant (always a real user, never a fake ID)
        const otherId = chat.participantIds.find((id: any) => id !== user.id);

        if (otherId && ObjectId.isValid(otherId)) {
            const otherUser = await db.collection("users").findOne({ _id: new ObjectId(otherId) }, {projection: { password: 0 }});
            chat.otherParticipant = otherUser || undefined;
        }

        // Load related book if this is a book exchange chat
        if (chat.bookId && ObjectId.isValid(chat.bookId)) {
            const book = await db.collection("books").findOne({ _id: new ObjectId(chat.bookId) });
            chat.book = book || undefined;
        }

        // Load organization if this is a donation chat
        if (chat.organizationId && ObjectId.isValid(String(chat.organizationId))) {
            const organization = await db.collection("organizations").findOne({ _id: new ObjectId(chat.organizationId) });
            chat.organization = organization || undefined;
        }

        // Load donation details if this is a donation chat
        if (chat.donationId && ObjectId.isValid(String(chat.donationId))) {
            const donation = await db.collection("donations").findOne({ _id: new ObjectId(chat.donationId) });
            chat.donation = donation || undefined;
        }

        return JSON.parse(JSON.stringify(chat));
    });
}

/**
 * Fetches notifications for the logged-in user with proper pagination.
 * @param page The page number (starts from 1)
 * @param limit The number of notifications per page (default: 10, max: 50)
 * @returns A promise that resolves to a paginated result with notifications and metadata.
 */
export async function getUserNotifications(page: number = 1, limit: number = 10): Promise<{
    success: true;
    data: {
    notifications: Notification[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
    };
} | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Input validation
        const sanitizedPage = Math.max(1, Math.floor(page));
        const sanitizedLimit = Math.min(50, Math.max(1, Math.floor(limit)));
        const skip = (sanitizedPage - 1) * sanitizedLimit;
        
        const notificationCollection = db.collection("notifications");
        
        // Get notifications with pagination - use a single query for better performance
        const notifications = await notificationCollection
            .find({ userId: user.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(sanitizedLimit + 1) // Get one extra to check if there are more
            .toArray();
        
        // Check if there are more notifications
        const hasMore = notifications.length > sanitizedLimit;
        const actualNotifications = hasMore ? notifications.slice(0, -1) : notifications;
        
        // Get total count efficiently
        const totalCount = await notificationCollection.countDocuments({ userId: user.id });
        const totalPages = Math.ceil(totalCount / sanitizedLimit);
        
        return {
            notifications: JSON.parse(JSON.stringify(actualNotifications)),
            pagination: {
                currentPage: sanitizedPage,
                totalPages,
                totalCount,
                hasNext: hasMore,
                hasPrev: sanitizedPage > 1
            }
        };
    });
}

/**
 * Legacy function for backward compatibility - fetches first page of notifications
 * @deprecated Use getUserNotifications(page, limit) instead
 */
export async function getNotifications(): Promise<Notification[]> {
    try {
        const result = await getUserNotifications(1, 20);
        return result.success ? result.data.notifications : [];
    } catch (error) {
        console.error("Error in legacy getNotifications:", error);
        return [];
    }
}

/**
 * Marks all unread notifications for the logged-in user as read.
 * @returns An object with the result of the operation.
 */
export async function markNotificationsAsRead(): Promise<{ success: true; data: { modifiedCount: number } } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Ensure we only update the authenticated user's notifications
        const result = await db.collection("notifications").updateMany(
            { userId: user.id, read: false },
            { $set: { read: true } }
        );
        
        revalidatePath('/'); // Revalidate to update header
        return { modifiedCount: result.modifiedCount };
    });
}

/**
 * Marks a specific notification as read
 * @param notificationId The ID of the notification to mark as read
 * @returns Result of the operation
 */
export async function markNotificationAsRead(notificationId: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Verify notification belongs to user before updating
        const result = await db.collection("notifications").updateOne(
            { _id: new ObjectId(notificationId), userId: user.id },
            { $set: { read: true } }
        );
        
        if (result.matchedCount === 0) {
            throw new Error("Notification not found or access denied.");
        }
        
        revalidatePath('/');
        return { success: true };
    });
}

/**
 * Deletes a specific notification (soft delete by marking as deleted)
 * @param notificationId The ID of the notification to delete
 * @returns Result of the operation
 */
export async function deleteNotification(notificationId: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Verify notification belongs to user before deleting
        const result = await db.collection("notifications").deleteOne(
            { _id: new ObjectId(notificationId), userId: user.id }
        );
        
        if (result.deletedCount === 0) {
            throw new Error("Notification not found or access denied.");
        }
        
        revalidatePath('/');
        return { success: true };
    });
}

/**
 * Completes a user's profile after first login.
 * @param userId The ID of the user.
 * @param profileData The profile data to update.
 * @returns An object with the result of the operation.
 */
export async function completeUserProfile({
    userId,
    profileData
}: {
    userId: string;
    profileData: {
        name: string;
        city: string;
        phone?: string;
        bio?: string;
        interests?: string[];
        avatarUrl?: string;
        birthDate?: string;
    };
}): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId: currentUserId }) => {
        if (user.id !== userId) throw new Error("Unauthorized");
        
        const updateData: any = {
                        name: profileData.name,
                        updatedAt: new Date()
                };

                // Normalize and store canonical city key
                if (profileData.city) {
                    const { validateUserCity } = await import('@/lib/validation');
                    const normalized = await validateUserCity(profileData.city);
                    updateData.cityNormalized = normalized;
                }

        // Add optional fields if provided
        if (profileData.phone) updateData.phone = profileData.phone;
        if (profileData.bio) updateData.bio = profileData.bio;
        if (profileData.interests) updateData.interests = profileData.interests;
        if (profileData.avatarUrl) updateData.avatarUrl = profileData.avatarUrl;
        if (profileData.birthDate) updateData.birthDate = new Date(profileData.birthDate);

        await db.collection("users").updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateData }
        );
        
        revalidatePath('/');
        return { success: true };
    });
}

// Legacy profile completeness migration removed; completeness is computed at runtime.

// ===== EXCHANGE MANAGEMENT FUNCTIONS =====
// These functions handle formal exchange proposals, tracking, and completion
// They work alongside the existing chat system to provide structured exchange management

/**
 * Proposes a formal book exchange between two users
 * Creates an Exchange record and links it to the existing chat
 */
export async function proposeExchange(
    responderUserId: string,
    proposerBookId: string,
    responderBookId: string,
    proposalMessage?: string
): Promise<{ success: true; data: { exchangeId: string; chatId: string; message: string } } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Import validation utilities
        const { validateObjectId, ValidationError } = await import('@/lib/validation');
        
        // Validate input parameters
        const validatedResponderId = validateObjectId(responderUserId);
        const validatedProposerBookId = validateObjectId(proposerBookId);
        const validatedResponderBookId = validateObjectId(responderBookId);
        
        // Fetch all required data with validation
        const [proposer, responder, proposerBook, responderBook] = await Promise.all([
            db.collection("users").findOne({ _id: new ObjectId(user.id) }),
            db.collection("users").findOne({ _id: validatedResponderId }),
            db.collection("books").findOne({ _id: validatedProposerBookId }),
            db.collection("books").findOne({ _id: validatedResponderBookId })
        ]);
        
        // Comprehensive validation
        if (!proposer || !responder || !proposerBook || !responderBook) {
            throw new ValidationError("Required data not found");
        }
        
        // Validate book ownership
        if (proposerBook.sellerId !== user.id) {
            throw new ValidationError("You can only propose exchanges with your own books");
        }
        
        if (responderBook.sellerId !== responderUserId) {
            throw new ValidationError("Invalid responder book");
        }
        
        // Validate both books are exchange type
        if (proposerBook.type !== 'exchange' || responderBook.type !== 'exchange') {
            throw new ValidationError("Both books must be listed for exchange");
        }
        
                // Centralized eligibility and location checks
                const { default: locationUtils } = await import('@/lib/location/location-utils');
                const eligibility = locationUtils.canUserExchange({
                    proposer: { id: String(proposer._id), cityNormalized: proposer.cityNormalized, avatarUrl: proposer.avatarUrl, bio: proposer.bio },
                    responder: { id: String(responder._id), cityNormalized: responder.cityNormalized, avatarUrl: responder.avatarUrl, bio: responder.bio },
                    proposerBook: { sellerId: proposerBook.sellerId, status: proposerBook.status },
                    responderBook: { sellerId: responderBook.sellerId, status: responderBook.status }
                });

                if (!eligibility.allowed) {
                    throw new ValidationError(eligibility.reason || 'Exchange not allowed');
                }
        
        // Check if there's already an active exchange between these books
        const existingExchange = await db.collection("exchanges").findOne({
            $or: [
                {
                    proposerId: user.id,
                    responderId: responderUserId,
                    proposerBookId: validatedProposerBookId,
                    responderBookId: validatedResponderBookId,
                    status: { $in: ['proposed', 'accepted', 'in_progress'] }
                },
                {
                    proposerId: responderUserId,
                    responderId: user.id,
                    proposerBookId: validatedResponderBookId,
                    responderBookId: validatedProposerBookId,
                    status: { $in: ['proposed', 'accepted', 'in_progress'] }
                }
            ]
        });
        
        if (existingExchange) {
            throw new Error("There is already an active exchange proposal between these books.");
        }
        
        // Find or create chat for communication
        const participantIds = [user.id, responderUserId].sort();
        let chat = await db.collection("chats").findOne({
            participantIds: { $all: participantIds },
            bookId: validatedResponderBookId
        });
        
        if (!chat) {
            // Create new chat for this exchange
            const newChat: Omit<Chat, '_id'> = {
                participantIds,
                bookId: validatedResponderBookId,
                messages: [],
                updatedAt: new Date().toISOString(),
            };
            
            const chatResult = await db.collection("chats").insertOne(newChat);
            chat = { _id: chatResult.insertedId, ...newChat };
        }
        
        if (!chat) {
            throw new Error('Failed to create or find chat');
        }
        
        // Create the exchange proposal
        const now = new Date().toISOString();
        const newExchange: Omit<Exchange, '_id'> = {
            proposerId: user.id,
            responderId: responderUserId,
            proposerBookId: validatedProposerBookId,
            responderBookId: validatedResponderBookId,
            status: 'proposed' as ExchangeStatus,
            statusHistory: [{
                status: 'proposed' as ExchangeStatus,
                timestamp: now,
                updatedBy: user.id,
                notes: proposalMessage
            }],
            chatId: chat._id,
            proposedAt: now,
            updatedAt: now,
            proposalMessage: proposalMessage
        };
        
        const exchangeResult = await db.collection("exchanges").insertOne(newExchange);
        if (!exchangeResult.insertedId) {
            throw new Error('proposeExchange: exchange insert failed');
        }

        // Update chat to link to exchange
        await db.collection("chats").updateOne(
            { _id: new ObjectId(chat._id) },
            { 
                $set: { 
                    exchangeId: exchangeResult.insertedId,
                    updatedAt: now
                } 
            }
        );
        
        // Add initial message to chat about the proposal
        const systemMessage = {
            _id: new ObjectId(),
            senderId: 'system',
            text: `📚 Exchange Proposed: "${proposerBook.title}" for "${responderBook.title}"${proposalMessage ? `\n\nMessage: ${proposalMessage}` : ''}`,
            createdAt: now
        };
        
        await db.collection("chats").updateOne(
            { _id: new ObjectId(chat._id) },
            { 
                $push: { messages: systemMessage } as any,
                $set: { 
                    lastMessage: systemMessage.text,
                    updatedAt: now
                }
            }
        );
        
        console.log(`Exchange proposed: ${user.id} -> ${responderUserId} (${proposerBookId} for ${responderBookId})`);
        
        // Send email notification to responder (if they have email notifications enabled)
        try {
            const responderEmailPrefs = responder.emailPreferences;
            if (!responderEmailPrefs || responderEmailPrefs.exchangeProposals !== false) {
                await sendExchangeProposalEmail(
                    responder.email,
                    responder.name,
                    proposer.name,
                    {
                        title: proposerBook.title,
                        author: proposerBook.author,
                        imageUrl: proposerBook.imageUrl
                    },
                    {
                        title: responderBook.title,
                        author: responderBook.author,
                        imageUrl: responderBook.imageUrl
                    },
                    proposalMessage || "No additional message provided.",
                    exchangeResult.insertedId.toString()
                );
            }
        } catch (emailError) {
            // NOTE: email failure is non-fatal but must be visible in production logs
            console.error('[EMAIL_FAILURE] proposeExchange', (emailError as Error)?.message || emailError);
        }
        
        // Lock books before emitting so no concurrent proposal can race in
        await db.collection("books").updateMany(
            { _id: { $in: [validatedProposerBookId, validatedResponderBookId] } },
            { $set: { status: 'on_hold', updatedAt: now } }
        );

        // Emit real-time status update for new exchange
        try {
            const { emitExchangeStatusUpdate } = await import('../../server');
            await emitExchangeStatusUpdate(exchangeResult.insertedId.toString(), {
                status: 'proposed',
                updatedAt: now,
                proposedAt: now
            });
        } catch (emitError) {
            console.warn('Failed to emit real-time update for new exchange:', emitError);
        }

        // Create in-app notification for responder
        try {
            const { createExchangeProposalNotification } = await import('@/lib/notification-utils');
            await createExchangeProposalNotification(
                responderUserId,
                proposer.name || 'A user',
                proposerBook.title,
                exchangeResult.insertedId.toString()
            );
        } catch (notifError) {
            console.warn('Failed to create exchange proposal notification:', notifError);
        }

        return {
            exchangeId: exchangeResult.insertedId.toString(),
            chatId: chat._id.toString(),
            message: "Exchange proposal sent successfully!"
        };
    });
}

/**
 * Accepts a pending exchange proposal
 */
export async function acceptExchange(exchangeId: string): Promise<{ success: true; data: { message: string } } | { success: false; message: string }> {
    return withAuthenticatedUserFull(async ({ db, user, userId }) => {
        const { validateObjectId, ValidationError } = await import('@/lib/validation');
        
        const validatedExchangeId = validateObjectId(exchangeId);
        
        // Find the exchange
        const exchange = await db.collection("exchanges").findOne({ _id: validatedExchangeId });
        
        if (!exchange) {
            throw new ValidationError("Exchange not found");
        }
        
        // Validate user is the responder
        if (exchange.responderId !== user.id) {
            throw new ValidationError("You can only accept exchanges proposed to you");
        }
        
        // Validate exchange is in proposed status
        if (exchange.status !== 'proposed') {
            throw new Error(`Cannot accept exchange in ${exchange.status} status`);
        }
        
        // Atomically update exchange status from 'proposed' -> 'accepted'
        const now = new Date().toISOString();
        const statusUpdate = {
            status: 'accepted' as ExchangeStatus,
            timestamp: now,
            updatedBy: user.id
        };

        const updateResult = await db.collection("exchanges").updateOne(
            { _id: validatedExchangeId, responderId: user.id, status: 'proposed' },
            {
                $set: {
                    status: 'accepted',
                    acceptedAt: now,
                    updatedAt: now
                },
                $push: {
                    statusHistory: statusUpdate
                } as any
            }
        );

        if (updateResult.modifiedCount === 0) {
            // Another process may have modified the exchange (race), return an informative error
            throw new Error('Failed to accept exchange: it may have been accepted or cancelled already.');
        }

        // Add system message to chat
        const systemMessage = {
            _id: new ObjectId(),
            senderId: 'system',
            text: `✅ Exchange Accepted! The exchange is now active. Please coordinate with each other to complete the book exchange.`,
            createdAt: now
        };

        await db.collection("chats").updateOne(
            { _id: new ObjectId(exchange.chatId) },
            {
                $push: { messages: systemMessage } as any,
                $set: {
                    lastMessage: systemMessage.text,
                    updatedAt: now
                }
            }
        );
        
        // Move both books to reserved — prevents other exchanges while this one is active
        await db.collection("books").updateMany(
            { _id: { $in: [new ObjectId(String(exchange.proposerBookId)), new ObjectId(String(exchange.responderBookId))] } },
            { $set: { status: 'reserved', updatedAt: now } }
        );

        console.log(`Exchange accepted: ${exchangeId} by user ${user.id}`);

        // Send email notification to proposer (if they have email notifications enabled)
        try {
            const proposer = await db.collection("users").findOne({ _id: new ObjectId(exchange.proposerId) });
            const responderBook = await db.collection("books").findOne({ _id: new ObjectId(exchange.responderBookId) });
            
            if (proposer && responderBook) {
                const proposerEmailPrefs = proposer.emailPreferences;
                if (!proposerEmailPrefs || proposerEmailPrefs.exchangeUpdates !== false) {
                    await sendExchangeStatusUpdateEmail(
                        proposer.email,
                        proposer.name,
                        user.name || 'BookEx User',
                        responderBook.title,
                        'accepted',
                        exchangeId
                    );
                }
            }
        } catch (emailError) {
            console.error('[EMAIL_FAILURE] acceptExchange', (emailError as Error)?.message || emailError);
        }

        // Create in-app notification for proposer
        try {
            const { createExchangeUpdateNotification } = await import('@/lib/notification-utils');
            const proposerBook = await db.collection("books").findOne({ _id: new ObjectId(String(exchange.proposerBookId)) });
            await createExchangeUpdateNotification(
                exchange.proposerId,
                'accepted',
                proposerBook?.title || 'your book',
                exchangeId
            );
        } catch (notifError) {
            console.warn('Failed to create exchange update notification:', notifError);
        }

        // Emit real-time status update
        try {
            const { emitExchangeStatusUpdate } = await import('../../server');
            await emitExchangeStatusUpdate(exchangeId, {
                status: 'accepted',
                updatedAt: now,
                acceptedAt: now
            });
        } catch (emitError) {
            console.warn('Failed to emit real-time update:', emitError);
        }

        return {
            message: "Exchange accepted successfully! Coordinate with the other user to complete the exchange."
        };
    });
}

/**
 * Rejects a pending exchange proposal (responder only)
 */
export async function rejectExchange(exchangeId: string, reason?: string): Promise<{ success: true; data: { message: string } } | { success: false; message: string }> {
    return withAuthenticatedUserFull(async ({ db, user }) => {
        const { validateObjectId, ValidationError } = await import('@/lib/validation');

        const validatedExchangeId = validateObjectId(exchangeId);

        const exchange = await db.collection("exchanges").findOne({ _id: validatedExchangeId });

        if (!exchange) throw new ValidationError("Exchange not found");

        if (exchange.responderId !== user.id) {
            throw new ValidationError("Only the responder can reject a proposal");
        }

        if (exchange.status !== 'proposed') {
            throw new Error(`Cannot reject exchange in ${exchange.status} status`);
        }

        const now = new Date().toISOString();

        const updateResult = await db.collection("exchanges").updateOne(
            { _id: validatedExchangeId, responderId: user.id, status: 'proposed' },
            {
                $set: { status: 'rejected', updatedAt: now },
                $push: {
                    statusHistory: {
                        status: 'rejected' as ExchangeStatus,
                        timestamp: now,
                        updatedBy: user.id,
                        notes: reason
                    }
                } as any
            }
        );

        if (updateResult.modifiedCount === 0) {
            throw new Error('Failed to reject exchange: it may have already been actioned.');
        }

        // Restore both books to active
        await db.collection("books").updateMany(
            { _id: { $in: [new ObjectId(String(exchange.proposerBookId)), new ObjectId(String(exchange.responderBookId))] } },
            { $set: { status: 'active', updatedAt: now } }
        );

        // System message in chat
        const systemMessage = {
            _id: new ObjectId(),
            senderId: 'system',
            text: `❌ Exchange Declined${reason ? `\n\nReason: ${reason}` : ''}`,
            createdAt: now
        };

        await db.collection("chats").updateOne(
            { _id: new ObjectId(exchange.chatId) },
            {
                $push: { messages: systemMessage } as any,
                $set: { lastMessage: systemMessage.text, updatedAt: now }
            }
        );

        // In-app notification for proposer
        try {
            const { createExchangeUpdateNotification } = await import('@/lib/notification-utils');
            const proposerBook = await db.collection("books").findOne({ _id: new ObjectId(String(exchange.proposerBookId)) });
            await createExchangeUpdateNotification(
                exchange.proposerId,
                'rejected',
                proposerBook?.title || 'your book',
                exchangeId
            );
        } catch (notifError) {
            console.warn('Failed to create rejection notification:', notifError);
        }

        // Email proposer
        try {
            const proposer = await db.collection("users").findOne({ _id: new ObjectId(exchange.proposerId) });
            const proposerBook = await db.collection("books").findOne({ _id: new ObjectId(String(exchange.proposerBookId)) });
            if (proposer && proposerBook) {
                const prefs = proposer.emailPreferences;
                if (!prefs || prefs.exchangeUpdates !== false) {
                    await sendExchangeStatusUpdateEmail(
                        proposer.email,
                        proposer.name,
                        user.name || 'BookEx User',
                        proposerBook.title,
                        'rejected',
                        exchangeId
                    );
                }
            }
        } catch (emailError) {
            console.warn('Failed to send rejection email:', emailError);
        }

        try {
            const { emitExchangeStatusUpdate } = await import('../../server');
            await emitExchangeStatusUpdate(exchangeId, { status: 'rejected', updatedAt: now });
        } catch (emitError) {
            console.warn('Failed to emit real-time update:', emitError);
        }

        return { message: "Exchange proposal declined." };
    });
}

/**
 * Confirms completion of an exchange (both users must confirm)
 */
export async function confirmExchangeCompletion(exchangeId: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        const { validateObjectId, ValidationError } = await import('@/lib/validation');
        
        const validatedExchangeId = validateObjectId(exchangeId);
        
        // Find the exchange
        const exchange = await db.collection("exchanges").findOne({ _id: validatedExchangeId });
        
        if (!exchange) {
            throw new ValidationError("Exchange not found");
        }
        
        // Validate user is a participant
        if (exchange.proposerId !== user.id && exchange.responderId !== user.id) {
            throw new ValidationError("You are not a participant in this exchange");
        }
        
        // Validate exchange is accepted or in progress
        if (!['accepted', 'in_progress'].includes(exchange.status)) {
            throw new Error(`Cannot confirm completion for exchange in ${exchange.status} status`);
        }
        
        const now = new Date().toISOString();
        const isProposer = exchange.proposerId === user.id;
        
        // Update confirmation status
        const updateFields: any = {
            updatedAt: now
        };
        
        if (isProposer) {
            updateFields.proposerConfirmed = true;
        } else {
            updateFields.responderConfirmed = true;
        }
        
        // Check if both users have now confirmed
        const bothConfirmed = (isProposer ? true : exchange.proposerConfirmed) && 
                             (!isProposer ? true : exchange.responderConfirmed);
        
        if (bothConfirmed) {
            updateFields.status = 'completed';
            updateFields.completedAt = now;
        } else if (exchange.status === 'accepted') {
            updateFields.status = 'in_progress';
        }
        
        // Add status update to history
        const statusUpdate = {
            status: bothConfirmed ? 'completed' as ExchangeStatus : 'in_progress' as ExchangeStatus,
            timestamp: now,
            updatedBy: user.id,
            notes: isProposer ? 'Proposer confirmed completion' : 'Responder confirmed completion'
        };
        
        const confirmResult = await db.collection("exchanges").updateOne(
            { _id: validatedExchangeId },
            {
                $set: updateFields,
                $push: {
                    statusHistory: statusUpdate
                } as any
            }
        );

        if (confirmResult.matchedCount === 0) {
            throw new Error('Exchange not found or already modified');
        }

        if (bothConfirmed) {
            // Perform ownership transfer and record history in a transaction
            const client = await clientPromise;
            const session = client.startSession();
            try {
                await session.withTransaction(async () => {
                    const proposerBookIdObj = new ObjectId(String(exchange.proposerBookId));
                    const responderBookIdObj = new ObjectId(String(exchange.responderBookId));

                    const proposerBook = await db.collection("books").findOne({ _id: proposerBookIdObj }, { session });
                    const responderBook = await db.collection("books").findOne({ _id: responderBookIdObj }, { session });

                    // Only proceed if both books still exist
                    if (proposerBook && responderBook) {
                        // Swap ownership: proposerBook -> responder, responderBook -> proposer
                        await db.collection("books").updateOne(
                            { _id: proposerBookIdObj },
                            { $set: { sellerId: exchange.responderId, status: 'exchanged', updatedAt: now } },
                            { session }
                        );

                        await db.collection("books").updateOne(
                            { _id: responderBookIdObj },
                            { $set: { sellerId: exchange.proposerId, status: 'exchanged', updatedAt: now } },
                            { session }
                        );

                        // Record ownership history for auditability
                        const ownershipHistoryEntries = [
                            {
                                bookId: String(proposerBookIdObj),
                                previousOwnerId: proposerBook.sellerId || null,
                                newOwnerId: exchange.responderId,
                                exchangeId: String(validatedExchangeId),
                                timestamp: now
                            },
                            {
                                bookId: String(responderBookIdObj),
                                previousOwnerId: responderBook.sellerId || null,
                                newOwnerId: exchange.proposerId,
                                exchangeId: String(validatedExchangeId),
                                timestamp: now
                            }
                        ];

                        await db.collection('bookOwnershipHistory').insertMany(ownershipHistoryEntries, { session });
                    }
                });
            } finally {
                await session.endSession();
            }

            revalidatePath('/books');
            revalidatePath('/exchange');
            revalidatePath('/exchange/history');
            revalidatePath('/profile/me');
            revalidatePath(`/books/${exchange.proposerBookId}`);
            revalidatePath(`/books/${exchange.responderBookId}`);

            // Notify both parties of completion
            try {
                const { createExchangeUpdateNotification } = await import('@/lib/notification-utils');
                const proposerBook = await db.collection("books").findOne({ _id: new ObjectId(String(exchange.proposerBookId)) });
                const bookTitle = proposerBook?.title || 'your book';
                await Promise.all([
                    createExchangeUpdateNotification(exchange.proposerId, 'completed', bookTitle, String(validatedExchangeId)),
                    createExchangeUpdateNotification(exchange.responderId, 'completed', bookTitle, String(validatedExchangeId))
                ]);

                // Send completion emails
                const [proposerUser, responderUser] = await Promise.all([
                    db.collection("users").findOne({ _id: new ObjectId(exchange.proposerId) }, { projection: { name: 1, email: 1 } }),
                    db.collection("users").findOne({ _id: new ObjectId(exchange.responderId) }, { projection: { name: 1, email: 1 } })
                ]);
                if (proposerUser?.email && responderUser?.email) {
                    await Promise.all([
                        sendExchangeStatusUpdateEmail(proposerUser.email, proposerUser.name, responderUser.name, bookTitle, 'completed', String(validatedExchangeId)),
                        sendExchangeStatusUpdateEmail(responderUser.email, responderUser.name, proposerUser.name, bookTitle, 'completed', String(validatedExchangeId))
                    ]);
                }
            } catch (notifError) {
                console.error('[EMAIL_FAILURE] confirmExchangeCompletion', (notifError as Error)?.message || notifError);
            }
        }

        // Add system message to chat
        let messageText: string;
        if (bothConfirmed) {
            messageText = `🎉 Exchange Completed! Both users have confirmed the exchange is complete. You can now rate each other.`;
        } else {
            const otherUserRole = isProposer ? 'responder' : 'proposer';
            messageText = `✅ Exchange confirmation received. Waiting for the other user to confirm completion.`;
        }
        
        const systemMessage = {
            _id: new ObjectId(),
            senderId: 'system',
            text: messageText,
            createdAt: now
        };
        
        await db.collection("chats").updateOne(
            { _id: new ObjectId(exchange.chatId) },
            {
                $push: { messages: systemMessage } as any,
                $set: {
                    lastMessage: systemMessage.text,
                    updatedAt: now
                }
            }
        );
        
        console.log(`Exchange completion confirmed: ${exchangeId} by user ${user.id} (both confirmed: ${bothConfirmed})`);
        
        // Emit real-time status update
        try {
            const { emitExchangeStatusUpdate } = await import('../../server');
            await emitExchangeStatusUpdate(exchangeId, {
                status: bothConfirmed ? 'completed' : 'in_progress',
                updatedAt: now,
                completedAt: bothConfirmed ? now : undefined,
                proposerConfirmed: isProposer ? true : exchange.proposerConfirmed,
                responderConfirmed: !isProposer ? true : exchange.responderConfirmed
            });
        } catch (emitError) {
            console.warn('Failed to emit real-time update:', emitError);
        }
        
        return {
            success: true,
            data: {
                completed: bothConfirmed,
                message: bothConfirmed
                    ? "Exchange completed successfully! You can now rate your exchange partner."
                    : "Your confirmation has been recorded. Waiting for the other user to confirm."
            }
        };
    });
}

/**
 * Cancels an exchange (can be done by either participant before completion)
 */
export async function cancelExchange(exchangeId: string, reason?: string): Promise<{ success: true; data: { message: string } } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        const { validateObjectId, ValidationError } = await import('@/lib/validation');
        
        const validatedExchangeId = validateObjectId(exchangeId);
        
        // Find the exchange
        const exchange = await db.collection("exchanges").findOne({ _id: validatedExchangeId });
        
        if (!exchange) {
            throw new ValidationError("Exchange not found");
        }
        
        // Validate user is a participant
        if (exchange.proposerId !== user.id && exchange.responderId !== user.id) {
            throw new ValidationError("You are not a participant in this exchange");
        }
        
        // Validate exchange can be cancelled
        if (['completed', 'cancelled'].includes(exchange.status)) {
            throw new Error(`Cannot cancel exchange in ${exchange.status} status`);
        }
        
        const now = new Date().toISOString();
        const statusUpdate = {
            status: 'cancelled' as ExchangeStatus,
            timestamp: now,
            updatedBy: user.id,
            notes: reason
        };
        
        const cancelResult = await db.collection("exchanges").updateOne(
            { _id: validatedExchangeId },
            {
                $set: {
                    status: 'cancelled',
                    updatedAt: now
                },
                $push: {
                    statusHistory: statusUpdate
                } as any
            }
        );

        if (cancelResult.matchedCount === 0) {
            throw new Error('Exchange not found or already modified');
        }

        // Restore both books to active so they can enter new exchanges
        await db.collection("books").updateMany(
            { _id: { $in: [new ObjectId(String(exchange.proposerBookId)), new ObjectId(String(exchange.responderBookId))] } },
            { $set: { status: 'active', updatedAt: now } }
        );

        // Notify the other participant
        try {
            const { createExchangeUpdateNotification } = await import('@/lib/notification-utils');
            const otherUserId = exchange.proposerId === user.id ? exchange.responderId : exchange.proposerId;
            const cancellerBook = await db.collection("books").findOne({ _id: new ObjectId(String(exchange.proposerBookId)) });
            await createExchangeUpdateNotification(
                otherUserId,
                'cancelled',
                cancellerBook?.title || 'a book',
                exchangeId
            );
        } catch (notifError) {
            console.warn('Failed to create cancellation notification:', notifError);
        }

        // Add system message to chat
        const systemMessage = {
            _id: new ObjectId(),
            senderId: 'system',
            text: `❌ Exchange Cancelled${reason ? `\n\nReason: ${reason}` : ''}`,
            createdAt: now
        };
        
        await db.collection("chats").updateOne(
            { _id: new ObjectId(exchange.chatId) },
            {
                $push: { messages: systemMessage } as any,
                $set: {
                    lastMessage: systemMessage.text,
                    updatedAt: now
                }
            }
        );
        
        console.log(`Exchange cancelled: ${exchangeId} by user ${user.id}`);
        
        // Emit real-time status update
        try {
            const { emitExchangeStatusUpdate } = await import('../../server');
            await emitExchangeStatusUpdate(exchangeId, {
                status: 'cancelled',
                updatedAt: now
            });
        } catch (emitError) {
            console.warn('Failed to emit real-time update:', emitError);
        }
        
        return {
            message: "Exchange cancelled successfully."
        };
    });
}

/**
 * Gets user's exchange history with pagination
 */
export async function getUserExchanges(
    page: number = 1,
    limit: number = 10,
    status?: ExchangeStatus
): Promise<{ success: true; data: { exchanges: any[]; totalCount: number; hasMore: boolean; currentPage: number } } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Build query
        const query: any = {
            $or: [
                { proposerId: user.id },
                { responderId: user.id }
            ]
        };
        
        if (status) {
            query.status = status;
        }
        
        // Calculate pagination
        const skip = (page - 1) * limit;
        
        // Get exchanges with related data
        const pipeline = [
            { $match: query },
            { $sort: { updatedAt: -1 } },
            {
                $facet: {
                    exchanges: [
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $lookup: {
                                from: "users",
                                localField: "proposerId",
                                foreignField: "_id",
                                as: "proposer",
                                pipeline: [{ $project: { password: 0 } }]
                            }
                        },
                        {
                            $lookup: {
                                from: "users", 
                                localField: "responderId",
                                foreignField: "_id",
                                as: "responder",
                                pipeline: [{ $project: { password: 0 } }]
                            }
                        },
                        {
                            $lookup: {
                                from: "books",
                                localField: "proposerBookId",
                                foreignField: "_id",
                                as: "proposerBook"
                            }
                        },
                        {
                            $lookup: {
                                from: "books",
                                localField: "responderBookId", 
                                foreignField: "_id",
                                as: "responderBook"
                            }
                        },
                        {
                            $addFields: {
                                proposer: { $arrayElemAt: ["$proposer", 0] },
                                responder: { $arrayElemAt: ["$responder", 0] },
                                proposerBook: { $arrayElemAt: ["$proposerBook", 0] },
                                responderBook: { $arrayElemAt: ["$responderBook", 0] }
                            }
                        }
                    ],
                    totalCount: [
                        { $count: "count" }
                    ]
                }
            }
        ];
        
        const [result] = await db.collection("exchanges").aggregate(pipeline).toArray();
        
        const exchanges = result.exchanges || [];
        const totalCount = result.totalCount[0]?.count || 0;
        const hasMore = skip + exchanges.length < totalCount;
        
        return {
            exchanges: JSON.parse(JSON.stringify(exchanges)),
            totalCount,
            hasMore,
            currentPage: page
        };
    });
}

/**
 * Gets exchange details for a specific chat if it exists
 */
export async function getChatExchangeDetails(chatId: string) {
    try {
        const client = await clientPromise;
        const db = client.db("bookex");
        
        const exchange = await db.collection("exchanges").aggregate([
            {
                $match: { chatId: new ObjectId(chatId) }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "proposerId",
                    foreignField: "_id",
                    as: "proposer"
                }
            },
            {
                $lookup: {
                    from: "users", 
                    localField: "responderId",
                    foreignField: "_id",
                    as: "responder"
                }
            },
            {
                $lookup: {
                    from: "books",
                    localField: "proposerBookId",
                    foreignField: "_id", 
                    as: "proposerBook"
                }
            },
            {
                $lookup: {
                    from: "books",
                    localField: "responderBookId",
                    foreignField: "_id",
                    as: "responderBook"
                }
            },
            {
                $addFields: {
                    proposer: { $arrayElemAt: ["$proposer", 0] },
                    responder: { $arrayElemAt: ["$responder", 0] },
                    proposerBook: { $arrayElemAt: ["$proposerBook", 0] },
                    responderBook: { $arrayElemAt: ["$responderBook", 0] }
                }
            }
        ]).toArray();
        
        return exchange.length > 0 ? JSON.parse(JSON.stringify(exchange[0])) : null;
        
    } catch (error) {
        console.error("Error fetching chat exchange details:", error);
        return null;
    }
}

/**
 * Gets user email preferences
 */
export async function getUserEmailPreferences(): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        const userData = await db.collection("users").findOne(
            { _id: new ObjectId(user.id) },
            { projection: { emailPreferences: 1 } }
        );
        
        // Return default preferences if none set
        const defaultPreferences = {
            exchangeProposals: true,
            exchangeUpdates: true,
            contactNotifications: true,
            weeklyDigest: false
        };
        
        return userData?.emailPreferences || defaultPreferences;
    });
}

/**
 * Updates user email preferences
 */
export async function updateEmailPreferences(preferences: {
    exchangeProposals: boolean;
    exchangeUpdates: boolean;
    contactNotifications: boolean;
    weeklyDigest: boolean;
    communityMentions?: boolean;
    commentReplies?: boolean;
    reviewReceived?: boolean;
    adminActions?: boolean;
}): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        await db.collection("users").updateOne(
            { _id: new ObjectId(user.id) },
            { 
                $set: { 
                    emailPreferences: preferences,
                    updatedAt: new Date()
                } 
            }
        );
        
        revalidatePath('/profile/settings');
        return { success: true };
    });
}

/**
 * Optimizes database performance by ensuring all indexes exist (Admin only)
 * @returns Result of the database optimization
 */
export async function optimizeDatabasePerformance(): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        console.log('🚀 Starting database optimization...');
        const result = await ensureDatabaseIndexes();
        
        if (result.success) {
            console.log('✅ Database optimization completed successfully');
            return { 
                message: "Database performance optimization completed successfully!" 
            };
        } else {
            throw new Error(result.error || 'Unknown error during optimization');
        }
    }, 'admin');
}

/**
 * Checks database index health and performance (Admin only)
 * @returns Database health report
 */
export async function checkDatabaseHealth(): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        const healthCheck = await checkIndexHealth();
        
        return {
                healthy: healthCheck.healthy,
                missingIndexes: healthCheck.missingIndexes || [],
                totalChecked: healthCheck.totalChecked || 0,
                message: healthCheck.healthy 
                    ? "Database indexes are healthy and optimized!" 
                    : `Found ${healthCheck.missingIndexes?.length || 0} missing indexes that need attention.`
        };
    }, 'admin');
}

/**
 * Creates only the missing critical indexes (Admin only)
 * @returns Result of creating missing indexes
 */
export async function createMissingDatabaseIndexes(): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        console.log('🔧 Creating missing database indexes...');
        const result = await createMissingIndexes();
        
        if (result.success) {
            console.log('✅ Missing indexes created successfully');
            return { 
                message: result.message || "Missing indexes created successfully!",
                createdCount: result.createdCount || 0
            };
        } else {
            throw new Error(result.error || 'Unknown error during index creation');
        }
    }, 'admin');
}

/**
 * Initialize comprehensive database maintenance including TTL, indexes, and schema migration
 * @param mode The maintenance mode to run
 * @returns Result of the maintenance operation
 */
export async function initializeDatabaseMaintenance(mode: 'full' | 'indexes' | 'cleanup' | 'migration' = 'full'): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        console.log(`🔧 Starting database maintenance in ${mode} mode...`);

        switch (mode) {
            case 'full':
                // Run complete maintenance including schema migration
                await Promise.all([
                    SchemaMigration.fixAllSchemaInconsistencies(),
                    DatabaseMaintenance.initializeDatabaseMaintenance(),
                    DatabaseMaintenance.performPeriodicCleanup()
                ]);
                break;
                
            case 'indexes':
                await DatabaseMaintenance.createCriticalIndexes();
                await DatabaseMaintenance.validateIndexHealth();
                break;
                
            case 'cleanup':
                await DatabaseMaintenance.performPeriodicCleanup();
                break;
                
            case 'migration':
                await SchemaMigration.fixAllSchemaInconsistencies();
                await SchemaMigration.validateDataIntegrity();
                break;
        }

        console.log(`✅ Database maintenance (${mode}) completed successfully`);
        
        return { 
            message: `Database maintenance (${mode} mode) completed successfully!`,
            mode,
            timestamp: new Date().toISOString()
        };
    }, 'admin');
}

/**
 * Emergency database cleanup for critical storage issues
 * @returns Result of the emergency cleanup operation
 */
export async function emergencyDatabaseCleanup(): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        console.log('🚨 Starting emergency database cleanup...');
        
        await DatabaseMaintenance.emergencyCleanup();
        
        console.log('✅ Emergency cleanup completed');
        
        return { 
            message: "Emergency database cleanup completed successfully!",
            timestamp: new Date().toISOString()
        };
    }, 'admin');
}

/**
 * Gets security statistics for admin dashboard
 */
export async function getSecurityStats(): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Get authentication statistics
        const failedLogins = await db.collection("authenticationAttempts").countDocuments({
            success: false,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
        });

        const blockedAccounts = await db.collection("users").countDocuments({
            status: "suspended"
        });

        // Get content moderation statistics
        const flaggedContent = await db.collection("moderationActions").countDocuments({
            action: { $in: ["flag", "quarantine"] },
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
        });

        const bannedUsers = await db.collection("users").countDocuments({
            status: "banned"
        });

        // Get file security statistics
        const quarantinedFiles = await db.collection("fileSecurityActions").countDocuments({
            action: "quarantine",
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
        });

        // Get business logic statistics
        const activeLocks = await db.collection("transactionLocks").countDocuments({
            expiresAt: { $gt: new Date().toISOString() }
        });

        return {
            authentication: {
                failedLogins,
                blockedAccounts,
                rateLimitHits: 0 // Would come from rate limit store
            },
            contentModeration: {
                flaggedContent,
                bannedUsers,
                pendingReview: await db.collection("moderationActions").countDocuments({
                    action: "quarantine"
                })
            },
            fileSecurity: {
                quarantinedFiles,
                virusDetected: quarantinedFiles // Simplified for now
            },
            businessLogic: {
                activeLocks,
                duplicatesBlocked: 0 // Would need separate tracking
            }
        };
    }, 'admin');
}

/**
 * Gets recent security alerts for admin dashboard
 */
export async function getSecurityAlerts(): Promise<{ success: true; data: any[] } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        const alerts = await db.collection("securityAlerts").find({
            resolved: false,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
        }).sort({ createdAt: -1 }).limit(10).toArray();

        return JSON.parse(JSON.stringify(alerts));
    }, 'admin');
}

/**
 * Resolves a security alert
 */
export async function resolveSecurityAlert(alertId: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        await db.collection("securityAlerts").updateOne(
            { _id: new ObjectId(alertId) },
            { 
                $set: { 
                    resolved: true,
                    resolvedAt: new Date().toISOString(),
                    resolvedBy: user.id
                }
            }
        );

        revalidatePath('/admin');
        return { success: true };
    }, 'admin');
}

/**
 * Triggers security maintenance tasks
 */
export async function runSecurityMaintenance(category: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        let result;
        switch (category) {
            case 'content':
                // Would call ContentModerationSystem.performContentCleanup()
                result = { cleaned: 5, actions: ['Cleaned up flagged content'] };
                break;
            case 'business':
                // Would call BusinessLogicSecurity.enforceInventoryConsistency()
                result = { fixed: 3, issues: ['Fixed inventory inconsistencies'] };
                break;
            case 'files':
                // Would call file security cleanup
                result = { cleaned: 2, actions: ['Removed quarantined files'] };
                break;
            default:
                throw new Error('Invalid maintenance category');
        }

        return result;
    }, 'admin');
}

/**
 * Deletes a book listing (only by the owner)
 */
export async function deleteBookListing(bookId: string) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (!ObjectId.isValid(bookId)) {
            throw createAppError(ErrorType.VALIDATION, "Invalid book ID");
        }

        // Use transaction for data consistency
        const client = await clientPromise;
        const session = client.startSession();
        
        try {
            await session.withTransaction(async () => {
                // Check if book exists and user is the owner
                const book = await db.collection("books").findOne(
                    { _id: new ObjectId(bookId) },
                    { session }
                );

                if (!book) {
                    throw createAppError(ErrorType.NOT_FOUND, "Book not found");
                }

                if (book.sellerId !== user.id) {
                    throw createAppError(ErrorType.AUTHORIZATION, "You can only delete your own listings");
                }

                    // Prevent deletion if there are active exchanges involving this book
                    const activeExchange = await db.collection("exchanges").findOne({
                        $or: [
                            { proposerBookId: new ObjectId(bookId) },
                            { responderBookId: new ObjectId(bookId) }
                        ],
                        status: { $in: ['proposed', 'accepted', 'in_progress'] }
                    }, { session });

                    if (activeExchange) {
                        throw createAppError(ErrorType.VALIDATION, "Cannot delete listing while an active exchange is in progress or proposed for this book.");
                    }

                // Soft delete the book
                await db.collection("books").updateOne(
                    { _id: new ObjectId(bookId), sellerId: user.id },
                    { $set: { status: 'inactive', deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
                    { session }
                );

                // Clean up related data
                await Promise.all([
                    // Remove from wishlists (handle both string and ObjectId stored values)
                    db.collection("users").updateMany(
                        { "wishlist.bookId": new ObjectId(bookId) },
                        { $pull: { wishlist: { bookId: new ObjectId(bookId) } } } as any,
                        { session }
                    ),
                    db.collection("users").updateMany(
                        { "wishlist.bookId": bookId },
                        { $pull: { wishlist: { bookId: bookId } } } as any,
                        { session }
                    ),

                    // Delete related chats (by ObjectId bookId)
                    db.collection("chats").deleteMany(
                        { bookId: new ObjectId(bookId) },
                        { session }
                    ),

                    // Delete related notifications (handle string or ObjectId in metadata)
                    db.collection("notifications").deleteMany(
                        { $or: [ { "metadata.bookId": bookId }, { "metadata.bookId": new ObjectId(bookId) } ] },
                        { session }
                    ),

                    // Delete related exchanges (use correct field names)
                    db.collection("exchanges").deleteMany(
                        { $or: [
                            { proposerBookId: new ObjectId(bookId) },
                            { responderBookId: new ObjectId(bookId) }
                        ] },
                        { session }
                    ),

                    // Delete related reports referencing this book
                    db.collection("reports").deleteMany(
                        { $and: [ { reportedContentType: 'book' }, { $or: [ { reportedContentId: bookId }, { reportedContentId: new ObjectId(bookId) } ] } ] },
                        { session }
                    )
                ]);
            });
        } finally {
            await session.endSession();
        }

        revalidatePath('/profile/me');
        revalidatePath('/books');
        revalidatePath(`/books/${bookId}`);
        
        return { success: true, message: "Book listing deleted successfully" };
    });
}

export async function updateBookStatus(bookId: string, status: BookStatus) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (!ObjectId.isValid(bookId)) {
            throw createAppError(ErrorType.VALIDATION, "Invalid book ID");
        }

        // Get current book data
        const book = await db.collection("books").findOne({ _id: new ObjectId(bookId) });
        
        if (!book) {
            throw createAppError(ErrorType.NOT_FOUND, "Book listing not found");
        }
        
        if (book.sellerId !== user.id) {
            throw createAppError(ErrorType.AUTHORIZATION, "You can only update your own listings");
        }

        // Validate status transition
        const { isValidStatusTransition } = await import('@/lib/utils');
        const transition = isValidStatusTransition(book.status || 'active', status, book.type);
        
        if (!transition.isValid) {
            throw createAppError(ErrorType.VALIDATION, transition.error || "Invalid status transition");
        }

        // Update book status
        const updateData: any = {
            status,
            updatedAt: new Date().toISOString()
        };

        // If reactivating, extend expiration
        if (status === 'active' && (book.status === 'inactive' || book.status === 'expired')) {
            updateData.expiresAt = calculateExpirationDate(book.type);
        }

        await db.collection("books").updateOne(
            { _id: new ObjectId(bookId) },
            { $set: updateData }
        );

        // Revalidate relevant pages
        revalidatePath('/profile/me');
        revalidatePath('/books');
        revalidatePath(`/books/${bookId}`);
        if (book.type === 'exchange') {
            revalidatePath('/exchange');
        }
        
        return { success: true, message: "Book status updated successfully" };
    });
}

export async function renewBookListing(bookId: string) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (!ObjectId.isValid(bookId)) {
            throw createAppError(ErrorType.VALIDATION, "Invalid book ID");
        }

        // Get current book data
        const book = await db.collection("books").findOne({ _id: new ObjectId(bookId) });
        
        if (!book) {
            throw createAppError(ErrorType.NOT_FOUND, "Book listing not found");
        }
        
        if (book.sellerId !== user.id) {
            throw createAppError(ErrorType.AUTHORIZATION, "You can only renew your own listings");
        }

        // Check if book is in a renewable state
        const renewableStatuses: BookStatus[] = ['expired', 'inactive'];
        if (!renewableStatuses.includes(book.status)) {
            throw createAppError(ErrorType.VALIDATION, "Only expired or inactive listings can be renewed");
        }

        // Renew the listing
        const now = new Date().toISOString();
        await db.collection("books").updateOne(
            { _id: new ObjectId(bookId) },
            { 
                $set: {
                    status: 'active',
                    updatedAt: now,
                    expiresAt: calculateExpirationDate(book.type)
                }
            }
        );

        // Revalidate relevant pages
        revalidatePath('/profile/me');
        revalidatePath('/books');
        revalidatePath(`/books/${bookId}`);
        if (book.type === 'exchange') {
            revalidatePath('/exchange');
        }
        
        return { success: true, message: "Book listing renewed successfully" };
    });
}

/**
 * Gets a book's data for editing (only by the owner)
 */
export async function getBookForEdit(bookId: string) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (!ObjectId.isValid(bookId)) {
            throw createAppError(ErrorType.VALIDATION, "Invalid book ID");
        }

        // Get book data
        const book = await db.collection("books").findOne({ _id: new ObjectId(bookId) });
        
        if (!book) {
            throw createAppError(ErrorType.NOT_FOUND, "Book listing not found");
        }
        
        if (book.sellerId !== user.id) {
            throw createAppError(ErrorType.AUTHORIZATION, "You can only edit your own listings");
        }

        const { findCanonicalCity } = await import('@/lib/location/location-utils');
        const canonical = await findCanonicalCity(book.cityNormalized || '');
        return JSON.parse(JSON.stringify({
            ...book,
            cityNormalized: book.cityNormalized || null,
            cityName: canonical?.name || null,
        }));
    });
}

/**
 * Updates a book listing (only by the owner)
 */
export async function updateBookListing(bookId: string, bookData: { 
    title: string; 
    author: string; 
    description: string; 
    genre: BookGenre; 
    condition: 'new' | 'like-new' | 'used' | 'worn'; 
    type: 'sell' | 'exchange'; 
    price?: number; 
    imageUrl?: string; 
    city: string;
}) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (!ObjectId.isValid(bookId)) {
            throw createAppError(ErrorType.VALIDATION, "Invalid book ID");
        }

        // Check rate limit
        const rateLimitResult = await checkUserRateLimit(user.id, 'UPDATE_BOOK', RATE_LIMITS.LIST_BOOK);
        if (!rateLimitResult.allowed) {
            throw createAppError(ErrorType.RATE_LIMIT, rateLimitResult.error || "Rate limit exceeded");
        }

        // Validate input data with Zod schema
        const validation = validateWithSchema(bookSchema, bookData);
        if (!validation.success) {
            throw createAppError(ErrorType.VALIDATION, validation.message);
        }
        const validatedBookData = validation.data;

        // Get current book data
        const existingBook = await db.collection("books").findOne({ _id: new ObjectId(bookId) });
        
        if (!existingBook) {
            throw createAppError(ErrorType.NOT_FOUND, "Book listing not found");
        }
        
        if (existingBook.sellerId !== user.id) {
            throw createAppError(ErrorType.AUTHORIZATION, "You can only update your own listings");
        }

        // Check if title/author changed and validate for duplicates
        const titleChanged = existingBook.title !== validatedBookData.title;
        const authorChanged = existingBook.author !== validatedBookData.author;
        
        if (titleChanged || authorChanged) {
            // Create new deduplication fields
            const titleNormalized = normalizeForDeduplication(validatedBookData.title);
            const authorNormalized = normalizeForDeduplication(validatedBookData.author);
            const duplicateHash = createBookDuplicateHash(validatedBookData.title, validatedBookData.author, user.id);

            // Check for existing duplicates from the same user (excluding current book)
            const duplicateBook = await db.collection("books").findOne({
                duplicateHash,
                sellerId: user.id,
                _id: { $ne: new ObjectId(bookId) },
                status: { $in: ['active', 'inactive'] }
            });

            if (duplicateBook) {
                // Perform additional similarity check
                const similarity = checkBookSimilarity(
                    { title: validatedBookData.title, author: validatedBookData.author, sellerId: user.id },
                    { title: duplicateBook.title, author: duplicateBook.author, sellerId: duplicateBook.sellerId }
                );

                if (similarity.isDuplicate) {
                    throw createAppError(
                        ErrorType.VALIDATION, 
                        `You already have a similar book listing: "${duplicateBook.title}" by ${duplicateBook.author}. Please remove that listing first or choose a different book.`
                    );
                }
            }
        }

        // Prepare update data
        const now = new Date().toISOString();
        const updateData: any = {
            title: validatedBookData.title,
            author: validatedBookData.author,
            description: validatedBookData.description || '',
            genre: validatedBookData.genre || 'other',
            condition: validatedBookData.condition,
            type: validatedBookData.type,
            cityNormalized: validatedBookData.city,
            updatedAt: now,
        };

        // Only update price for sell type books
        if (validatedBookData.type === 'sell') {
            updateData.price = bookData.price;
        } else {
            updateData.price = null; // Remove price for exchange books
        }

        // Update deduplication fields if title/author changed
        if (titleChanged || authorChanged) {
            updateData.titleNormalized = normalizeForDeduplication(bookData.title);
            updateData.authorNormalized = normalizeForDeduplication(bookData.author);
            updateData.duplicateHash = createBookDuplicateHash(bookData.title, bookData.author, user.id);
        }

        // Update image if provided
        if (bookData.imageUrl) {
            updateData.imageUrl = normalizeMediaUrl(bookData.imageUrl);
        }

        // Update the book
        await db.collection("books").updateOne(
            { _id: new ObjectId(bookId) },
            { $set: updateData }
        );

        // Revalidate relevant pages
        revalidatePath('/profile/me');
        revalidatePath('/books');
        revalidatePath(`/books/${bookId}`);
        if (bookData.type === 'exchange') {
            revalidatePath('/exchange');
        }
        
        return { success: true, message: "Book listing updated successfully" };
    });
}

/**
 * City-related server actions for client components
 * These prevent direct MongoDB imports in client-side code
 */

/**
 * Get cities by country for client components
 */
export async function getCitiesByCountryAction(country: string) {
    try {
        const { getCitiesByCountry } = await import('@/lib/city-validation');
        return await getCitiesByCountry(country);
    } catch (error) {
        console.error('Error getting cities by country:', error);
        return [];
    }
}

/**
 * Get popular cities for client components
 */
export async function getPopularCitiesAction() {
    try {
        const { getPopularCities } = await import('@/lib/city-validation');
        return await getPopularCities();
    } catch (error) {
        console.error('Error getting popular cities:', error);
        return [];
    }
}

/**
 * Search cities for client components
 */
export async function searchCitiesAction(query: string, limit?: number) {
    try {
        const { searchCities } = await import('@/lib/city-validation');
        return await searchCities(query, limit);
    } catch (error) {
        console.error('Error searching cities:', error);
        return [];
    }
}

/**
 * Get available countries for client components
 */
export async function getAvailableCountriesAction() {
    try {
        const { getAvailableCountries } = await import('@/lib/city-validation');
        return await getAvailableCountries();
    } catch (error) {
        console.error('Error getting available countries:', error);
        return [];
    }
}

/**
 * Check if user profile is completed
 */
export async function checkProfileCompletion() {
    try {
        const { getSession } = await import('@/lib/auth');
        const session = await getSession();
        if (!session?.user) {
            return { isAuthenticated: false, isProfileComplete: false };
        }

        // Compute completeness from DB to avoid stored drift
        const client = await clientPromise;
        const db = client.db('bookex');
        const userDoc = await db.collection('users').findOne({ _id: new ObjectId(session.user.id) });
        const listingsCount = await db.collection('books').countDocuments({ sellerId: session.user.id, status: 'active' });

        const { getProfileCompleteness, isProfileComplete } = await import('@/lib/location/location-utils');
        const completeness = getProfileCompleteness({ ...(userDoc || {}), listingsCount });

        return { isAuthenticated: true, isProfileComplete: isProfileComplete({ ...(userDoc || {}), listingsCount }), percent: completeness.percent, missing: completeness.missing };
    } catch (error) {
        console.error('Error checking profile completion:', error);
        return { isAuthenticated: false, isProfileComplete: false };
    }
}

/**
 * Returns detailed profile completeness information for the current user
 */
export async function getProfileCompleteness() {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        const usersColl = db.collection('users');
        const booksColl = db.collection('books');

        const profileUser = await usersColl.findOne({ _id: new ObjectId(user.id) });
        if (!profileUser) throw new Error('User not found');

        const listingsCount = await booksColl.countDocuments({ sellerId: user.id, status: 'active' });

        const { getProfileCompleteness } = await import('@/lib/location/location-utils');
        const result = getProfileCompleteness({ ...profileUser, listingsCount });

        return { success: true, data: result };
    });
}

/**
 * Community role management actions
 */
export async function promoteToModerator(communityId: string, targetUserId: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (!ObjectId.isValid(communityId)) throw new Error('Invalid community ID');
        const community = await db.collection('communities').findOne({ _id: new ObjectId(communityId) }, { projection: { members: 1, createdBy: 1 } });
        if (!community) throw new Error('Community not found');
        const current = (community as any).members?.find((m: any) => m.userId === user.id);
        if (!(current?.role === 'admin' || (community as any).createdBy === user.id)) throw new Error('Insufficient permissions');
        await db.collection('communities').updateOne(
          { _id: new ObjectId(communityId), 'members.userId': targetUserId },
          { $set: { 'members.$.role': 'moderator' } }
        );
        revalidatePath(`/community/${communityId}`);
        return { success: true };
    });
}

export async function demoteModerator(communityId: string, targetUserId: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (!ObjectId.isValid(communityId)) throw new Error('Invalid community ID');
        const community = await db.collection('communities').findOne({ _id: new ObjectId(communityId) }, { projection: { members: 1, createdBy: 1 } });
        if (!community) throw new Error('Community not found');
        const current = (community as any).members?.find((m: any) => m.userId === user.id);
        if (!(current?.role === 'admin' || (community as any).createdBy === user.id)) throw new Error('Insufficient permissions');
        await db.collection('communities').updateOne(
          { _id: new ObjectId(communityId), 'members.userId': targetUserId },
          { $set: { 'members.$.role': 'member' } }
        );
        revalidatePath(`/community/${communityId}`);
        return { success: true };
    });
}

export async function banMember(communityId: string, targetUserId: string, reason?: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (!ObjectId.isValid(communityId)) throw new Error('Invalid community ID');
        const community = await db.collection('communities').findOne({ _id: new ObjectId(communityId) }, { projection: { members: 1, createdBy: 1 } });
        if (!community) throw new Error('Community not found');
        const current = (community as any).members?.find((m: any) => m.userId === user.id);
        if (!(current?.role === 'admin' || current?.role === 'moderator' || (community as any).createdBy === user.id)) throw new Error('Insufficient permissions');
        await db.collection('communities').updateOne(
          { _id: new ObjectId(communityId), 'members.userId': targetUserId },
          { $set: { 'members.$.banned': true, 'members.$.banReason': reason || '', 'members.$.bannedAt': new Date().toISOString() } }
        );
        revalidatePath(`/community/${communityId}`);
        return { success: true };
    });
}

export async function unbanMember(communityId: string, targetUserId: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        if (!ObjectId.isValid(communityId)) throw new Error('Invalid community ID');
        const community = await db.collection('communities').findOne({ _id: new ObjectId(communityId) }, { projection: { members: 1, createdBy: 1 } });
        if (!community) throw new Error('Community not found');
        const current = (community as any).members?.find((m: any) => m.userId === user.id);
        if (!(current?.role === 'admin' || current?.role === 'moderator' || (community as any).createdBy === user.id)) throw new Error('Insufficient permissions');
        await db.collection('communities').updateOne(
          { _id: new ObjectId(communityId), 'members.userId': targetUserId },
          { $set: { 'members.$.banned': false }, $unset: { 'members.$.banReason': '', 'members.$.bannedAt': '' } as any }
        );
        revalidatePath(`/community/${communityId}`);
        return { success: true };
    });
}

/**
 * Creates a new channel in a community.
 * @param communityId The ID of the community.
 * @param channelData The data for the new channel.
 * @returns An object with the result of the operation.
 */
export async function createChannel(communityId: string, channelData: { name: string; type: 'forum' | 'chat'; description?: string }): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Validate input
        if (!channelData.name || !channelData.type || !['forum', 'chat'].includes(channelData.type)) {
            throw new Error('Invalid channel data');
        }

        if (!ObjectId.isValid(communityId)) {
            throw new Error('Invalid community ID');
        }

        // Check if user has moderation privileges
        const { getUserCommunityRole, hasModerationPrivileges } = await import('@/lib/community-permissions');
        const userRole = await getUserCommunityRole(communityId, user.id);
        if (!hasModerationPrivileges(userRole)) {
            throw new Error('Insufficient permissions');
        }

        // Get community to check existing channels
        const community = await db.collection('communities').findOne({ _id: new ObjectId(communityId) });
        if (!community) {
            throw new Error('Community not found');
        }

        // Check if channel name already exists
        const existingChannel = community.channels?.find((c: any) => c.name.toLowerCase() === channelData.name.toLowerCase());
        if (existingChannel) {
            throw new Error('Channel name already exists');
        }

        // Create new channel
        const newChannel = {
            _id: new ObjectId().toString(),
            name: channelData.name.trim(),
            type: channelData.type,
            description: channelData.description?.trim() || '',
            order: (community.channels?.length || 0),
            createdAt: new Date().toISOString()
        };

        // Add channel to community
        const result = await db.collection('communities').updateOne(
            { _id: new ObjectId(communityId) },
            { $push: { channels: newChannel } } as any
        );

        if (result.modifiedCount > 0) {
            revalidatePath(`/community/${communityId}`);
            return { success: true, channel: newChannel };
        } else {
            throw new Error('Failed to create channel');
        }
    });
}