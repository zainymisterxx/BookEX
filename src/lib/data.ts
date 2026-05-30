
import clientPromise from './mongodb';
import { Book, Community, Exchange, Organization, User } from './types';
import { ObjectId } from 'mongodb';
import { OptimizedQueries } from './database-optimization';
import redisCache from './redis-cache';

// Helper to serialize MongoDB documents
// Converts ObjectId to string and removes circular references for Next.js server components
const serialize = (data: any) => JSON.parse(JSON.stringify(data));

// Helper to calculate and format average rating
const calculateAverageRating = (user: User | null) => {
    if (!user) return user;
    const { totalRatingPoints = 0, reviews = 0 } = user;
    const averageRating = reviews > 0 ? totalRatingPoints / reviews : 0;
    // Round to one decimal place and convert to number
    user.averageRating = parseFloat(averageRating.toFixed(1));
    return user;
}


/**
 * Fetches the most recently listed books from MongoDB with optimized query.
 * @param count The number of recent listings to fetch.
 * @returns A promise that resolves to an array of Book objects.
 */
export async function getRecentListings(count: number): Promise<Book[]> {
  try {
    const client = await clientPromise;
    const db = client.db("bookex");
    
    // Only show active, non-expired books
    const now = new Date().toISOString();
    
    // Optimized query with index on status, expiresAt, and createdAt
    const books = await db.collection("books")
      .find({
        status: 'active',
        $or: [
          { expiresAt: { $exists: false } }, // Legacy books without expiration
          { expiresAt: { $gt: now } } // Non-expired books
        ]
      }, {
        projection: {
          title: 1,
          author: 1,
          description: 1,
          imageUrl: 1,
          price: 1,
          type: 1,
          condition: 1,
          genre: 1,
          cityNormalized: 1,
          city: 1,
          sellerId: 1,
          status: 1,
          createdAt: 1,
          expiresAt: 1
        }
      })
      .sort({ createdAt: -1 })
      .limit(Math.min(count, 50)) // Limit maximum to prevent abuse
      .toArray();
    
    // Attach display names for city where possible
    const { findCanonicalCity } = await import('./location/location-utils');
    const mapped = await Promise.all(books.map(async (b: any) => {
      const canon = await findCanonicalCity(b.cityNormalized || '');
      return {
        ...b,
        cityNormalized: canon?.normalized || b.cityNormalized || null,
        cityName: canon?.name || null
      };
    }));

    return serialize(mapped);
  } catch (error) {
    console.error("Error fetching recent listings:", error);
    return [];
  }
}

/**
 * Fetches the most popular communities based on member count from MongoDB with optimized query.
 * @param count The number of popular communities to fetch.
 * @returns A promise that resolves to an array of Community objects.
 */
export async function getPopularCommunities(count: number): Promise<Community[]> {
    try {
        const client = await clientPromise;
        const db = client.db("bookex");
        
        // Optimized query with index on memberCount and projection
        const communities = await db.collection("communities")
            .find({}, {
                projection: {
                    name: 1,
                    description: 1,
                    imageUrl: 1,
                    memberCount: 1,
                    createdBy: 1,
                    createdAt: 1
                }
            })
            .sort({ memberCount: -1, createdAt: -1 })
            .limit(Math.min(count, 20)) // Limit maximum to prevent abuse
            .toArray();

        return serialize(communities);
    } catch (error) {
        console.error("Error fetching popular communities:", error);
        return [];
    }
}


/**
 * Fetches details for a specific book and its seller from MongoDB with Redis caching.
 * @param id The ID of the book to fetch.
 * @returns A promise that resolves to an object containing the book and seller data, or null if not found.
 */
