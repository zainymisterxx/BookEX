import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/messages/chats - Get user's chat conversations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToMongoDB();

    // Build filter for chat query
    const chatFilter: any = {
      participantIds: { $in: [session.user.id] },  // FIX: participantIds is an array, use $in
      organizationDeleted: { $ne: true },
      deletedBy: { $nin: [session.user.id] }
    };
    
    // Get chats from the new 'chats' collection where user is a direct participant
    let newChats = await db.collection('chats').find(chatFilter).toArray();

    // Also get donation chats where user is an organization representative
    const userOrganizations = await db.collection('organizations').find({
      'representatives.userId': session.user.id
    }).toArray();

    if (userOrganizations.length > 0) {
      const orgIds = userOrganizations.map(org => org._id);
      
      const orgChatFilter: any = {
        organizationId: { $in: orgIds },
        participantIds: { $ne: session.user.id }, // Only include if not already a direct participant
        organizationDeleted: { $ne: true }, // Exclude chats with deleted organizations
        deletedBy: { $nin: [session.user.id] } // Use $nin for arrays
      };
      
      const orgChats = await db.collection('chats').find(orgChatFilter).toArray();

      // Merge org chats with user's direct chats
      newChats = [...newChats, ...orgChats];
    }

    // Format new chats with organization/user info
    const formattedNewChats = await Promise.all(newChats.map(async (chat: any) => {
      const otherUserId = chat.participantIds.map((id: unknown) => String(id)).find((id: string) => id !== session.user.id);
      
      // Get other participant info
      let otherParticipant = null;
      if (otherUserId && ObjectId.isValid(otherUserId)) {
        const user = await db.collection('users').findOne(
          { _id: new ObjectId(otherUserId) },
          { projection: { name: 1, username: 1, avatarUrl: 1, image: 1 } }
        );
        if (user) {
          otherParticipant = {
            _id: user._id.toString(),
            name: user.name,
            username: user.username,
            avatarUrl: user.avatarUrl || user.image
          };
        }
      }

      // Get organization info if this is a donation chat
      // Only show organization to the DONOR (not to the organization contact)
      let organization = null;
      if (chat.organizationId) {
        const org = await db.collection('organizations').findOne(
          { _id: chat.organizationId },
          { projection: { name: 1, imageUrl: 1, primaryContactId: 1 } }
        );
        
        // Only include organization info if current user is NOT the organization contact
        // (i.e., they are the donor)
        if (org && org.primaryContactId !== session.user.id) {
          organization = {
            _id: org._id.toString(),
            name: org.name,
            logo: org.imageUrl
          };
        }
      }

      // Prefer the per-participant counter kept by the socket server; fall back to
      // scanning inline messages for legacy chats that embed messages directly.
      const unreadCount: number =
        chat.unreadCountByParticipant?.[session.user.id] ??
        (chat.messages?.filter((msg: any) => msg.senderId !== session.user.id && !msg.read).length || 0);

      return {
        _id: chat._id.toString(),
        participantIds: chat.participantIds,
        lastMessage: chat.lastMessage || (chat.messages && chat.messages.length > 0 
          ? chat.messages[chat.messages.length - 1]
          : null),
        otherParticipant,
        organization,
        donationId: chat.donationId?.toString(),
        unreadCount,
        updatedAt: chat.updatedAt
      };
    }));

    // Get old personal messages and group by conversation
    const personalChats = await db.collection('personalMessages').aggregate([
      {
        $match: {
          $or: [
            { senderId: session.user.id },
            { receiverId: session.user.id }
          ]
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$senderId', session.user.id] },
              '$receiverId',
              '$senderId'
            ]
          },
          lastMessage: { $last: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    { $ne: ['$senderId', session.user.id] },
                    { $ne: ['$read', true] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { otherUserId: '$_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $eq: ['$_id', { $toObjectId: '$$otherUserId' }] 
                } 
              } 
            },
            { $project: { name: 1, username: 1, avatarUrl: 1, image: 1 } }
          ],
          as: 'otherParticipant'
        }
      },
      {
        $unwind: {
          path: '$otherParticipant',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          otherUserId: '$_id',
          participantIds: ['$_id', session.user.id],
          lastMessage: {
            _id: '$lastMessage._id',
            senderId: '$lastMessage.senderId',
            receiverId: '$lastMessage.receiverId',
            content: '$lastMessage.content',
            createdAt: '$lastMessage.createdAt',
            read: '$lastMessage.read'
          },
          otherParticipant: {
            _id: '$otherParticipant._id',
            name: '$otherParticipant.name',
            username: '$otherParticipant.username',
            avatarUrl: { 
              $ifNull: ['$otherParticipant.avatarUrl', '$otherParticipant.image'] 
            }
          },
          unreadCount: 1
        }
      },
      { $sort: { 'lastMessage.createdAt': -1 } }
    ]).toArray();

    // Format personal chats with proper composite chatId
    const formattedPersonalChats = personalChats.map(chat => {
      const otherUserId = chat.otherUserId || chat._id;
      const chatId = [session.user.id, otherUserId].sort().join('_');
      
      // Ensure otherParticipant._id is a string
      if (chat.otherParticipant && chat.otherParticipant._id) {
        chat.otherParticipant._id = chat.otherParticipant._id.toString();
      }
      
      return {
        ...chat,
        _id: chatId,
        participantIds: [session.user.id, otherUserId],
        isPersonalMessage: true // Flag to distinguish old format
      };
    });

    // Combine both types of chats and sort by last message time
    const allChats = [...formattedNewChats, ...formattedPersonalChats].sort((a, b) => {
      const aTime = new Date((a as any).lastMessage?.createdAt || (a as any).updatedAt || 0).getTime();
      const bTime = new Date((b as any).lastMessage?.createdAt || (b as any).updatedAt || 0).getTime();
      return bTime - aTime;
    });

    return NextResponse.json({ chats: allChats });

  } catch (error) {
    console.error('Error fetching chats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/messages/chats - Create a new chat
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { receiverId, content } = await request.json();

    if (!receiverId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { db } = await connectToMongoDB();

    // Create new message
    const message = {
      senderId: session.user.id,
      receiverId,
      content,
      createdAt: new Date().toISOString(),
      read: false
    };

    const result = await db.collection('personalMessages').insertOne(message);

    return NextResponse.json({
      success: true,
      message: {
        ...message,
        _id: result.insertedId
      }
    });

  } catch (error) {
    console.error('Error creating chat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
