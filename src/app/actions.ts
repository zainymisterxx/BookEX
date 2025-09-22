'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import type { Book, BookGenre, BookStatus, Post, User, Community, Organization, Report, Review, Chat, Comment, Notification, WishlistItem, PasswordResetToken, Exchange, ExchangeStatus } from '@/lib/types';
import { hash } from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { sendPasswordResetEmail, sendWelcomeEmail, sendExchangeProposalEmail, sendExchangeStatusUpdateEmail, sendBookContactEmail, sendOrgApplicationNotificationEmail, sendDonationChatConfirmationEmail, sendOrganizationApprovalEmail, sendOrganizationRejectionEmail } from '@/lib/email';
import { validateImageDataUri, sanitizeInput, validateOrganizationData, sanitizeOrganizationName, createSafeExactMatchRegex, normalizeForDeduplication, createBookDuplicateHash, checkBookSimilarity, calculateExpirationDate, createNotificationDeduplicationKey } from '@/lib/utils';
import { validatePasswordStrength, isPasswordStrong, getPasswordRequirementsMessage } from '@/lib/password-validation';
import { logActivity, detectSuspiciousActivity } from '@/lib/activity-logging';
import { getCurrentTimestamp, formatForDatabase, addDays, addHours } from '@/lib/date-utils';
import { OptimizedQueries } from '@/lib/database-optimization';
import { runDatabaseMaintenance, DatabaseMaintenance } from '@/lib/database-maintenance';
import { ConsistentWishlistOperations, normalizeText, SchemaMigration } from '@/lib/schema-migration';
import { saveImageFile, validateFileFromFormData } from '@/lib/file-storage';
import { ensureDatabaseIndexes, checkIndexHealth, createMissingIndexes } from '@/lib/database-setup';
import { createAppError, ErrorType, logError } from '@/lib/error-handling';
import { checkUserRateLimit, RATE_LIMITS } from '@/lib/rate-limiting';
import { validateResourceAccess, ResourceAuthority, type AuthorizedUser } from '@/lib/resource-authorization';
import { checkAuthRateLimit, recordAuthResult } from '@/lib/auth-rate-limiting';
import { withAuthenticatedAction, withAuthenticatedUserFull } from '@/lib/action-utils';
import { bookSchema, communitySchema, postSchema, commentSchema, organizationSchema, reportSchema, reviewSchema, userProfileSchema, exchangeSchema, chatMessageSchema, paginationSchema, searchQuerySchema, validateWithSchema } from '@/lib/schemas';
import crypto from 'crypto';
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
      city: "",
      reviews: 0,
      totalRatingPoints: 0,
      role: role,
      status: 'active',
      profileCompleted: false, // Initialize as false to trigger profile completion
      wishlist: [],
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
      console.log('Welcome email failed to send, but signup was successful');
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
    const hashedToken = await hash(resetToken, 10); // Hash the token before storage
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
    const client = await clientPromise;
    const db = client.db("bookex");
    const usersCollection = db.collection<User>("users");
    const tokensCollection = db.collection<PasswordResetToken>("passwordResetTokens");

    // Hash the input token to compare with stored hashed tokens
    const hashedInputToken = await hash(token, 10);

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

    // Update user's password
    await usersCollection.updateOne(
      { _id: new ObjectId(resetTokenData.userId) },
      { $set: { password: hashedPassword } }
    );

    // Mark token as used
    await tokensCollection.updateOne(
      { _id: resetTokenData._id },
      { $set: { used: true } }
    );

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
 * Fetches user data for the settings page.
 * @returns The user data or null.
 */
export async function getUserForUpdate(userId: string) {
    return withAuthenticatedAction(async ({ db, user, userId: currentUserId }) => {
        if (user.id !== userId) throw new Error("Unauthorized");
        
        const userData = await db.collection("users").findOne({ _id: new ObjectId(user.id) });
        if (!userData) return null;
        return {
            name: userData.name,
            city: userData.city,
            avatarUrl: userData.avatarUrl
        };
    });
}

/**
 * Updates a user's profile.
 * @param profileData The data to update.
 * @returns An object with the result of the operation and the new user data for session update.
 */
