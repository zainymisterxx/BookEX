/**
 * Admin Notification Service
 * Handles creation and aggregation of system-wide notifications for administrators
 */

import { connectToMongoDB } from '@/lib/mongodb';
import { AdminNotification, AdminNotificationType, AdminNotificationPriority } from '@/lib/types';

export interface CreateAdminNotificationParams {
  type: AdminNotificationType;
  priority: AdminNotificationPriority;
  title: string;
  message: string;
  details?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  expiresAt?: string;
}

/**
 * Create a new admin notification
 */
export async function createAdminNotification(params: CreateAdminNotificationParams): Promise<string> {
  try {
    const { db } = await connectToMongoDB();
    const collection = db.collection('adminNotifications');
    
    // Check for duplicate notifications based on type and metadata
    const deduplicationKey = createDeduplicationKey(params.type, params.metadata);
    
    // For some types, prevent duplicates within a time window
    if (shouldDeduplicate(params.type)) {
      const existing = await collection.findOne({
        type: params.type,
        'metadata.deduplicationKey': deduplicationKey,
        createdAt: { $gte: new Date(Date.now() - getDeduplicationWindow(params.type)).toISOString() },
        resolved: false
      });
      
      if (existing) {
        // Update count if it's an aggregatable notification
        if (params.metadata?.count) {
          await collection.updateOne(
            { _id: existing._id },
            { 
              $inc: { 'metadata.count': params.metadata.count },
              $set: { updatedAt: new Date().toISOString() }
            }
          );
          return existing._id.toString();
        }
        return existing._id.toString();
      }
    }
    
    const notification: Omit<AdminNotification, '_id'> = {
      type: params.type,
      priority: params.priority,
      title: params.title,
      message: params.message,
      details: params.details,
      actionUrl: params.actionUrl,
      read: false,
      resolved: false,
      metadata: {
        ...params.metadata,
        deduplicationKey
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: params.expiresAt
    };
    
    const result = await collection.insertOne(notification);
    
    // TODO: Emit real-time notification
    console.log(`Admin notification created: ${params.type} - ${params.title}`);
    
    return result.insertedId.toString();
    
  } catch (error) {
    console.error('Error creating admin notification:', error);
    throw error;
  }
}

/**
 * Create notification for new user registration
 */
export async function notifyNewUser(userId: string, userEmail: string, userName?: string): Promise<void> {
  await createAdminNotification({
    type: 'new_user',
    priority: 'low',
    title: 'New User Registration',
    message: `New user ${userName || userEmail} has registered`,
    actionUrl: `/admin/users?search=${userEmail}`,
    metadata: {
      userId,
      userEmail,
      userName
    }
  });
}

/**
 * Create notification for organization application
 */
export async function notifyNewOrganization(organizationId: string, organizationName: string, applicantEmail: string): Promise<void> {
  await createAdminNotification({
    type: 'new_organization',
    priority: 'medium',
    title: 'New Organization Application',
    message: `"${organizationName}" has applied for organization status`,
    actionUrl: `/admin/organizations?id=${organizationId}`,
    metadata: {
      organizationId,
      organizationName,
      applicantEmail
    }
  });
}

/**
 * Create notification for content report
 */
export async function notifyContentReport(reportId: string, contentType: string, contentId: string, reason: string): Promise<void> {
  await createAdminNotification({
    type: 'content_report',
    priority: 'high',
    title: 'Content Reported',
    message: `${contentType} reported for: ${reason}`,
    actionUrl: `/admin/moderation?reportId=${reportId}`,
    metadata: {
      reportId,
      contentType,
      contentId,
      reason
    }
  });
}

/**
 * Create notification for security alert
 */
export async function notifySecurityAlert(alertType: string, message: string, severity: 'low' | 'medium' | 'high' | 'critical'): Promise<void> {
  const priorityMap: Record<string, AdminNotificationPriority> = {
    low: 'low',
    medium: 'medium', 
    high: 'high',
    critical: 'critical'
  };
  
  await createAdminNotification({
    type: 'security_alert',
    priority: priorityMap[severity] || 'medium',
    title: `Security Alert: ${alertType}`,
    message,
    actionUrl: '/admin/security',
    metadata: {
      alertType,
      severity
    }
  });
}

/**
 * Create notification for system errors
 */
export async function notifySystemError(errorType: string, errorMessage: string, count: number = 1): Promise<void> {
  await createAdminNotification({
    type: 'system_error',
    priority: count > 10 ? 'high' : 'medium',
    title: `System Error: ${errorType}`,
    message: count > 1 ? `${errorMessage} (${count} occurrences)` : errorMessage,
    actionUrl: '/admin/logs',
    metadata: {
      errorType,
      errorMessage,
      count
    }
  });
}

/**
 * Create notification for performance issues
 */
export async function notifyPerformanceIssue(metric: string, value: number, threshold: number): Promise<void> {
  await createAdminNotification({
    type: 'performance_issue',
    priority: value > threshold * 2 ? 'high' : 'medium',
    title: `Performance Alert: ${metric}`,
    message: `${metric} is ${value}, exceeding threshold of ${threshold}`,
    actionUrl: '/admin/performance',
    metadata: {
      metric,
      value,
      threshold
    }
  });
}

/**
 * Create notification for high activity
 */
export async function notifyHighActivity(activityType: string, count: number, timeWindow: string): Promise<void> {
  await createAdminNotification({
    type: 'high_activity',
    priority: 'medium',
    title: `High Activity Detected`,
    message: `${count} ${activityType} in ${timeWindow}`,
    actionUrl: '/admin/analytics',
    metadata: {
      activityType,
      count,
      timeWindow
    }
  });
}

/**
 * Create notification for moderation requirements
 */
export async function notifyModerationRequired(contentType: string, contentId: string, reason: string): Promise<void> {
  await createAdminNotification({
    type: 'moderation_required',
    priority: 'medium',
    title: 'Moderation Required',
    message: `${contentType} needs review: ${reason}`,
    actionUrl: `/admin/moderation?contentId=${contentId}`,
    metadata: {
      contentType,
      contentId,
      reason
    }
  });
}

/**
 * Create notification for user complaints
 */
export async function notifyUserComplaint(complaintId: string, complainantId: string, targetId: string, reason: string): Promise<void> {
  await createAdminNotification({
    type: 'user_complaint',
    priority: 'high',
    title: 'User Complaint',
    message: `User complaint filed: ${reason}`,
    actionUrl: `/admin/complaints?id=${complaintId}`,
    metadata: {
      complaintId,
      complainantId,
      targetId,
      reason
    }
  });
}

/**
 * Cleanup expired notifications
 */
export async function cleanupExpiredNotifications(): Promise<number> {
  try {
    const { db } = await connectToMongoDB();
    const collection = db.collection('adminNotifications');
    
    const result = await collection.deleteMany({
      expiresAt: { $lte: new Date().toISOString() }
    });
    
    if (result.deletedCount > 0) {
      console.log(`Cleaned up ${result.deletedCount} expired admin notifications`);
    }
    
    return result.deletedCount;
    
  } catch (error) {
    console.error('Error cleaning up expired notifications:', error);
    return 0;
  }
}

/**
 * Get notification count for admin header badge
 */
export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const { db } = await connectToMongoDB();
    const collection = db.collection('adminNotifications');
    
    return await collection.countDocuments({ 
      read: false,
      resolved: false 
    });
    
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return 0;
  }
}

