import { z } from 'zod';

const publicImageUrlSchema = z
  .string()
  .min(1, 'Image URL is required')
  .refine((value) => /^https?:\/\//i.test(value) || /^\/uploads\/(books|profiles|communities|temp)\/[A-Za-z0-9._-]+$/i.test(value), {
    message: 'Image URL must be a valid remote URL or an uploaded file path',
  });

const optionalPublicImageUrlSchema = publicImageUrlSchema.optional();

// Book Genre enum
export const BookGenreSchema = z.enum(['fantasy', 'sci-fi', 'mystery', 'romance', 'self-help', 'historical-fiction', 'other']);

// Book Condition enum
export const BookConditionSchema = z.enum(['new', 'like-new', 'used', 'worn']);

// Book Type enum
export const BookTypeSchema = z.enum(['sell', 'exchange']);

// Book Status enum
export const BookStatusSchema = z.enum(['active', 'sold', 'exchanged', 'inactive', 'expired']);

// Community Role enum
export const CommunityRoleSchema = z.enum(['admin', 'moderator', 'member']);

// Report Status enum
export const ReportStatusSchema = z.enum(['pending', 'resolved', 'dismissed']);

// Report Content Type enum
export const ReportContentTypeSchema = z.enum(['book', 'user', 'post', 'comment', 'community']);

// Exchange Status enum
export const ExchangeStatusSchema = z.enum(['proposed', 'accepted', 'in_progress', 'completed', 'cancelled', 'disputed']);

// User Role enum
export const UserRoleSchema = z.enum(['user', 'admin']);

// User Status enum
export const UserStatusSchema = z.enum(['active', 'suspended', 'deactivated']);

// Book Schema
export const bookSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .trim(),
  author: z.string()
    .min(1, 'Author is required')
    .max(150, 'Author name must be 150 characters or less')
    .trim(),
  description: z.string()
    .max(1000, 'Description must be 1000 characters or less')
    .trim()
    .optional(),
  genre: BookGenreSchema.optional(),
  condition: BookConditionSchema,
  type: BookTypeSchema,
  price: z.number()
    .positive('Price must be positive')
    .optional(),
  imageUrl: optionalPublicImageUrlSchema,
  city: z.string()
    .min(1, 'City is required')
    .max(100, 'City name must be 100 characters or less')
    .trim(),
  status: BookStatusSchema.optional().default('active'),
  // Server-side deduplication fields — optional so schema can validate full documents
  titleNormalized: z.string().optional(),
  authorNormalized: z.string().optional(),
  duplicateHash: z.string().optional(),
}).refine((data) => {
  // If type is 'sell', price must be provided and positive
  if (data.type === 'sell' && (!data.price || data.price <= 0)) {
    return false;
  }
  return true;
}, {
  message: "Price is required and must be positive when book type is 'sell'",
  path: ['price']
});

// Community Schema
export const communitySchema = z.object({
  name: z.string()
    .min(3, 'Community name must be at least 3 characters')
    .max(50, 'Community name must be 50 characters or less')
    .trim(),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be 500 characters or less')
    .trim(),
  imageUrl: optionalPublicImageUrlSchema,
  createdBy: z.string()
    .min(1, 'Creator ID is required')
});

// Post Schema
export const postSchema = z.object({
  content: z.string()
    .min(1, 'Post content is required')
    .max(5000, 'Post content must be 5000 characters or less')
    .trim(),
  authorId: z.string()
    .min(1, 'Author ID is required'),
  communityId: z.string()
    .min(1, 'Community ID is required')
});

// Donation Book Schema
export const donationBookSchema = z.object({
  bookId: z.string().optional(),
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .trim(),
  author: z.string()
    .min(1, 'Author is required')
    .max(150, 'Author must be 150 characters or less')
    .trim(),
  condition: BookConditionSchema,
  quantity: z.number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be at least 1')
    .max(1000, 'Quantity seems unusually high'),
  notes: z.string()
    .max(500, 'Notes must be 500 characters or less')
    .optional()
});

