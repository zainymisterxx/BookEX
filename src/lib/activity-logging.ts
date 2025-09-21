/**
 * User Activity Logging System for BookEx
 * Comprehensive audit trail and security monitoring
 */

import { ObjectId } from 'mongodb';
import { connectToMongoDB } from './mongodb';

export type ActivityType =
  | 'user_signup'
  | 'user_login'
  | 'user_logout'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'profile_update'
  | 'book_listing_create'
  | 'book_listing_update'
  | 'book_listing_delete'
  | 'book_exchange_proposal'
  | 'book_exchange_accept'
  | 'book_exchange_reject'
  | 'book_purchase'
  | 'review_create'
  | 'review_update'
  | 'review_delete'
  | 'message_send'
  | 'wishlist_add'
  | 'wishlist_remove'
  | 'admin_action'
  | 'suspicious_activity'
  | 'account_deactivation'
  | 'account_reactivation'
  | 'donation_initiate'
  | 'donation_chat_message'
  | 'donation_complete'
  | 'organization_application'
  | 'organization_approval'
  | 'organization_rejection'
  | 'organization_admin_add';

export type ActivitySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ActivityLog {
  _id?: ObjectId;
  userId: string;
  activityType: ActivityType;
  severity: ActivitySeverity;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  timestamp: Date;
  expiresAt?: Date; // For automatic cleanup
}

export interface ActivitySummary {
  totalActivities: number;
  activitiesByType: Record<ActivityType, number>;
  activitiesBySeverity: Record<ActivitySeverity, number>;
  recentActivities: ActivityLog[];
  suspiciousActivities: ActivityLog[];
}

/**
 * Get activity logs collection
 */
async function getActivityLogsCollection() {
  const { db } = await connectToMongoDB();
  return db.collection<ActivityLog>('activity_logs');
}

/**
 * Log a user activity
 */
export async function logActivity(
  userId: string,
  activityType: ActivityType,
  severity: ActivitySeverity,
  description: string,
  metadata?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string,
  sessionId?: string
): Promise<void> {
  try {
    const collection = await getActivityLogsCollection();

    const activityLog: Omit<ActivityLog, '_id'> = {
      userId,
      activityType,
      severity,
      description,
      metadata,
      ipAddress,
      userAgent,
      sessionId,
      timestamp: new Date(),
      // Keep logs for 90 days
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    };

    await collection.insertOne(activityLog);

    // Log critical activities to console for immediate attention
    if (severity === 'critical') {
      console.warn(`CRITICAL ACTIVITY: ${activityType} - ${description}`, {
        userId,
        timestamp: activityLog.timestamp,
        metadata
      });
    }

  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - activity logging shouldn't break the main flow
  }
}

/**
 * Get activity logs for a user
 */
