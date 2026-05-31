import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/communities/[communityId]/posts - Get paginated posts for a community
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (page < 1 || limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    const { communityId } = await params;
    if (!ObjectId.isValid(communityId)) {
      return NextResponse.json({ error: 'Invalid community ID' }, { status: 400 });
    }

    const { db } = await connectToMongoDB();

    // Check if community exists
    const community = await db.collection('communities').findOne({
      _id: new ObjectId(communityId)
    });

    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    // Match both ObjectId and string forms — posts may have been inserted either way
    const communityIdFilter = { $or: [{ communityId: new ObjectId(communityId) }, { communityId: communityId }] };

    const total = await db.collection('posts').countDocuments(communityIdFilter);

    const posts = await db.collection('posts').aggregate([
      { $match: communityIdFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'authorId',
          foreignField: '_id',
          as: 'author'
        }
      },
      { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'comments',
          localField: '_id',
          foreignField: 'postId',
          as: 'comments'
        }
      },
      {
        $addFields: {
          likes: { $size: { $ifNull: ['$likedBy', []] } }
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ]).toArray();

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching community posts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