// Donation Status Update Schema
export const donationStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected']),
  notes: z.string()
    .max(1000, 'Notes must be 1000 characters or less')
    .optional(),
  pickupDate: z.string().optional(),
  pickupLocation: z.string()
    .max(500, 'Location must be 500 characters or less')
    .optional(),
  deliveryMethod: z.enum(['donor_delivers', 'org_picks_up']).optional()
});

// Organization Representative Schema
export const organizationRepresentativeSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['admin', 'member'])
});

// Comment Schema
export const commentSchema = z.object({
  content: z.string()
    .min(1, 'Comment content is required')
    .max(1000, 'Comment content must be 1000 characters or less')
    .trim(),
  postId: z.string()
    .min(1, 'Post ID is required'),
  parentId: z.string()
    .optional()
});

// Organization Schema
export const organizationSchema = z.object({
  name: z.string()
    .min(3, 'Organization name must be at least 3 characters')
    .max(100, 'Organization name must be 100 characters or less')
    .trim(),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description must be 1000 characters or less')
    .trim(),
  location: z.string()
    .min(1, 'Location is required')
    .max(200, 'Location must be 200 characters or less')
    .trim(),
  imageUrl: optionalPublicImageUrlSchema,
  contactEmail: z.string()
    .email('Contact email must be valid')
    .optional(),
  contactPhone: z.string()
    .max(20, 'Phone number must be 20 characters or less')
    .optional(),
  website: z.string()
    .url('Website must be valid URL')
    .optional(),
  submittedBy: z.string()
    .min(1, 'Submitter ID is required')
});

// Report Schema
export const reportSchema = z.object({
  reporterId: z.string()
    .min(1, 'Reporter ID is required'),
  reportedUserId: z.string()
    .min(1, 'Reported user ID is required'),
  reportedContentId: z.string()
    .min(1, 'Reported content ID is required'),
  reportedContentType: ReportContentTypeSchema,
  reason: z.string()
    .min(1, 'Report reason is required')
    .max(200, 'Reason must be 200 characters or less')
    .trim(),
  details: z.string()
    .max(1000, 'Details must be 1000 characters or less')
    .trim()
    .optional(),
  description: z.string()
    .max(1000, 'Description must be 1000 characters or less')
    .trim()
    .optional()
});

// Review Schema
export const reviewSchema = z.object({
  reviewerId: z.string()
    .min(1, 'Reviewer ID is required'),
  revieweeId: z.string()
    .min(1, 'Reviewee ID is required'),
  rating: z.number()
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5')
    .int('Rating must be a whole number'),
  comment: z.string()
    .min(1, 'Review comment is required')
    .max(1000, 'Comment must be 1000 characters or less')
    .trim()
});

// User Profile Schema
export const userProfileSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  city: z.string()
    .min(1, 'City is required')
    .max(100, 'City name must be 100 characters or less')
    .trim(),
  avatarUrl: optionalPublicImageUrlSchema,
  phone: z.string()
    .max(20, 'Phone number must be 20 characters or less')
    .optional(),
  bio: z.string()
    .max(500, 'Bio must be 500 characters or less')
    .trim()
    .optional(),
  interests: z.array(z.string())
    .max(10, 'Maximum 10 interests allowed')
    .optional(),
  birthDate: z.union([
    z.string().datetime('Birth date must be valid ISO string'),
    z.date({ message: 'Birth date must be a valid date' })
  ]).optional()
});

// Exchange Schema
export const exchangeSchema = z.object({
  proposerId: z.string()
    .min(1, 'Proposer ID is required'),
  responderId: z.string()
    .min(1, 'Responder ID is required'),
  proposerBookId: z.string()
    .min(1, 'Proposer book ID is required'),
  responderBookId: z.string()
    .min(1, 'Responder book ID is required'),
  proposalMessage: z.string()
    .max(1000, 'Proposal message must be 1000 characters or less')
    .trim()
    .optional(),
  meetingLocation: z.string()
    .max(200, 'Meeting location must be 200 characters or less')
    .trim()
    .optional()
});