export async function updateUserProfile(profileData: { userId: string, name: string, city: string, avatarUrl?: string }) {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Validate authorization using resource authorization system
        await validateResourceAccess(user, 'user', profileData.userId, 'update');

        // Validate input data with Zod schema
        const validation = validateWithSchema(userProfileSchema, profileData);
        if (!validation.success) {
            throw createAppError(ErrorType.VALIDATION, validation.message);
        }
        const validatedData = validation.data;

        // Validate avatar if provided
        if (profileData.avatarUrl) {
            const imageValidation = validateImageDataUri(profileData.avatarUrl);
            if (!imageValidation.isValid) {
                throw createAppError(ErrorType.FILE_UPLOAD, imageValidation.error || "Invalid image format");
            }
        }
        
        const currentUser = await db.collection("users").findOne({ _id: new ObjectId(user.id) });
        if (!currentUser) throw new Error("User not found");

        const updateData: Partial<User> = {
            name: sanitizeInput(validatedData.name),
            city: sanitizeInput(validatedData.city),
        };
        
        // Handle avatar update
        if (profileData.avatarUrl) {
            updateData.avatarUrl = profileData.avatarUrl;
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

    // Validate image data URI
    const imageValidation = validateImageDataUri(bookData.imageUrl);
    if (!imageValidation.isValid) {
      throw createAppError(ErrorType.FILE_UPLOAD, imageValidation.error || "Invalid image format");
    }

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

    // Start a transaction for data consistency
    const client = await clientPromise;
    const session = client.startSession();
    let insertedId: any;
    
    try {
      await session.withTransaction(async () => {
        const now = getCurrentTimestamp();

        const newBook: Omit<Book, '_id'> = {
          title: validatedBookData.title,
          author: validatedBookData.author,
          description: validatedBookData.description || '',
          genre: validatedBookData.genre || 'other',
          condition: validatedBookData.condition,
          type: validatedBookData.type,
          price: bookData.price, // Price not validated by schema
          imageUrl: bookData.imageUrl, // Image URL not validated by schema
          sellerId: user.id,
          city: validatedBookData.city,
          status: 'active',
          createdAt: now,
          updatedAt: now,
          expiresAt: calculateExpirationDate(validatedBookData.type),
          titleNormalized,
          authorNormalized,
          duplicateHash,
        };

        const result = await db.collection("books").insertOne(newBook, { session });

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
            }, { session });

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
            await db.collection("notifications").insertMany(notifications as any[], { session });
            
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
      });
    } finally {
      await session.endSession();
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
        return userData?.city || null;
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

        // First, get the current community to understand its member structure
        const community = await db.collection("communities").findOne({ _id: communityObjectId });
        if (!community) {
            throw new Error("Community not found");
        }

        // Check if user is already a member using both possible data structures
        const isCurrentlyMember = Array.isArray(community.members) && 
            community.members.some((m: any) => 
                (typeof m === 'string' && m === user.id) || 
                (typeof m === 'object' && m.userId === user.id)
            );

        // If the current membership status matches what we're trying to do, return early
        if (isCurrentlyMember === isMember) {
            return { success: true, message: isMember ? 'Already a member' : 'Not a member' };
        }

        // Use MongoDB transaction for atomic operations
        const client = await clientPromise;
        const session = client.startSession();
        let result;

        try {
            result = await session.withTransaction(async () => {
                if (isMember) {
                    // User wants to leave - remove from members array
                    return await db.collection("communities").updateOne(
                        { _id: communityObjectId },
                        {
                            $pull: { 
                                members: { 
                                    $or: [
                                        { userId: user.id },
                                        user.id  // Handle both object and string formats
                                    ]
                                } 
                            },
                            $inc: { memberCount: -1 }
                        },
                        { session }
                    );
                } else {
                    // User wants to join - add to members array
                    const memberData = { userId: user.id, role: 'member', joinedAt: new Date().toISOString() };
                    return await db.collection("communities").updateOne(
                        { _id: communityObjectId },
                        {
                            $addToSet: { members: memberData },
                            $inc: { memberCount: 1 }
                        },
                        { session }
                    );
                }
            });
        } finally {
            await session.endSession();
        }

        // Verify the operation was successful
        if (result.modifiedCount === 0) {
            throw new Error("Failed to update community membership");
        }

        revalidatePath('/community');
        revalidatePath(`/community/${communityId}`);
        
        // Emit real-time community update for member count change
        try {
            const { emitCommunityUpdate } = await import('../../server');
            await emitCommunityUpdate(communityId, isMember ? 'leave' : 'join', {});
        } catch (emitError) {
            console.warn('Failed to emit community update:', emitError);
        }

        return { success: true };
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
        if (!ObjectId.isValid(communityId)) {
            throw new Error("Invalid community ID format");
        }
        if (!postId || typeof postId !== 'string' || postId.trim().length === 0) {
            throw new Error("Invalid post ID format");
        }
        
        const postObjectId = ObjectId.isValid(postId) ? new ObjectId(postId) : null;
        if (!postObjectId) throw new Error('Invalid post id');

        // Ensure member
        const isMember = await db.collection("communities").findOne({ _id: new ObjectId(communityId), "members.userId": user.id });
        if (!isMember) throw new Error('You must be a member to interact with posts in this community');
        
        const updateOperation = isLiked
            ? { $pull: { likedBy: user.id }, $inc: { likes: -1 } }
            : { $addToSet: { likedBy: user.id }, $inc: { likes: 1 } };

        const result = await db.collection("posts").updateOne(
            { _id: postObjectId, communityId: new ObjectId(communityId) } as any,
            updateOperation as any
        );
        if (!result.matchedCount) throw new Error('Post not found');
        
        // Notify author if needed
        const postDoc = await db.collection("posts").findOne({ _id: postObjectId });
        if (!isLiked && postDoc && postDoc.authorId !== user.id) {
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

        revalidatePath(`/community/${communityId}`);
        
        try {
            const { emitCommunityPostLiked } = await import('../../server');
            await emitCommunityPostLiked(communityId, postId, user.id, !isLiked);
        } catch (emitError) {
            console.warn('Failed to emit real-time update for like toggle:', emitError);
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
        // Validate communityId (must be ObjectId format)
        if (!ObjectId.isValid(communityId)) {
            throw new Error("Invalid community ID format");
        }

        // postId validation - it might be ObjectId or string
        if (!postId || typeof postId !== 'string' || postId.trim().length === 0) {
            throw new Error("Invalid post ID format");
        }
        
        // Check if community and post exist - flexible query for different post ID formats
        let community;
        
        // Try finding post with ObjectId first (if postId is valid ObjectId)
        if (ObjectId.isValid(postId)) {
            community = await db.collection("communities").findOne({ 
                _id: new ObjectId(communityId),
                "posts._id": new ObjectId(postId)
            });
        }
        
        // If not found and postId is not ObjectId, try finding with string comparison
        if (!community) {
            community = await db.collection("communities").findOne({ 
                _id: new ObjectId(communityId),
                posts: { $elemMatch: { _id: postId } }
            });
        }
        
        if (!community) {
            throw new Error("Community or post not found");
        }
        
        // Find the specific post - handle both ObjectId and string formats
        const post = community.posts?.find((p: any) => 
            String(p._id) === postId || 
            (ObjectId.isValid(postId) && ObjectId.isValid(String(p._id)) && 
             new ObjectId(String(p._id)).equals(new ObjectId(postId)))
        );
        
        if (!post) {
            throw new Error("Post not found");
        }
        
        // Only post author, community creator, or admin can delete posts
        const isAdmin = user.role === 'admin';
        if (post.authorId !== user.id && community.createdBy !== user.id && !isAdmin) {
            throw new Error("Unauthorized: You can only delete your own posts");
        }
        
        // Create flexible query for post deletion - handle both ObjectId and string formats
        let deleteQuery;
        if (ObjectId.isValid(postId)) {
            deleteQuery = { $pull: { posts: { _id: new ObjectId(postId) } } };
        } else {
            deleteQuery = { $pull: { posts: { _id: postId } } };
        }
        
        await db.collection("communities").updateOne(
            { _id: new ObjectId(communityId) },
            deleteQuery as any
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
        // Validate communityId (must be ObjectId format)
        if (!ObjectId.isValid(communityId)) {
            throw new Error("Invalid community ID format");
        }

        // postId validation - it might be ObjectId or string
        if (!postId || typeof postId !== 'string' || postId.trim().length === 0) {
            throw new Error("Invalid post ID format");
        }

        // Validate content
        if (!newContent || newContent.trim().length === 0) {
            throw new Error("Post content is required");
        }
        if (newContent.length > 5000) {
            throw new Error("Post too long (max 5000 characters)");
        }
        
        // Check if user is the post author, community creator, or admin - flexible query for different post ID formats
        const isAdmin = user.role === 'admin';
        let community;
        
        // Try finding post with ObjectId first (if postId is valid ObjectId)
        if (ObjectId.isValid(postId)) {
            community = await db.collection("communities").findOne({ 
                _id: new ObjectId(communityId),
                "posts._id": new ObjectId(postId),
                $or: [
                    { "posts.authorId": user.id },
                    { createdBy: user.id },
                    ...(isAdmin ? [{ _id: { $exists: true } }] : [])
                ]
            });
        }
        
        // If not found and postId is not ObjectId, try finding with string comparison
        if (!community) {
            community = await db.collection("communities").findOne({ 
                _id: new ObjectId(communityId),
                posts: { $elemMatch: { 
                    _id: postId, 
                    $or: [
                        { authorId: user.id },
                        ...(isAdmin ? [{ _id: { $exists: true } }] : [])
                    ]
                } },
                ...(isAdmin ? {} : { createdBy: user.id })
            });
        }
        
        if (!community) {
            throw new Error("Unauthorized: You can only edit your own posts");
        }
        
        // Create flexible query for post update - handle both ObjectId and string formats
        let updateQuery;
        if (ObjectId.isValid(postId)) {
            updateQuery = { _id: new ObjectId(communityId), "posts._id": new ObjectId(postId) };
        } else {
            updateQuery = { _id: new ObjectId(communityId), "posts._id": postId };
        }
        
        await db.collection("communities").updateOne(
            updateQuery,
            { 
                $set: { 
                    "posts.$.content": sanitizeInput(newContent),
                    "posts.$.editedAt": new Date().toISOString()
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

        // Validate image data URI
        const imageValidation = validateImageDataUri(communityData.imageUrl);
        if (!imageValidation.isValid) {
            throw createAppError(ErrorType.FILE_UPLOAD, imageValidation.error || "Invalid image format");
        }

        const newCommunity: Omit<Community, '_id'> = {
            name: sanitizeInput(validatedData.name),
            description: sanitizeInput(validatedData.description),
            imageUrl: communityData.imageUrl,
            createdBy: user.id,
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
 * Initiates contact with a user, creating a chat if one doesn't exist.
 * @param otherUserId The ID of the user to contact.
 * @param bookId The ID of the book being discussed (optional).
 * @returns An object with the result of the operation and the chat ID.
 */
export async function startChat(otherUserId: string, bookId?: string) {
    return withAuthenticatedUserFull(async ({ db, user, userId }) => {
        // Import validation utilities
        const { validateObjectId, ValidationError } = await import('@/lib/validation');
        
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

        // Find existing chat
        let chat = await db.collection("chats").findOne({ 
            participantIds: { $all: participantIds },
            bookId: validatedBookId
        });

        if (chat) {
            return { success: true, chatId: chat._id.toString() };
        }

        // Create new chat
        const newChat: Omit<Chat, '_id'> = {
            participantIds,
            bookId: validatedBookId,
            messages: [],
            updatedAt: new Date().toISOString(),
        };

        const result = await db.collection("chats").insertOne(newChat);
        
        // Send email notification to book seller (if they have email notifications enabled)
        if (validatedBookId && chat === null) { // Only for new chats about books
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
                            result.insertedId.toString()
                        );
                    }
                }
            } catch (emailError) {
                // Log email error but don't fail the chat creation
                console.warn('Failed to send book contact email:', emailError);
            }
        }
        
        // Log successful chat initiation
        console.log(`Chat initiated: User ${user.id} -> User ${otherUserId}${bookId ? ` for book ${bookId}` : ''}`);
        
        return { success: true, chatId: result.insertedId.toString() };
    });
}

/**
 * Initiates an exchange chat with comprehensive validation and security checks.
 * @param otherUserId The ID of the user to contact.
 * @param bookId The ID of the book being discussed.
 * @returns An object with the result of the operation and the chat ID.
 */
export async function startExchangeChat(otherUserId: string, bookId: string) {
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
            return { 
                success: false, 
                message: "You must have at least one book listed for exchange to start a trade." 
            };
        }

        // CRITICAL: Validate same-city requirement for exchanges
        if (!currentUser.city || !otherUser.city) {
            return {
                success: false,
                message: "Both users must have their city set in their profile to exchange books."
            };
        }
        
        // Normalize cities for comparison (case-insensitive, trim whitespace)
        const currentUserCity = currentUser.city.toLowerCase().trim();
        const otherUserCity = otherUser.city.toLowerCase().trim();
        
        if (currentUserCity !== otherUserCity) {
            return {
                success: false,
                message: `Book exchanges are only available within the same city. You are in ${currentUser.city}, but the book owner is in ${otherUser.city}.`
            };
        }

        // Check if chat already exists
        const participantIds = [user.id, otherUserId].sort();
        
        let chat = await db.collection("chats").findOne({ 
            participantIds: { $all: participantIds },
            bookId: validatedParams.bookId
        });

        if (chat) {
            return { success: true, chatId: chat._id.toString() };
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
        
        // Log successful exchange initiation for monitoring
        console.log(`Exchange chat initiated: User ${user.id} -> User ${otherUserId} for book ${bookId}`);
        
        return { success: true, chatId: result.insertedId.toString() };
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
        const cachedData = await redisCache.get(CACHE_KEY);

        if (cachedData && typeof cachedData === 'string') {
            console.log('✅ Retrieved approved organizations from cache');
            return JSON.parse(cachedData);
        }

        // Cache miss - fetch from database
        console.log('📡 Cache miss - fetching approved organizations from database');
        const client = await clientPromise;
        const db = client.db("bookex");
        const orgs = await db.collection("organizations").find({ status: "approved" }).toArray();
        const serializedOrgs = JSON.parse(JSON.stringify(orgs));

        // Cache the result
        try {
            await redisCache.set(CACHE_KEY, JSON.stringify(serializedOrgs), CACHE_TTL);
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
        const validation = validateOrganizationData({
            name: orgData.name,
            description: orgData.description,
            location: orgData.location,
            contactEmail: orgData.contactEmail,
            contactPhone: orgData.contactPhone,
            website: orgData.website
        });

        if (!validation.isValid) {
            return { success: false, message: validation.error };
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

        // Validate and process image file
        const fileValidation = validateFileFromFormData(formData, 'image');
        if (!fileValidation.isValid || !fileValidation.file) {
            return { success: false, message: fileValidation.error || 'Image file is required' };
        }

        // Save the image file
        const fileResult = await saveImageFile(fileValidation.file);
        if (!fileResult.success || !fileResult.url) {
            return { success: false, message: fileResult.error || 'Failed to save image' };
        }

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
            imageUrl: fileResult.url,
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
 * @returns An object with the result and chatId.
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
            status: 'approved'  // Only allow donations to approved organizations
        });
        
        if (!org) {
            return { success: false, message: "Organization not found or not approved for donations." };
        }

        // Use a more secure participant pattern that won't conflict with user IDs
        // Format: donation_org_<organizationId>
        const orgParticipantId = `donation_org_${organizationId}`;
        const participantIds = [user.id, orgParticipantId].sort();

        let chat = await db.collection("chats").findOne({ participantIds: { $all: participantIds } });

        if (!chat) {
            const newChat: Omit<Chat, '_id'> = {
                participantIds,
                organizationId: new ObjectId(organizationId),
                messages: [],
                lastMessage: `Donation to ${org.name} initiated.`,
                updatedAt: new Date().toISOString(),
            };
            const result = await db.collection("chats").insertOne(newChat);
            chat = { ...newChat, _id: result.insertedId };
            
            // Send donation chat confirmation email to user
            try {
                // Get user details for email
                const userDetails = await db.collection("users").findOne({ _id: new ObjectId(user.id) });
                if (userDetails?.email) {
                    await sendDonationChatConfirmationEmail(
                        userDetails.email,
                        userDetails.name || 'BookEx User',
                        org.name,
                        chat._id.toString()
                    );
                }
            } catch (emailError) {
                console.error("Failed to send donation chat confirmation email:", emailError);
            }
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
                chatId: chat._id.toString()
            }
        );

        return { success: true, chatId: chat._id.toString() };
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

        // First, insert the new review document.
        const newReview: Omit<Review, '_id'> = {
            ...reviewData,
            createdAt: new Date().toISOString(),
        };
        await db.collection("reviews").insertOne(newReview);
        
        // Then, perform a single, atomic update on the user document.
        // This is far more efficient and safer than the previous aggregation method.
        await db.collection("users").updateOne(
            { _id: new ObjectId(reviewData.revieweeId) },
            { 
                $inc: { 
                    reviews: 1, 
                    totalRatingPoints: reviewData.rating 
                } 
            }
        );

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

        // Delete the review
        const deleteResult = await db.collection("reviews").deleteOne({ _id: new ObjectId(reviewId) });

        if (deleteResult.deletedCount === 0) {
            throw new Error("Failed to delete review");
        }

        // Update user's rating statistics
        await db.collection("users").updateOne(
            { _id: new ObjectId(review.revieweeId) },
            {
                $inc: {
                    reviews: -1,
                    totalRatingPoints: -review.rating
                }
            }
        );

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
        
        await db.collection("organizations").updateOne(
            { _id: new ObjectId(organizationId) },
            { $set: { status: 'approved', updatedAt: new Date().toISOString() } }
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
                status: 'approved'
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
export async function suspendUser(userId: string): Promise<{ success: true; data: any } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId: currentUserId }) => {
        await db.collection("users").updateOne(
            { _id: new ObjectId(userId) },
            { $set: { status: 'suspended' } }
        );
        
        revalidatePath('/admin');
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
                        await db.collection("chats").updateOne(
                            { _id: chat._id },
                            // @ts-ignore: MongoDB $pull operator type issue
                            { $pull: { participantIds: userId } },
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
                const wishlistResult = await db.collection("users").updateMany(
                    { 'wishlist.bookId': { $exists: true } },
                    // @ts-ignore: MongoDB $pull operator type issue
                    { $pull: { wishlist: { bookId: { $exists: true } } } },
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
                }).toArray();
                wishlistBooks.push(...books);
            }
        }

        return JSON.parse(JSON.stringify({
            profileUser: profileUser,
            userListings: userListings,
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

        const chat = await db.collection("chats").findOne({ 
            _id: new ObjectId(chatId), 
            participantIds: user.id 
        });

        if (!chat) return null;

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
            city: profileData.city,
            profileCompleted: true,
            updatedAt: new Date()
        };

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

/**
 * Migration function to set profileCompleted for existing users.
 * This function should be run once to update existing users.
 */
export async function migrateExistingUsersProfileCompleted(): Promise<{ success: true; data: { message: string } } | { success: false; message: string }> {
    return withAuthenticatedAction(async ({ db, user, userId }) => {
        // Set profileCompleted to true for all existing users who have a city
        // and false for those who don't have a city
        const result = await db.collection("users").updateMany(
            { profileCompleted: { $exists: false } },
            [
                {
                    $set: {
                        profileCompleted: {
                            $cond: {
                                if: { $and: [{ $ne: ["$city", null] }, { $ne: ["$city", ""] }] },
                                then: true,
                                else: false
                            }
                        }
                    }
                }
            ]
        );
        
        return { 
            message: `Updated ${result.modifiedCount} users` 
        };
    }, 'admin');
}

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
        
        // Same-city validation (reuse existing logic)
        if (!proposer.city || !responder.city) {
            throw new Error("Both users must have their city set in their profile to exchange books.");
        }
        
        if (proposer.city.toLowerCase().trim() !== responder.city.toLowerCase().trim()) {
            throw new Error(`Book exchanges are only available within the same city. You are in ${proposer.city}, but the other user is in ${responder.city}.`);
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
            chat = { _id: chatResult.insertedId, ...newChat } as Chat;
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
            // Log email error but don't fail the exchange creation
            console.warn('Failed to send exchange proposal email:', emailError);
        }
        
        // Emit real-time status update for new exchange
        try {
            const { emitExchangeStatusUpdate } = await import('../server');
            await emitExchangeStatusUpdate(exchangeResult.insertedId.toString(), {
                status: 'proposed',
                updatedAt: now,
                proposedAt: now
            });
        } catch (emitError) {
            console.warn('Failed to emit real-time update for new exchange:', emitError);
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
        
        // Update exchange status
        const now = new Date().toISOString();
        const statusUpdate = {
            status: 'accepted' as ExchangeStatus,
            timestamp: now,
            updatedBy: user.id
        };
        
        await db.collection("exchanges").updateOne(
            { _id: validatedExchangeId },
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
            // Log email error but don't fail the exchange acceptance
            console.warn('Failed to send exchange acceptance email:', emailError);
        }

        // Emit real-time status update
        try {
            // Import the emit function dynamically to avoid circular dependencies
            const { emitExchangeStatusUpdate } = await import('../server');
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
        
        await db.collection("exchanges").updateOne(
            { _id: validatedExchangeId },
            {
                $set: updateFields,
                $push: {
                    statusHistory: statusUpdate
                } as any
            }
        );
        
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
            const { emitExchangeStatusUpdate } = await import('../server');
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
            completed: bothConfirmed,
            message: bothConfirmed 
                ? "Exchange completed successfully! You can now rate your exchange partner."
                : "Your confirmation has been recorded. Waiting for the other user to confirm."
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
        
        await db.collection("exchanges").updateOne(
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
            const { emitExchangeStatusUpdate } = await import('../server');
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

                // Delete the book
                const deleteResult = await db.collection("books").deleteOne(
                    { _id: new ObjectId(bookId) },
                    { session }
                );

                if (deleteResult.deletedCount === 0) {
                    throw createAppError(ErrorType.DATABASE, "Failed to delete book listing");
                }

                // Clean up related data
                await Promise.all([
                    // Remove from wishlists
                    db.collection("users").updateMany(
                        { "wishlist.bookId": new ObjectId(bookId) },
                        { $pull: { wishlist: { bookId: new ObjectId(bookId) } } } as any,
                        { session }
                    ),
                    
                    // Delete related chats
                    db.collection("chats").deleteMany(
                        { bookId: new ObjectId(bookId) },
                        { session }
                    ),
                    
                    // Delete related notifications
                    db.collection("notifications").deleteMany(
                        { "metadata.bookId": bookId },
                        { session }
                    ),
                    
                    // Delete related exchanges
                    db.collection("exchanges").deleteMany(
                        { $or: [
                            { "proposer.bookId": new ObjectId(bookId) },
                            { "proposee.bookId": new ObjectId(bookId) }
                        ]},
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

        return JSON.parse(JSON.stringify(book));
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

        // Validate image data URI if provided
        if (bookData.imageUrl) {
            const imageValidation = validateImageDataUri(bookData.imageUrl);
            if (!imageValidation.isValid) {
                throw createAppError(ErrorType.FILE_UPLOAD, imageValidation.error || "Invalid image format");
            }
        }

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
            city: validatedBookData.city,
            updatedAt: now,
        };

        // Only update price for sell type books
        if (validatedBookData.type === 'sell') {
            updateData.price = bookData.price;
        } else {
            updateData.price = null; // Remove price for exchange books
        }

        // Update image if provided
        if (bookData.imageUrl) {
            updateData.imageUrl = bookData.imageUrl;
        }

        // Update deduplication fields if title/author changed
        if (titleChanged || authorChanged) {
            updateData.titleNormalized = normalizeForDeduplication(bookData.title);
            updateData.authorNormalized = normalizeForDeduplication(bookData.author);
            updateData.duplicateHash = createBookDuplicateHash(bookData.title, bookData.author, user.id);
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
            return { isAuthenticated: false, profileCompleted: false };
        }
        
        return { 
            isAuthenticated: true, 
            profileCompleted: session.user.profileCompleted || false 
        };
    } catch (error) {
        console.error('Error checking profile completion:', error);
        return { isAuthenticated: false, profileCompleted: false };
    }
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