export async function getBookAndSellerDetails(id: string): Promise<{ book: Book; seller: User | null } | null> {
  try {
    if (!ObjectId.isValid(id)) {
        return null;
    }
    const client = await clientPromise;
    const db = client.db("bookex");
    const book = await db.collection("books").findOne({ _id: new ObjectId(id) });

    if (!book) {
      return null;
    }

    let seller: User | null = null;
      // Attach canonical city fields
      const { findCanonicalCity } = await import('./location/location-utils');
    
    if (book.sellerId && ObjectId.isValid(book.sellerId)) {
      // Try to get seller from cache first
      const sellerCacheKey = `user:${book.sellerId}`;
      const sellerCacheResult = await redisCache.get<User>(sellerCacheKey);

      if (sellerCacheResult.hit) {
        console.log(`✅ Cache hit for seller: ${book.sellerId}`);
        seller = sellerCacheResult.value;
      } else {
        console.log(`❌ Cache miss for seller: ${book.sellerId}, fetching from database`);
        seller = await db.collection<User>("users").findOne({ _id: new ObjectId(book.sellerId) });

        if (seller) {
          seller = calculateAverageRating(seller);
          // Cache seller data for 30 minutes
          await redisCache.set(sellerCacheKey, seller, 1800);
        }
      }
    }

      const b = serialize(book) as any;
      const bookCanon = await findCanonicalCity(b.cityNormalized || '');
      const bookOut = {
        ...b,
        cityNormalized: bookCanon?.normalized || b.cityNormalized || null,
        cityName: bookCanon?.name || null
      };

      const s = seller ? serialize(seller) : null;
      let sellerOut = null;
      if (s) {
        const sellerCanon = await findCanonicalCity(s.cityNormalized || '');
        sellerOut = { ...s, cityNormalized: sellerCanon?.normalized || s.cityNormalized || null, cityName: sellerCanon?.name || null };
      }

      return { book: bookOut, seller: sellerOut };
  } catch (error) {
    console.error("Error fetching book and seller details:", error);
    return null;
  }
}/**
 * Fetches the profile data and book listings for a specific user from MongoDB with Redis caching.
 * @param userId The ID of the user whose profile to fetch.
 * @returns A promise that resolves to the user's profile and listings, or null if the user is not found.
 */
export async function getUserProfileData(userId: string): Promise<{ profileUser: User; userListings: Book[] } | null> {
  try {
    if (!ObjectId.isValid(userId)) {
        return null;
    }

    // Try to get from cache first
    const cacheKey = `user_profile:${userId}`;
    const profileCacheResult = await redisCache.get<{ profileUser: User; userListings: Book[] }>(cacheKey);

    if (profileCacheResult.hit) {
      console.log(`✅ Cache hit for user profile: ${userId}`);
      return profileCacheResult.value;
    }

    console.log(`❌ Cache miss for user profile: ${userId}, fetching from database`);

    const client = await clientPromise;
    const db = client.db("bookex");

    let profileUser = await db.collection<User>("users").findOne({ _id: new ObjectId(userId) });

    if (!profileUser) {
      return null;
    }

    const profileData = calculateAverageRating(profileUser);
    if (!profileData) {
      return null;
    }

    const userListings = await db.collection("books")
        .find({ sellerId: userId })
        .toArray();

    // Normalize/attach city names for profile and books
    const { findCanonicalCity } = await import('./location/location-utils');
    const profileCanon = await findCanonicalCity(profileData.cityNormalized || '');
    const profileOut: any = serialize(profileData);
    profileOut.cityNormalized = profileCanon?.normalized || profileOut.cityNormalized || null;
    profileOut.cityName = profileCanon?.name || null;

    const mappedListings = await Promise.all(userListings.map(async (b: any) => {
      const canon = await findCanonicalCity(b.cityNormalized || '');
      return {
        ...b,
        cityNormalized: canon?.normalized || b.cityNormalized || null,
        cityName: canon?.name || null
      };
    }));

    const result = { profileUser: profileOut, userListings: serialize(mappedListings) };

    // Cache the result for 30 minutes
    await redisCache.set(cacheKey, result, 1800);

    return result;
  } catch (error) {
    console.error("Error fetching user profile data:", error);
    return null;
  }
}

