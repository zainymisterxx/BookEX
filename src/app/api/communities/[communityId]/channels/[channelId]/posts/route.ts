import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/communities/[communityId]/channels/[channelId]/posts - Get posts for a channel
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string; channelId: string }> }
) {
  try {
    const { communityId, channelId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const { db } = await connectToMongoDB();

    // Check if user is member of community
    const community = await db.collection('communities').findOne({ _id: new ObjectId(communityId) });
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const isMember = community.members?.some((m: any) => m.userId === session.user.id);
    if (!isMember) {
      return NextResponse.json({ error: 'Not a member of this community' }, { status: 403 });
    }

    // Get posts for this channel with author and comment author information
    const skip = (page - 1) * limit;
    
    // First, get the community to access member roles
    const communityDoc = await db.collection('communities').findOne(
      { _id: new ObjectId(communityId) },
      { projection: { members: 1 } }
    );
    
    const [rawPosts, totalPosts] = await Promise.all([
      db.collection('posts')
        .aggregate([
          { 
            $match: { 
              communityId: new ObjectId(communityId), 
              channelId 
            } 
          },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'authorId',
              foreignField: '_id',
              as: 'authorData'
            }
          },
          {
            $unwind: {
              path: '$authorData',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $addFields: {
              author: {
                _id: '$authorData._id',
                name: '$authorData.name',
                avatarUrl: '$authorData.avatarUrl'
              },
              comments: {
                $map: {
                  input: { $ifNull: ['$comments', []] },
                  as: 'comment',
                  in: {
                    _id: '$$comment._id',
                    content: '$$comment.content',
                    createdAt: '$$comment.createdAt',
                    authorId: '$$comment.authorId'
                  }
                }
              }
            }
          },
          {
            $project: {
              authorData: 0
            }
          }
        ])
        .toArray(),
      db.collection('posts').countDocuments({ communityId: new ObjectId(communityId), channelId })
    ]);
    
    // Add role information from community members
    const postsWithRoles = rawPosts.map((post: any) => {
      if (post.author && communityDoc?.members) {
        // Convert authorId to string for comparison since members.userId is stored as string
        const authorIdStr = post.authorId instanceof ObjectId ? post.authorId.toString() : String(post.authorId);
        const member = communityDoc.members.find((m: any) => m.userId === authorIdStr);
        if (member) {
          post.author.role = member.role;
        }
      }
      return post;
    });

    // Populate comment authors
    const posts = await Promise.all(postsWithRoles.map(async (post: any) => {
      if (post.comments && post.comments.length > 0) {
        const commentAuthorIds = post.comments.map((c: any) => new ObjectId(c.authorId));
        const authors = await db.collection('users').find(
          { _id: { $in: commentAuthorIds } },
          { projection: { name: 1, avatarUrl: 1 } }
        ).toArray();
        
        const authorMap = new Map(authors.map(a => [a._id.toString(), a]));
        
        post.comments = post.comments.map((comment: any) => ({
          ...comment,
          author: authorMap.get(comment.authorId) || { name: 'Unknown User' }
        }));
      }
      return post;
    }));

    const totalPages = Math.ceil(totalPosts / limit);

    return NextResponse.json({
      posts: JSON.parse(JSON.stringify(posts)),
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
    console.error('Error fetching channel posts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/communities/[communityId]/channels/[channelId]/posts - Create a new post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string; channelId: string }> }
) {
  try {
    const { communityId, channelId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { authorId, content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (authorId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { db } = await connectToMongoDB();

    // Check if user is member of community
    const community = await db.collection('communities').findOne({ _id: new ObjectId(communityId) });
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const isMember = community.members?.some((m: any) => m.userId === session.user.id);
    if (!isMember) {
      return NextResponse.json({ error: 'Not a member of this community' }, { status: 403 });
    }

    // Get author info with role
    const author = await db.collection('users').findOne(
      { _id: new ObjectId(authorId) },
      { projection: { name: 1, avatarUrl: 1 } }
    );
    
    // Get member role
    const member = community.members?.find((m: any) => m.userId === authorId);
    const authorWithRole = author ? {
      _id: author._id,
      name: author.name,
      avatarUrl: author.avatarUrl,
      role: member?.role || 'member'
    } : null;

    // Create new post
    const newPost = {
      _id: new ObjectId(),
      authorId: new ObjectId(authorId),
      communityId: new ObjectId(communityId),
      channelId,
      content: content.trim(),
      likes: 0,
      likedBy: [],
      comments: [],
      createdAt: new Date().toISOString()
    };

    await db.collection('posts').insertOne(newPost);

    // Return post with author info for real-time updates
    return NextResponse.json({
      success: true,
      newPost: {
        ...newPost,
        author: authorWithRole
      }
    });

  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