// Helper functions

function createDeduplicationKey(type: AdminNotificationType, metadata?: Record<string, any>): string {
  const base = `${type}`;
  
  if (!metadata) return base;
  
  // Create key based on notification type
  switch (type) {
    case 'new_user':
      return `${base}:${metadata.userId}`;
    case 'content_report':
      return `${base}:${metadata.contentType}:${metadata.contentId}`;
    case 'system_error':
      return `${base}:${metadata.errorType}`;
    case 'performance_issue':
      return `${base}:${metadata.metric}`;
    case 'security_alert':
      return `${base}:${metadata.alertType}`;
    default:
      return base;
  }
}

function shouldDeduplicate(type: AdminNotificationType): boolean {
  const deduplicateTypes: AdminNotificationType[] = [
    'system_error',
    'performance_issue', 
    'high_activity',
    'security_alert'
  ];
  
  return deduplicateTypes.includes(type);
}

function getDeduplicationWindow(type: AdminNotificationType): number {
  // Return deduplication window in milliseconds
  switch (type) {
    case 'system_error':
      return 30 * 60 * 1000; // 30 minutes
    case 'performance_issue':
      return 15 * 60 * 1000; // 15 minutes
    case 'high_activity':
      return 60 * 60 * 1000; // 1 hour
    case 'security_alert':
      return 60 * 60 * 1000; // 1 hour
    default:
      return 5 * 60 * 1000; // 5 minutes
  }
}
