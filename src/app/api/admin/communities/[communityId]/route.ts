import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/admin/communities/[communityId] - Get community details with members and posts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { communityId } = await params;
    if (!ObjectId.isValid(communityId)) {
      return NextResponse.json({ error: 'Invalid community ID' }, { status: 400 });
    }

    const { db } = await connectToMongoDB();

    // Get community details
    const community = await db.collection('communities').findOne({
      _id: new ObjectId(communityId)
    });

    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    // Get community members
    const members = await db.collection('users').find({
      _id: { $in: community.members || [] }
    }).toArray();

    // Get community posts with author details
    const posts = await db.collection('posts').aggregate([
      { $match: { communityId: new ObjectId(communityId) } },
      {
        $lookup: {
          from: 'users',
          localField: 'authorId',
          foreignField: '_id',
          as: 'author'
        }
      },
      { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      { $limit: 50 } // Limit to recent 50 posts for admin view
    ]).toArray();

    return NextResponse.json({
      community,
      members,
      posts
    });

  } catch (error) {
    console.error('Error fetching community details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/communities/[communityId] - Delete community
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Start a session for transaction
    const mongoSession = await connectToMongoDB().then(({ client }) => client.startSession());

    try {
      await mongoSession.withTransaction(async () => {
        // Delete all posts in the community
        await db.collection('posts').deleteMany(
          { communityId: new ObjectId(communityId) },
          { session: mongoSession }
        );

        // Delete all comments on posts in the community
        await db.collection('comments').deleteMany(
          { communityId: new ObjectId(communityId) },
          { session: mongoSession }
        );

        // Remove community from all users' memberships
        await db.collection('users').updateMany(
          { communities: new ObjectId(communityId) },
          { $pull: { communities: new ObjectId(communityId) } } as any,
          { session: mongoSession }
        );

        // Delete the community
        await db.collection('communities').deleteOne(
          { _id: new ObjectId(communityId) },
          { session: mongoSession }
        );
      });

      return NextResponse.json({ message: 'Community deleted successfully' });

    } finally {
      await mongoSession.endSession();
    }

  } catch (error) {
    console.error('Error deleting community:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
