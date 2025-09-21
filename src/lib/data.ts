
import clientPromise from './mongodb';
import { Book, Community, User } from './types';
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
    
    return serialize(books);
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
    if (book.sellerId && ObjectId.isValid(book.sellerId)) {
      // Try to get seller from cache first
      const sellerCacheKey = `user:${book.sellerId}`;
      const cachedSeller = await redisCache.get<User>(sellerCacheKey);

      if (cachedSeller) {
        console.log(`✅ Cache hit for seller: ${book.sellerId}`);
        seller = cachedSeller;
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

    return { book: serialize(book), seller: serialize(seller) };
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
    const cachedData = await redisCache.get<{ profileUser: User; userListings: Book[] }>(cacheKey);

    if (cachedData) {
      console.log(`✅ Cache hit for user profile: ${userId}`);
      return cachedData;
    }

    console.log(`❌ Cache miss for user profile: ${userId}, fetching from database`);

    const client = await clientPromise;
    const db = client.db("bookex");

    let profileUser = await db.collection<User>("users").findOne({ _id: new ObjectId(userId) });

    if (!profileUser) {
      return null;
    }

    profileUser = calculateAverageRating(profileUser);

    const userListings = await db.collection("books")
        .find({ sellerId: userId })
        .toArray();

    const result = { profileUser: serialize(profileUser), userListings: serialize(userListings) };

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
}

/**
 * Fetches books for sale with enhanced filters and sorting.
 * @param filters The filters to apply.
 * @returns A promise resolving to an array of books.
 */
export async function getBooksForSale(filters: EnhancedBookFilters): Promise<Book[]> {
  try {
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

    // Text search
    if (filters.searchQuery) {
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { title: { $regex: filters.searchQuery, $options: 'i' } },
            { author: { $regex: filters.searchQuery, $options: 'i' } },
            { description: { $regex: filters.searchQuery, $options: 'i' } }
          ]
        });
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
            // For relevance, use text score if there's a search query, otherwise newest
            if (filters.searchQuery) {
                query.$text = { $search: filters.searchQuery };
                sort = { score: { $meta: "textScore" } };
            } else {
                sort = { createdAt: -1 };
            }
            break;
    }

    const books = await db.collection("books").find(query).sort(sort).toArray();
    return serialize(books);
  } catch (error) {
    console.error("Error fetching books for sale:", error);
    return [];
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
    
    // City filter with optimized regex (only if provided)
    if (validatedFilters.city) {
      // Use case-insensitive prefix match for better performance
      query.city = { 
        $regex: `^${validatedFilters.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 
        $options: 'i' 
      };
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
                cities: { $addToSet: "$city" }
            }}
        ];
        const result = await db.collection("books").aggregate(pipeline).toArray();
        const filters = result[0] || { genres: [], cities: [] };
        
        return {
            genres: (filters.genres || []).filter(Boolean),
            conditions: ['new', 'like-new', 'used', 'worn'],
            cities: (filters.cities || []).filter(Boolean),
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
        if (!ObjectId.isValid(communityId)) return null;

        const client = await clientPromise;
        const db = client.db("bookex");
        
        // First, get the community basic info and total post count
        const community = await db.collection<Community>("communities").findOne(
            { _id: new ObjectId(communityId) },
            { projection: { posts: 0 } } // Exclude posts for now
        );
        
        if (!community) return null;
        
        const totalPosts = community.posts?.length || 0;
        const totalPages = Math.ceil(totalPosts / limit);
        const skip = (page - 1) * limit;
        
        // Get paginated posts with author information
        const postsWithAuthors = await db.collection<Community>("communities").aggregate([
            { $match: { _id: new ObjectId(communityId) } },
            {
                $project: {
                    posts: { $slice: ["$posts", skip, limit] }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "posts.authorId",
                    foreignField: "_id",
                    as: "postAuthors",
                    pipeline: [
                        { $project: { name: 1, avatarUrl: 1 } }
                    ]
                }
            },
            {
                $lookup: {
                    from: "users", 
                    localField: "posts.comments.author._id",
                    foreignField: "_id",
                    as: "commentAuthors",
                    pipeline: [
                        { $project: { name: 1, avatarUrl: 1 } }
                    ]
                }
            },
            {
                $addFields: {
                    posts: {
                        $map: {
                            input: "$posts",
                            as: "post",
                            in: {
                                $mergeObjects: [
                                    "$$post",
                                    {
                                        author: {
                                            $let: {
                                                vars: {
                                                    author: {
                                                        $arrayElemAt: [
                                                            {
                                                                $filter: {
                                                                    input: "$postAuthors",
                                                                    cond: { $eq: ["$$this._id", { $toObjectId: "$$post.authorId" }] }
                                                                }
                                                            },
                                                            0
                                                        ]
                                                    }
                                                },
                                                in: {
                                                    _id: { $toString: "$$author._id" },
                                                    name: "$$author.name",
                                                    avatarUrl: "$$author.avatarUrl"
                                                }
                                            }
                                        },
                                        comments: {
                                            $map: {
                                                input: { $ifNull: ["$$post.comments", []] },
                                                as: "comment", 
                                                in: {
                                                    $mergeObjects: [
                                                        "$$comment",
                                                        {
                                                            author: {
                                                                $let: {
                                                                    vars: {
                                                                        commentAuthor: {
                                                                            $arrayElemAt: [
                                                                                {
                                                                                    $filter: {
                                                                                        input: "$commentAuthors",
                                                                                        cond: { $eq: ["$$this._id", { $toObjectId: "$$comment.author._id" }] }
                                                                                    }
                                                                                },
                                                                                0
                                                                            ]
                                                                        }
                                                                    },
                                                                    in: {
                                                                        _id: { $toString: "$$commentAuthor._id" },
                                                                        name: "$$commentAuthor.name", 
                                                                        avatarUrl: "$$commentAuthor.avatarUrl"
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            { $project: { postAuthors: 0, commentAuthors: 0 } }
        ]).toArray();

        const posts = postsWithAuthors[0]?.posts || [];

        return serialize({
            community: {
                ...community,
                posts: undefined // Remove posts from community object
            },
            posts: posts,
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
        return null;
    }
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