export async function getUserActivityLogs(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<ActivityLog[]> {
  try {
    const collection = await getActivityLogsCollection();

    const logs = await collection
      .find({ userId })
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return logs;
  } catch (error) {
    console.error('Failed to get user activity logs:', error);
    return [];
  }
}

/**
 * Get activity logs by type
 */
export async function getActivityLogsByType(
  activityType: ActivityType,
  limit: number = 100,
  offset: number = 0
): Promise<ActivityLog[]> {
  try {
    const collection = await getActivityLogsCollection();

    const logs = await collection
      .find({ activityType })
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return logs;
  } catch (error) {
    console.error('Failed to get activity logs by type:', error);
    return [];
  }
}

/**
 * Get suspicious activities
 */
export async function getSuspiciousActivities(
  limit: number = 50,
  offset: number = 0
): Promise<ActivityLog[]> {
  try {
    const collection = await getActivityLogsCollection();

    const logs = await collection
      .find({
        $or: [
          { severity: 'critical' },
          { severity: 'high' },
          { activityType: 'suspicious_activity' }
        ]
      })
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return logs;
  } catch (error) {
    console.error('Failed to get suspicious activities:', error);
    return [];
  }
}

/**
 * Get activity summary for a user
 */
export async function getUserActivitySummary(userId: string): Promise<ActivitySummary> {
  try {
    const collection = await getActivityLogsCollection();

    const pipeline = [
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalActivities: { $sum: 1 },
          activitiesByType: {
            $push: '$activityType'
          },
          activitiesBySeverity: {
            $push: '$severity'
          },
          recentActivities: { $push: '$$ROOT' }
        }
      },
      {
        $project: {
          totalActivities: 1,
          activitiesByType: {
            $arrayToObject: {
              $map: {
                input: { $setUnion: '$activitiesByType' },
                as: 'type',
                in: {
                  k: '$$type',
                  v: {
                    $size: {
                      $filter: {
                        input: '$activitiesByType',
                        cond: { $eq: ['$$this', '$$type'] }
                      }
                    }
                  }
                }
              }
            }
          },
          activitiesBySeverity: {
            $arrayToObject: {
              $map: {
                input: { $setUnion: '$activitiesBySeverity' },
                as: 'severity',
                in: {
                  k: '$$severity',
                  v: {
                    $size: {
                      $filter: {
                        input: '$activitiesBySeverity',
                        cond: { $eq: ['$$this', '$$severity'] }
                      }
                    }
                  }
                }
              }
            }
          },
          recentActivities: { $slice: ['$recentActivities', 10] }
        }
      }
    ];

    const result = await collection.aggregate(pipeline).toArray();

    if (result.length === 0) {
      return {
        totalActivities: 0,
        activitiesByType: {} as Record<ActivityType, number>,
        activitiesBySeverity: {} as Record<ActivitySeverity, number>,
        recentActivities: [],
        suspiciousActivities: []
      };
    }

    const summary = result[0];

    // Get suspicious activities separately
    const suspiciousActivities = await collection
      .find({
        userId,
        $or: [
          { severity: 'critical' },
          { severity: 'high' },
          { activityType: 'suspicious_activity' }
        ]
      })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    return {
      totalActivities: summary.totalActivities,
      activitiesByType: summary.activitiesByType,
      activitiesBySeverity: summary.activitiesBySeverity,
      recentActivities: summary.recentActivities,
      suspiciousActivities
    };

  } catch (error) {
    console.error('Failed to get user activity summary:', error);
    return {
      totalActivities: 0,
      activitiesByType: {} as Record<ActivityType, number>,
      activitiesBySeverity: {} as Record<ActivitySeverity, number>,
      recentActivities: [],
      suspiciousActivities: []
    };
  }
}

/**
 * Clean up old activity logs (called by maintenance job)
 */
export async function cleanupOldActivityLogs(daysToKeep: number = 90): Promise<number> {
  try {
    const collection = await getActivityLogsCollection();

    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await collection.deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    return result.deletedCount;
  } catch (error) {
    console.error('Failed to cleanup old activity logs:', error);
    return 0;
  }
}

/**
 * Initialize activity logs collection with indexes
 */
export async function initializeActivityLogsCollection(): Promise<void> {
  try {
    const collection = await getActivityLogsCollection();

    // Create indexes for better performance
    await collection.createIndex({ userId: 1, timestamp: -1 });
    await collection.createIndex({ activityType: 1, timestamp: -1 });
    await collection.createIndex({ severity: 1, timestamp: -1 });
    await collection.createIndex({ timestamp: -1 });
    await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    console.log('Activity logs collection initialized successfully');
  } catch (error) {
    console.error('Failed to initialize activity logs collection:', error);
  }
}

/**
 * Detect suspicious activity patterns
 */
export async function detectSuspiciousActivity(
  userId: string,
  activityType: ActivityType,
  metadata?: Record<string, any>
): Promise<boolean> {
  try {
    const collection = await getActivityLogsCollection();

    // Check for rapid password reset attempts
    if (activityType === 'password_reset_request') {
      const recentResets = await collection.countDocuments({
        userId,
        activityType: 'password_reset_request',
        timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
      });

      if (recentResets > 5) {
        await logActivity(
          userId,
          'suspicious_activity',
          'high',
          'Multiple password reset attempts detected',
          { resetCount: recentResets, timeWindow: '1 hour' }
        );
        return true;
      }
    }

    // Check for rapid login failures
    if (metadata?.loginFailed) {
      const recentFailures = await collection.countDocuments({
        userId,
        activityType: 'user_login',
        'metadata.loginFailed': true,
        timestamp: { $gte: new Date(Date.now() - 30 * 60 * 1000) } // Last 30 minutes
      });

      if (recentFailures > 10) {
        await logActivity(
          userId,
          'suspicious_activity',
          'high',
          'Multiple login failures detected',
          { failureCount: recentFailures, timeWindow: '30 minutes' }
        );
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Failed to detect suspicious activity:', error);
    return false;
  }
}