// Chat Message Schema
export const chatMessageSchema = z.object({
  text: z.string()
    .min(1, 'Message text is required')
    .max(2000, 'Message text must be 2000 characters or less')
    .trim(),
  receiverId: z.string()
    .min(1, 'Receiver ID is required'),
  bookId: z.string()
    .optional(),
  organizationId: z.string()
    .optional()
});

// Pagination Schema
export const paginationSchema = z.object({
  page: z.number()
    .min(1, 'Page must be at least 1')
    .max(10000, 'Page must be at most 10000')
    .int('Page must be a whole number')
    .default(1),
  limit: z.number()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must be at most 100')
    .int('Limit must be a whole number')
    .default(12)
});

// Search Query Schema
export const searchQuerySchema = z.object({
  query: z.string()
    .max(200, 'Search query must be 200 characters or less')
    .trim()
    .optional(),
  genre: z.string()
    .max(50, 'Genre must be 50 characters or less')
    .trim()
    .optional(),
  condition: BookConditionSchema.optional(),
  city: z.string()
    .max(100, 'City must be 100 characters or less')
    .trim()
    .optional(),
  sortBy: z.enum(['newest', 'oldest', 'title-asc', 'title-desc', 'relevance', 'price-low', 'price-high'])
    .default('relevance')
});

// ─── Community Admin Schemas ──────────────────────────────────────────────────

export const PostingPermissionSchema = z.enum(['anyone', 'members_only', 'admins_only']);
export const CommentPermissionSchema = z.enum(['anyone', 'members_only', 'admins_only']);
export const InvitePermissionSchema  = z.enum(['anyone', 'admins_only']);

/** PATCH /api/communities/:id/settings */
export const communitySettingsSchema = z.object({
  name: z.string().min(3).max(50).trim().optional(),
  description: z.string().min(10).max(1000).trim().optional(),
  imageUrl: optionalPublicImageUrlSchema.or(z.literal('')),
  coverImage: optionalPublicImageUrlSchema.or(z.literal('')),
  rules: z.string().max(5000).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  postingPermissions: PostingPermissionSchema.optional(),
  commentPermissions: CommentPermissionSchema.optional(),
  invitePermissions: InvitePermissionSchema.optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

/** POST /api/communities/:id/members/:userId – promote / demote / remove */
export const memberActionSchema = z.object({
  action: z.enum(['promote', 'demote', 'remove']),
  targetRole: z.enum(['creator', 'admin', 'moderator', 'member']).optional(),
});

/** POST /api/communities/:id/ban */
export const banMemberSchema = z.object({
  targetUserId: z.string().min(1),
  reason: z.string().min(1, 'Reason is required').max(500),
});

/** POST /api/communities/:id/transfer-ownership */
export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().min(1, 'New owner ID is required'),
  confirmName: z.string().min(1, 'Community name confirmation is required'),
});

/** PATCH /api/communities/:id/join-requests/:requestId */
export const joinRequestActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
});

/** POST /api/communities/:id/posts/:postId/admin-actions */
export const postAdminActionSchema = z.object({
  action: z.enum(['pin', 'unpin', 'lock', 'unlock', 'delete']),
  reason: z.string().max(500).optional(),
});

/** DELETE /api/communities/:id/posts/:postId/comments/:commentId */
export const commentAdminActionSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ─── End Community Admin Schemas ──────────────────────────────────────────────

// Utility function to validate data with a schema
export function validateWithSchema<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: true;
  data: T;
} | {
  success: false;
  message: string;
  errors: ReturnType<z.ZodError['flatten']>;
} {
  try {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return {
        success: false,
        message: 'Invalid data provided',
        errors: result.error.flatten()
      };
    }
  } catch {
    return {
      success: false,
      message: 'Validation failed',
      errors: { fieldErrors: {}, formErrors: ['Validation error'] }
    };
  }
}
