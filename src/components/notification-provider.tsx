"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSocket } from './socket-provider';
import type { Notification } from '@/lib/types';
import { getUserNotifications } from '@/app/actions';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  refreshNotifications: () => Promise<void>;
  loadMoreNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { data: session } = useSession();
  const user = session?.user;
  const { socket, isConnected } = useSocket();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  const refreshNotifications = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      const result = await getUserNotifications(1, 20);
      if (result.success) {
        setNotifications(result.data.notifications);
        setCurrentPage(1);
        setHasMore(result.data.pagination.hasNext);
      } else {
        console.error('Failed to fetch notifications:', result.message);
        setNotifications([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to refresh notifications:', error);
      setNotifications([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]); // Only depend on user ID, not full user object

  const loadMoreNotifications = useCallback(async () => {
    if (!user?.id || isLoadingMore || !hasMore) return;
    
    try {
      setIsLoadingMore(true);
      const nextPage = currentPage + 1;
      const result = await getUserNotifications(nextPage, 20);
      
      if (result.success) {
        setNotifications(prev => [...prev, ...result.data.notifications]);
        setCurrentPage(nextPage);
        setHasMore(result.data.pagination.hasNext);
      } else {
        console.error('Failed to load more notifications:', result.message);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load more notifications:', error);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [user?.id, isLoadingMore, hasMore, currentPage]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n._id === notificationId ? { ...n, read: true } : n
      )
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // Memoize event handlers to prevent memory leaks
  const handleNewNotification = useCallback((notificationData: Notification) => {
    console.log('New notification received:', notificationData);
    
    // Add new notification to the list
    setNotifications(prev => {
      // Check if notification already exists
      const exists = prev.some(n => n._id === notificationData._id);
      if (exists) return prev;
      
      // Add to beginning of list
      return [notificationData, ...prev];
    });
  }, []);

  const handleNotificationUpdate = useCallback((updateData: { notificationId: string; read: boolean }) => {
    setNotifications(prev => 
      prev.map(n => 
        n._id === updateData.notificationId ? { ...n, read: updateData.read } : n
      )
    );
  }, []);

  // Initial load
  useEffect(() => {
    if (user?.id) {
      refreshNotifications().finally(() => setIsLoading(false));
    } else {
      setNotifications([]);
      setCurrentPage(1);
      setHasMore(false);
      setIsLoading(false);
    }
  }, [user?.id, refreshNotifications]); // Include refreshNotifications as it's stable now

  // Real-time updates
  useEffect(() => {
    if (!user?.id || !socket || !isConnected) return;

    // Join user room for notifications
    socket.emit('joinUserRoom', user.id);

    socket.on('newNotification', handleNewNotification);
    socket.on('notificationUpdate', handleNotificationUpdate);

    return () => {
      socket.off('newNotification', handleNewNotification);
      socket.off('notificationUpdate', handleNotificationUpdate);
    };
  }, [user?.id, socket, isConnected, handleNewNotification, handleNotificationUpdate]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    isLoading,
    isLoadingMore,
    hasMore,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    loadMoreNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
