import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const { db } = await connectToMongoDB();

    // Create case-insensitive regex for username search
    const searchRegex = new RegExp(query, 'i');

    // Search users by username, excluding current user
    const currentUserId = typeof session.user.id === 'string' ? new ObjectId(session.user.id) : session.user.id;
    
    const users = await db.collection('users')
      .find({
        $and: [
          {
            $or: [
              { username: searchRegex },
              { name: searchRegex }
            ]
          },
          { _id: { $ne: currentUserId } } // Exclude current user
        ]
      })
      .limit(10)
      .project({
        _id: 1,
        name: 1,
        username: 1,
        avatarUrl: 1,
        image: 1
      })
      .toArray();

    return NextResponse.json({ 
      users: users.map(user => ({
        _id: user._id,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl || user.image
      }))
    });

  } catch (error) {
    console.error('User search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}