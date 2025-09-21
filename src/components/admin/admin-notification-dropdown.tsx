'use client';

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Check, CheckCheck, X, AlertTriangle, Info, Users, Shield } from 'lucide-react';
import { useAdminNotifications } from '@/hooks/use-admin-notifications';
import { AdminNotification, AdminNotificationType } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

const notificationIcons: Record<AdminNotificationType, JSX.Element> = {
  new_user: <Users className="h-4 w-4" />,
  new_organization: <Users className="h-4 w-4" />,
  content_report: <AlertTriangle className="h-4 w-4" />,
  security_alert: <Shield className="h-4 w-4" />,
  system_error: <AlertTriangle className="h-4 w-4" />,
  performance_issue: <AlertTriangle className="h-4 w-4" />,
  database_issue: <AlertTriangle className="h-4 w-4" />,
  high_activity: <Info className="h-4 w-4" />,
  moderation_required: <AlertTriangle className="h-4 w-4" />,
  user_complaint: <AlertTriangle className="h-4 w-4" />
};

const priorityColors = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500', 
  high: 'bg-orange-500',
  critical: 'bg-red-500'
};

interface NotificationItemProps {
  notification: AdminNotification;
  onMarkAsRead: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function NotificationItem({ notification, onMarkAsRead, onDelete }: NotificationItemProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleMarkAsRead = async () => {
    if (notification.read) return;
    
    setIsUpdating(true);
    try {
      await onMarkAsRead(notification._id.toString());
    } catch (error) {
      console.error('Failed to mark as read:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsUpdating(true);
    try {
      await onDelete(notification._id.toString());
    } catch (error) {
      console.error('Failed to delete notification:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const NotificationContent = () => (
    <div className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
      !notification.read ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800' : 'bg-gray-50 dark:bg-gray-800/50'
    }`}>
      <div className="flex-shrink-0 mt-0.5">
        <div className={`w-2 h-2 rounded-full ${priorityColors[notification.priority]}`} />
      </div>
      
      <div className="flex items-start space-x-2 flex-1 min-w-0">
        <div className="flex-shrink-0 text-muted-foreground">
          {notificationIcons[notification.type]}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium truncate">{notification.title}</p>
            <div className="flex items-center space-x-1 ml-2">
              {!notification.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleMarkAsRead}
                  disabled={isUpdating}
                  title="Mark as read"
                >
                  <Check className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                onClick={handleDelete}
                disabled={isUpdating}
                title="Delete"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notification.message}</p>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
            </span>
            
            <Badge variant="outline" className="text-xs">
              {notification.priority}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );

  if (notification.actionUrl) {
    return (
      <Link href={notification.actionUrl} className="block">
        <NotificationContent />
      </Link>
    );
  }

  return <NotificationContent />;
}

export function AdminNotificationDropdown() {
  const {
    notifications,
    summary,
    loading,
    error,
    unreadCount,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useAdminNotifications();

  const [isOpen, setIsOpen] = useState(false);

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead([notificationId]);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  if (error) {
    return (
      <Button variant="ghost" size="sm" className="text-muted-foreground" disabled>
        <Bell className="h-4 w-4" />
        <Badge variant="destructive" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
          !
        </Badge>
      </Button>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-muted-foreground relative"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-96 max-h-[80vh]" align="end" forceMount>
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Admin Notifications</span>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={handleMarkAllAsRead}
                disabled={loading}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={refreshNotifications}
              disabled={loading}
            >
              <Bell className="h-3 w-3" />
            </Button>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {loading && notifications.length === 0 ? (
          <div className="p-3 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-start space-x-3">
                <Skeleton className="w-4 h-4 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="p-2 space-y-2">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification._id.toString()}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={deleteNotification}
                />
              ))}
            </div>
          </ScrollArea>
        )}
        
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/notifications" className="w-full text-center text-sm">
                View all notifications
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
