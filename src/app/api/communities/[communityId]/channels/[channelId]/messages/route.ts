import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string; channelId: string }> }
) {
  try {
    const { communityId, channelId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 });
    }

    const { db } = await connectToMongoDB();

    const community = await db.collection('communities').findOne({ 
      _id: new ObjectId(communityId) 
    });
    
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const isMember = community.members?.some((m: any) => m.userId === session.user.id);
    if (!isMember) {
      return NextResponse.json({ error: 'Not a member of this community' }, { status: 403 });
    }

    const channel = community.channels?.find((c: any) => c._id === channelId || c.id === channelId);
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const skip = (page - 1) * limit;

    const messages = await db.collection('chatMessages').aggregate([
      { $match: { channelId } },
      {
        $lookup: {
          from: 'users',
          let: { authorId: { $toObjectId: '$authorId' } },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$authorId'] } } },
            { $project: { name: 1, avatarUrl: 1, username: 1, _id: 1 } }
          ],
          as: 'author'
        }
      },
      {
        $unwind: {
          path: '$author',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          author: {
            $ifNull: [
              '$author',
              { _id: '$authorId', name: 'Unknown User', avatarUrl: null, username: null }
            ]
          }
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skip }, { $limit: limit }]
        }
      }
    ]).toArray();

    const totalMessages = messages[0]?.metadata[0]?.total || 0;
    let messageData = messages[0]?.data || [];
    
    // Add role information from community members
    messageData = messageData.map((msg: any) => {
      if (msg.author && community.members) {
        const member = community.members.find((m: any) => m.userId === msg.authorId);
        if (member) {
          msg.author.role = member.role;
        }
      }
      return msg;
    });
    
    const totalPages = Math.ceil(totalMessages / limit);

    return NextResponse.json({
      messages: messageData,
      pagination: {
        page,
        limit,
        total: totalMessages,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching channel messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string; channelId: string }> }
) {
  try {
    const { communityId, channelId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    const { db } = await connectToMongoDB();

    const community = await db.collection('communities').findOne({ 
      _id: new ObjectId(communityId) 
    });
    
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const isMember = community.members?.some((m: any) => m.userId === session.user.id);
    if (!isMember) {
      return NextResponse.json({ error: 'Not a member of this community' }, { status: 403 });
    }

    const channel = community.channels?.find((c: any) => c._id === channelId || c.id === channelId);
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const sanitizedContent = content.trim().replace(/[<>]/g, '').slice(0, 2000);

    if (!sanitizedContent) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    const author = await db.collection('users').findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { name: 1, avatarUrl: 1, username: 1 } }
    );

    if (!author) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const messageDoc = {
      channelId,
      communityId: new ObjectId(communityId),
      authorId: session.user.id,
      content: sanitizedContent,
      createdAt: new Date().toISOString()
    };

    const result = await db.collection('chatMessages').insertOne(messageDoc);

    // Get member role from community
    const member = community.members?.find((m: any) => m.userId === session.user.id);

    const createdMessage = {
      _id: result.insertedId,
      ...messageDoc,
      author: {
        _id: session.user.id,
        name: author.name,
        avatarUrl: author.avatarUrl,
        username: author.username,
        role: member?.role || 'member'
      }
    };

    return NextResponse.json({ success: true, newMessage: createdMessage });

  } catch (error) {
    console.error('Error creating channel message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
