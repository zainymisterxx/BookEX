import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToMongoDB } from '@/lib/mongodb';
import { AdminNotification, AdminNotificationSummary, AdminNotificationType, AdminNotificationPriority } from '@/lib/types';
import { ObjectId } from 'mongodb';
import { checkIPRateLimit, RATE_LIMITS } from '@/lib/rate-limiting';

// Rate limiting helper for admin operations
async function adminRateLimit(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const result = await checkIPRateLimit(ip, 'admin_api', {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60 // 60 requests per minute for admins
  });
  
  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }
  
  return null;
}

async function verifyAdminAccess() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error('Authentication required');
  }
  
  if (session.user.role !== 'admin') {
    throw new Error('Admin access required');
  }
  
  return session;
}

// GET /api/admin/notifications - Fetch admin notifications
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await adminRateLimit(request);
    if (rateLimitResult) return rateLimitResult;

    // Verify admin access
    await verifyAdminAccess();
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const type = searchParams.get('type') as AdminNotificationType | null;
    const priority = searchParams.get('priority') as AdminNotificationPriority | null;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const summary = searchParams.get('summary') === 'true';
    
    const { db } = await connectToMongoDB();
    const collection = db.collection('adminNotifications');
    
    // Build filter
    const filter: any = {};
    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (unreadOnly) filter.read = false;
    
    // If summary requested, return aggregated data
    if (summary) {
      const [totalCount, unreadCount, priorityCounts, typeCounts, recentNotifications] = await Promise.all([
        collection.countDocuments({}),
        collection.countDocuments({ read: false }),
        collection.aggregate([
          { $group: { _id: '$priority', count: { $sum: 1 } } }
        ]).toArray(),
        collection.aggregate([
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ]).toArray(),
        collection.find({ read: false })
          .sort({ priority: -1, createdAt: -1 })
          .limit(5)
          .toArray()
      ]);
      
      const priorityMap = { critical: 0, high: 0, medium: 0, low: 0 };
      priorityCounts.forEach((p: any) => {
        if (p._id in priorityMap) priorityMap[p._id as keyof typeof priorityMap] = p.count;
      });
      
      const typeMap: { [key in AdminNotificationType]: number } = {
        new_user: 0, new_organization: 0, content_report: 0, security_alert: 0,
        system_error: 0, performance_issue: 0, database_issue: 0, high_activity: 0,
        moderation_required: 0, user_complaint: 0
      };
      typeCounts.forEach((t: any) => {
        if (t._id in typeMap) typeMap[t._id as AdminNotificationType] = t.count;
      });
      
      const summaryData: AdminNotificationSummary = {
        total: totalCount,
        unread: unreadCount,
        byPriority: priorityMap,
        byType: typeMap,
        recent: JSON.parse(JSON.stringify(recentNotifications))
      };
      
      return NextResponse.json(summaryData);
    }
    
    // Regular paginated fetch
    const skip = (page - 1) * limit;
    const notifications = await collection
      .find(filter)
      .sort({ priority: -1, createdAt: -1 }) // Critical first, then newest
      .skip(skip)
      .limit(limit + 1) // Get one extra to check for more
      .toArray();
    
    const hasMore = notifications.length > limit;
    const results = hasMore ? notifications.slice(0, -1) : notifications;
    const total = await collection.countDocuments(filter);
    
    return NextResponse.json({
      notifications: JSON.parse(JSON.stringify(results)),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalCount: total,
        hasMore,
        limit
      }
    });
    
  } catch (error) {
    console.error('Error fetching admin notifications:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch notifications' },
      { status: error instanceof Error && error.message.includes('required') ? 401 : 500 }
    );
  }
}

