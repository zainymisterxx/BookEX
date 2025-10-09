'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminNotification, AdminNotificationSummary } from '@/lib/types';
import { apiFetch } from '@/lib/api-client';

interface UseAdminNotificationsReturn {
  notifications: AdminNotification[];
  summary: AdminNotificationSummary | null;
  loading: boolean;
  error: string | null;
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationIds: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

export function useAdminNotifications(): UseAdminNotificationsReturn {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [summary, setSummary] = useState<AdminNotificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both summary and recent notifications
      const [summaryResponse, notificationsResponse] = await Promise.all([
        apiFetch('/api/admin/notifications?summary=true'),
        apiFetch('/api/admin/notifications?limit=10&unreadOnly=false')
      ]);

      if (!summaryResponse.ok || !notificationsResponse.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const summaryData = await summaryResponse.json();
      const notificationsData = await notificationsResponse.json();

      setSummary(summaryData);
      setNotifications(notificationsData.notifications || []);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
      console.error('Error fetching admin notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationIds: string[]) => {
    try {
      const response = await apiFetch('/api/admin/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'markRead',
          notificationIds
        })
      });

      if (!response.ok) {
        throw new Error('Failed to mark notifications as read');
      }

      // Update local state
      setNotifications(prev =>
        prev.map(notification =>
          notificationIds.includes(notification._id.toString())
            ? { ...notification, read: true }
            : notification
        )
      );

      // Update summary
      if (summary) {
        setSummary(prev => prev ? {
          ...prev,
          unread: Math.max(0, prev.unread - notificationIds.length)
        } : null);
      }

    } catch (err) {
      console.error('Error marking notifications as read:', err);
      throw err;
    }
  }, [summary]);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await apiFetch('/api/admin/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'markRead',
          filters: { unreadOnly: true }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }

      // Update local state
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, read: true }))
      );

      // Update summary
      setSummary(prev => prev ? { ...prev, unread: 0 } : null);

    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      throw err;
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/admin/notifications?id=${notificationId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }

      // Update local state
      setNotifications(prev => prev.filter(n => n._id.toString() !== notificationId));

      // Update summary
      if (summary) {
        setSummary(prev => {
          if (!prev) return null;
          const notification = notifications.find(n => n._id.toString() === notificationId);
          return {
            ...prev,
            total: prev.total - 1,
            unread: notification && !notification.read ? prev.unread - 1 : prev.unread
          };
        });
      }

    } catch (err) {
      console.error('Error deleting notification:', err);
      throw err;
    }
  }, [notifications, summary]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return {
    notifications,
    summary,
    loading,
    error,
    unreadCount: summary?.unread || 0,
    refreshNotifications: fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  };
}
