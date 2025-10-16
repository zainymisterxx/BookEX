import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * Checks if users have blocked each other
 * POST /api/messages/check-blocked
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetUserId } = await request.json();

    if (!targetUserId || !ObjectId.isValid(targetUserId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const { db } = await connectToMongoDB();
    
    // Check both directions
    const [currentUser, targetUser] = await Promise.all([
      db.collection('users').findOne(
        { _id: new ObjectId(session.user.id) },
        { projection: { blockedUsers: 1 } }
      ),
      db.collection('users').findOne(
        { _id: new ObjectId(targetUserId) },
        { projection: { blockedUsers: 1 } }
      )
    ]);

    const currentUserBlocked = currentUser?.blockedUsers?.includes(targetUserId) || false;
    const targetUserBlocked = targetUser?.blockedUsers?.includes(session.user.id) || false;

    return NextResponse.json({
      isBlocked: currentUserBlocked || targetUserBlocked,
      youBlockedThem: currentUserBlocked,
      theyBlockedYou: targetUserBlocked
    });
  } catch (error) {
    console.error('Check blocked error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