export interface EnhancedBookFilters {
  searchQuery?: string;
  genre?: string;
  condition?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'relevance' | 'price-low' | 'price-high' | 'newest' | 'oldest' | 'title-asc' | 'title-desc';
  page?: number;
  limit?: number;
}

/**
 * Fetches books for sale with enhanced filters and sorting.
 * @param filters The filters to apply.
 * @returns A promise resolving to an array of books.
 */
export async function getBooksForSale(filters: EnhancedBookFilters): Promise<{ books: Book[]; totalCount: number; hasMore: boolean }> {
  try {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

    const client = await clientPromise;
    const db = client.db("bookex");

    // Base query - only show active, available books
    const now = new Date().toISOString();
    const query: any = {
      type: "sell",
      status: 'active',
      $or: [
        { expiresAt: { $exists: false } }, // Legacy books without expiration
        { expiresAt: { $gt: now } } // Non-expired books
      ]
    };

    // Use $text index (books_text_search_idx covers title, author, description).
    // NOTE: Fall back to $regex only if the text index is dropped — $text is preferred
    // for production as it uses the index and supports relevance scoring.
    if (filters.searchQuery) {
      query.$text = { $search: filters.searchQuery };
    }

    // Category filters
    if (filters.genre) query.genre = filters.genre;
    if (filters.condition) query.condition = filters.condition;

    // Price range filter
    if (filters.minPrice !== undefined && filters.minPrice > 0) {
        query.price = { ...query.price, $gte: filters.minPrice };
    }
    if (filters.maxPrice !== undefined && filters.maxPrice < 10000) {
        query.price = { ...query.price, $lte: filters.maxPrice };
    }

    // Build sort options
    let sort: any = {};
    switch (filters.sortBy) {
        case 'price-low':
            sort = { price: 1 };
            break;
        case 'price-high':
            sort = { price: -1 };
            break;
        case 'newest':
            sort = { createdAt: -1 };
            break;
        case 'oldest':
            sort = { createdAt: 1 };
            break;
        case 'title-asc':
            sort = { title: 1 };
            break;
        case 'title-desc':
            sort = { title: -1 };
            break;
        case 'relevance':
        default:
            // Sort by text relevance score when searching, otherwise newest-first
            sort = filters.searchQuery
              ? { score: { $meta: "textScore" } }
              : { createdAt: -1 };
            break;
    }

    const projection = filters.searchQuery
      ? { score: { $meta: 'textScore' } }
      : undefined;

    const skip = (page - 1) * limit;
    const [books, totalCount] = await Promise.all([
      db.collection("books")
        .find(query, projection ? { projection } : undefined)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection("books").countDocuments(query),
    ]);

    // Fire-and-forget search analytics — failures must not break the search response
    if (filters.searchQuery) {
      db.collection('search_analytics').insertOne({
        query: filters.searchQuery,
        type: 'books_sale',
        resultsCount: totalCount,
        createdAt: new Date().toISOString(),
      }).catch((err) => {
        console.error('search_analytics insert failed (books_sale):', err);
      });
    }

    return {
      books: serialize(books),
      totalCount,
      hasMore: skip + books.length < totalCount,
    };
  } catch (error) {
    console.error("Error fetching books for sale:", error);
    return { books: [], totalCount: 0, hasMore: false };
  }
}

/**
 * Fetches books for exchange with enhanced filters and sorting.
 * @param filters The filters to apply.
 * @returns A promise resolving to an array of books.
 */