// POST /api/admin/notifications - Create new admin notification
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await adminRateLimit(request);
    if (rateLimitResult) return rateLimitResult;

    // Verify admin access
    const session = await verifyAdminAccess();
    
    const body = await request.json();
    const { type, priority, title, message, details, actionUrl, metadata, expiresAt } = body;
    
    // Validation
    if (!type || !priority || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: type, priority, title, message' },
        { status: 400 }
      );
    }
    
    const validTypes: AdminNotificationType[] = [
      'new_user', 'new_organization', 'content_report', 'security_alert',
      'system_error', 'performance_issue', 'database_issue', 'high_activity',
      'moderation_required', 'user_complaint'
    ];
    
    const validPriorities: AdminNotificationPriority[] = ['low', 'medium', 'high', 'critical'];
    
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
    }
    
    if (!validPriorities.includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority level' }, { status: 400 });
    }
    
    const { db } = await connectToMongoDB();
    const collection = db.collection('adminNotifications');
    
    const notification: Omit<AdminNotification, '_id'> = {
      type,
      priority,
      title,
      message,
      details,
      actionUrl,
      read: false,
      resolved: false,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt
    };
    
    const result = await collection.insertOne(notification);
    
    // Emit real-time notification to admin clients
    try {
      // TODO: Implement Socket.IO admin notification emit
      console.log('Admin notification created:', result.insertedId);
    } catch (error) {
      console.warn('Failed to emit real-time admin notification:', error);
    }
    
    return NextResponse.json({
      success: true,
      notificationId: result.insertedId,
      notification: { ...notification, _id: result.insertedId }
    });
    
  } catch (error) {
    console.error('Error creating admin notification:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create notification' },
      { status: error instanceof Error && error.message.includes('required') ? 401 : 500 }
    );
  }
}

// PUT /api/admin/notifications - Bulk update notifications (mark as read/resolved)
export async function PUT(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await adminRateLimit(request);
    if (rateLimitResult) return rateLimitResult;

    // Verify admin access
    const session = await verifyAdminAccess();
    
    const body = await request.json();
    const { action, notificationIds, filters } = body;
    
    if (!['markRead', 'markResolved', 'markUnread'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    const { db } = await connectToMongoDB();
    const collection = db.collection('adminNotifications');
    
    let filter: any = {};
    
    // Use specific notification IDs if provided
    if (notificationIds && Array.isArray(notificationIds)) {
      filter._id = { $in: notificationIds.map((id: string) => new ObjectId(id)) };
    }
    // Otherwise use filters
    else if (filters) {
      if (filters.type) filter.type = filters.type;
      if (filters.priority) filter.priority = filters.priority;
      if (filters.unreadOnly) filter.read = false;
    }
    
    let update: any = { updatedAt: new Date().toISOString() };
    
    switch (action) {
      case 'markRead':
        update.read = true;
        break;
      case 'markUnread':
        update.read = false;
        break;
      case 'markResolved':
        update.resolved = true;
        update.resolvedAt = new Date().toISOString();
        update.resolvedBy = session.user.id;
        break;
    }
    
    const result = await collection.updateMany(filter, { $set: update });
    
    return NextResponse.json({
      success: true,
      modifiedCount: result.modifiedCount,
      action
    });
    
  } catch (error) {
    console.error('Error updating admin notifications:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update notifications' },
      { status: error instanceof Error && error.message.includes('required') ? 401 : 500 }
    );
  }
}

// DELETE /api/admin/notifications - Delete notifications
export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await adminRateLimit(request);
    if (rateLimitResult) return rateLimitResult;

    // Verify admin access
    await verifyAdminAccess();
    
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');
    const deleteResolved = searchParams.get('deleteResolved') === 'true';
    const olderThan = searchParams.get('olderThan'); // ISO date string
    
    const { db } = await connectToMongoDB();
    const collection = db.collection('adminNotifications');
    
    let filter: any = {};
    
    if (notificationId) {
      filter._id = new ObjectId(notificationId);
    } else {
      // Bulk delete criteria
      if (deleteResolved) filter.resolved = true;
      if (olderThan) filter.createdAt = { $lt: olderThan };
    }
    
    const result = await collection.deleteMany(filter);
    
    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount
    });
    
  } catch (error) {
    console.error('Error deleting admin notifications:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete notifications' },
      { status: error instanceof Error && error.message.includes('required') ? 401 : 500 }
    );
  }
}