export async function getBooksForExchange(filters: EnhancedBookFilters & { page?: number; limit?: number }): Promise<{ books: Book[]; totalCount: number; hasMore: boolean }> {
  try {
    // Import validation utilities
    const { validateExchangeFilters, ValidationError } = await import('./validation');
    
    // Validate and sanitize all input filters
    const validatedFilters = validateExchangeFilters(filters as Record<string, unknown>);
    
    const client = await clientPromise;
    const db = client.db("bookex");

    // Base query - always filter by type first for index efficiency
    const now = new Date().toISOString();
    const query: any = { 
      type: "exchange",
      status: 'active',
      $or: [
        { expiresAt: { $exists: false } }, // Legacy books without expiration
        { expiresAt: { $gt: now } } // Non-expired books
      ]
    };

    // Enhanced text search with proper MongoDB text search
    if (validatedFilters.searchQuery) {
      // Use MongoDB's text search for better performance and relevance scoring
      query.$text = { 
        $search: validatedFilters.searchQuery,
        $caseSensitive: false,
        $diacriticSensitive: false
      };
    }
    
    // Category filters - use exact matches for better index usage
    if (validatedFilters.genre) {
      query.genre = validatedFilters.genre;
    }
    
    if (validatedFilters.condition) {
      query.condition = validatedFilters.condition;
    }
    
    // City filter uses a single canonical normalized key
    if (validatedFilters.city) {
      const { findCanonicalCity, makeNormalizedKey } = await import('./location/location-utils');
      const m = await findCanonicalCity(validatedFilters.city);
      query.cityNormalized = m?.normalized || makeNormalizedKey(validatedFilters.city);
    }

    // Build optimized sort options
    let sort: any = {};
    switch (validatedFilters.sortBy) {
        case 'newest':
            sort = { createdAt: -1 };
            break;
        case 'oldest':
            sort = { createdAt: 1 };
            break;
        case 'title-asc':
            sort = { title: 1 };
            break;
        case 'title-desc':
            sort = { title: -1 };
            break;
        case 'relevance':
        default:
            // Use text score for relevance when searching, otherwise newest
            if (validatedFilters.searchQuery && query.$text) {
                sort = { score: { $meta: "textScore" }, createdAt: -1 };
            } else {
                sort = { createdAt: -1 };
            }
            break;
    }

    // Calculate pagination with validated values
    const skip = (validatedFilters.page - 1) * validatedFilters.limit;

    // Execute optimized aggregation pipeline for better performance
    const pipeline = [
      { $match: query },
      { $sort: sort },
      {
        $facet: {
          books: [
            { $skip: skip },
            { $limit: validatedFilters.limit }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }
    ];

    const [result] = await db.collection("books").aggregate(pipeline).toArray();
    
    const books = result.books || [];
    const totalCount = result.totalCount[0]?.count || 0;
    const hasMore = skip + books.length < totalCount;

    // Log query performance for monitoring (in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Exchange query: ${books.length}/${totalCount} books, page ${validatedFilters.page}`);
    }

    // Fire-and-forget search analytics — failures must not break the search response
    if (validatedFilters.searchQuery) {
      db.collection('search_analytics').insertOne({
        query: validatedFilters.searchQuery,
        type: 'books_exchange',
        resultsCount: totalCount,
        createdAt: new Date().toISOString(),
      }).catch((err) => {
        console.error('search_analytics insert failed (books_exchange):', err);
      });
    }

    return {
      books: serialize(books),
      totalCount,
      hasMore
    };
    
  } catch (error) {
    // Handle validation errors specifically
    if (error instanceof Error && error.name === 'ValidationError') {
      console.warn("Invalid exchange filters:", error.message);
      return {
        books: [],
        totalCount: 0,
        hasMore: false
      };
    }
    
    console.error("Error fetching books for exchange:", error);
    return {
      books: [],
      totalCount: 0,
      hasMore: false
    };
  }
}

/**
 * Gets available filter options for book pages.
 * @param type The type of listing ('sell' or 'exchange').
 * @returns An object with arrays of genres, conditions, and cities.
 */
export async function getAvailableBookFilters(type: 'sell' | 'exchange') {
    try {
        const client = await clientPromise;
        const db = client.db("bookex");
        const pipeline = [
            { $match: { type: type } },
          { $group: {
            _id: null,
            genres: { $addToSet: "$genre" },
            cities: { $addToSet: "$cityNormalized" }
          }}
        ];
        const result = await db.collection("books").aggregate(pipeline).toArray();
        const filters = result[0] || { genres: [], cities: [] };
        // Map normalized city keys back to display names
        const normCities: string[] = (filters.cities || []).filter(Boolean);
        const { findCanonicalCity } = await import('./location/location-utils');
        const cities = await Promise.all(normCities.map(async (n) => {
          const c = await findCanonicalCity(n);
          return c?.name || n;
        }));

        return {
          genres: (filters.genres || []).filter(Boolean),
          conditions: ['new', 'like-new', 'used', 'worn'],
          cities,
        };
    } catch (error) {
        console.error("Error fetching available filters:", error);
        return { genres: [], conditions: ['new', 'like-new', 'used', 'worn'], cities: [] };
    }
}

/**
 * Fetches all communities from MongoDB.
 * @returns A promise that resolves to an array of Community objects.
 */
export async function getCommunities(): Promise<Community[]> {
    try {
        const client = await clientPromise;
        const db = client.db("bookex");
        const communities = await db.collection("communities")
            .find({})
            .sort({ memberCount: -1 })
            .toArray();
        return serialize(communities);
    } catch (error) {
        console.error("Error fetching communities:", error);
        return [];
    }
}


/**
 * Fetches the details of a specific community and its posts using optimized aggregation with pagination.
 * @param communityId The ID of the community.
 * @param page The page number (1-based).
 * @param limit The number of posts per page.
 * @returns Community and paginated post data or null.
 */
export async function getCommunityDetails(communityId: string, page: number = 1, limit: number = 20) {
    try {
        if (!ObjectId.isValid(communityId)) {
            console.error('Invalid communityId:', communityId);
            return null;
        }

        const client = await clientPromise;
        const db = client.db("bookex");
        
        console.log('Fetching community details for:', communityId);
        
        // Community basic info
        const community = await db.collection<Community>("communities").findOne(
            { _id: new ObjectId(communityId) },
            { projection: { posts: 0 } }
        );
        
        console.log('Community found:', !!community);
        if (!community) {
            console.error('Community not found for ID:', communityId);
            return null;
        }
        
        const skip = (page - 1) * limit;
        
        // Fetch posts from posts collection
        const [posts, totalPosts] = await Promise.all([
            db.collection('posts')
              .find({ communityId: new ObjectId(communityId) } as any)
              .sort({ createdAt: -1 })
              .skip(skip)
              .limit(limit)
              .toArray(),
            db.collection('posts').countDocuments({ communityId: new ObjectId(communityId) } as any)
        ]);

        // Attach minimal author projection if needed (already stored denormalized in author)
        const totalPages = Math.ceil(totalPosts / limit);

        return serialize({
            community: { ...community, posts: undefined },
            posts,
            pagination: {
                page,
                limit,
                total: totalPosts,
                pages: totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error("Error fetching community details:", error);
        console.error("Error details:", {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            communityId
        });
        return null;
    }
}

export async function getThreadedComments(postId: string, parentId?: string | null, limit: number = 50) {
    const client = await clientPromise;
    const db = client.db('bookex');
    if (!ObjectId.isValid(postId)) return [];

    const basePath = parentId && ObjectId.isValid(parentId) ? `${postId}/${parentId}` : postId;
    const query: any = { postId: new ObjectId(postId) };
    if (parentId === undefined) {
        query.parentId = null;
    } else if (parentId) {
        query.parentId = new ObjectId(parentId);
    }

    const comments = await db.collection('comments')
      .find(query)
      .sort({ createdAt: 1 })
      .limit(limit)
      .toArray();

    return serialize(comments);
}

/**
 * Fetches the details of a specific community and its posts using optimized aggregation.
 * @param communityId The ID of the community.
 * @returns Community and post data or null.
 * @deprecated Use getCommunityDetails with pagination parameters instead
 */
export async function getCommunityDetailsLegacy(communityId: string) {
    const result = await getCommunityDetails(communityId, 1, 1000); // Large limit to get all posts
    if (!result) return null;

    return {
        community: {
            ...result.community,
            posts: result.posts
        },
        posts: result.posts
    };
}

export interface ExchangeDetail extends Exchange {
    proposer: User;
    responder: User;
    proposerBook: Book;
    responderBook: Book;
}

/**
 * Fetches a single exchange by ID, verifying the requesting user is a participant.
 * Populates proposer, responder, proposerBook, and responderBook via $lookup.
 */
export async function getExchangeById(
    exchangeId: string,
    userId: string,
): Promise<ExchangeDetail | null> {
    try {
        if (!ObjectId.isValid(exchangeId)) return null;

        const client = await clientPromise;
        const db = client.db('bookex');

        const pipeline = [
            { $match: { _id: new ObjectId(exchangeId) } },
            {
                $lookup: {
                    from: 'users',
                    let: { pid: { $toObjectId: '$proposerId' } },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$pid'] } } },
                        { $project: { name: 1, avatarUrl: 1, city: 1, cityNormalized: 1 } },
                    ],
                    as: 'proposerArr',
                },
            },
            {
                $lookup: {
                    from: 'users',
                    let: { rid: { $toObjectId: '$responderId' } },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$rid'] } } },
                        { $project: { name: 1, avatarUrl: 1, city: 1, cityNormalized: 1 } },
                    ],
                    as: 'responderArr',
                },
            },
            {
                $lookup: {
                    from: 'books',
                    localField: 'proposerBookId',
                    foreignField: '_id',
                    as: 'proposerBookArr',
                },
            },
            {
                $lookup: {
                    from: 'books',
                    localField: 'responderBookId',
                    foreignField: '_id',
                    as: 'responderBookArr',
                },
            },
            {
                $addFields: {
                    proposer: { $arrayElemAt: ['$proposerArr', 0] },
                    responder: { $arrayElemAt: ['$responderArr', 0] },
                    proposerBook: { $arrayElemAt: ['$proposerBookArr', 0] },
                    responderBook: { $arrayElemAt: ['$responderBookArr', 0] },
                },
            },
            {
                $project: {
                    proposerArr: 0,
                    responderArr: 0,
                    proposerBookArr: 0,
                    responderBookArr: 0,
                },
            },
        ];

        const [exchange] = await db.collection('exchanges').aggregate(pipeline).toArray();

        if (!exchange) return null;

        // NOTE: Only participants may view this exchange.
        const isParticipant =
            exchange.proposerId === userId || exchange.responderId === userId;
        if (!isParticipant) return null;

        return serialize(exchange) as ExchangeDetail;
    } catch (error) {
        console.error('Error fetching exchange by id:', error);
        return null;
    }
}

/**
 * Fetches a single approved organization by ID, along with active donation books
 * listed for that organization.
 */
export async function getOrganizationById(orgId: string): Promise<{
    organization: Organization;
    donationBooks: Book[];
} | null> {
    try {
        if (!ObjectId.isValid(orgId)) return null;

        const client = await clientPromise;
        const db = client.db('bookex');

        const organization = await db
            .collection<Organization>('organizations')
            .findOne({ _id: new ObjectId(orgId), status: 'approved' });

        if (!organization) return null;

        // Active donation books linked to this org
        const donationBooks = await db
            .collection('books')
            .find({ type: 'donation', status: 'active', organizationId: orgId })
            .limit(50)
            .toArray();

        return serialize({ organization, donationBooks }) as {
            organization: Organization;
            donationBooks: Book[];
        };
    } catch (error) {
        console.error('Error fetching organization by id:', error);
        return null;
    }
}
