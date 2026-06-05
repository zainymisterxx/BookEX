"use client";

import { useAdminNotifications } from "@/hooks/use-admin-notifications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bell, Check, CheckCheck, X, AlertTriangle, Shield, Info, Users, ChevronLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { AdminNotificationType } from "@/lib/types";

const notificationIcons: Record<AdminNotificationType, JSX.Element> = {
  new_user: <Users className="h-5 w-5" />,
  new_organization: <Users className="h-5 w-5" />,
  content_report: <AlertTriangle className="h-5 w-5" />,
  security_alert: <Shield className="h-5 w-5" />,
  system_error: <AlertTriangle className="h-5 w-5" />,
  performance_issue: <AlertTriangle className="h-5 w-5" />,
  database_issue: <AlertTriangle className="h-5 w-5" />,
  high_activity: <Info className="h-5 w-5" />,
  moderation_required: <AlertTriangle className="h-5 w-5" />,
  user_complaint: <AlertTriangle className="h-5 w-5" />
};

const priorityColors = {
  low: "bg-blue-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  critical: "bg-red-500"
};

const priorityBadgeVariants = {
  low: "secondary" as const,
  medium: "outline" as const,
  high: "destructive" as const,
  critical: "destructive" as const
};

export default function AdminNotificationsPage() {
  const {
    notifications,
    loading,
    error,
    unreadCount,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useAdminNotifications();

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="gap-2 mb-4">
          <Link href="/admin">
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight font-headline flex items-center gap-3">
              <Bell className="h-8 w-8 text-primary" />
              Admin Notifications
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor system alerts, content reports, user signups, and security issues.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                disabled={loading}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark all as read
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={refreshNotifications}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Notifications</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={refreshNotifications}>Retry</Button>
          </CardContent>
        </Card>
      ) : loading && notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold mb-2">All caught up!</h3>
            <p className="text-muted-foreground">
              You have no recent administrator notifications.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => {
            const isRead = notification.read;
            return (
              <Card 
                key={notification._id.toString()} 
                className={`transition-all duration-200 border ${
                  !isRead 
                    ? "bg-blue-50/50 border-blue-200 shadow-sm dark:bg-blue-950/10 dark:border-blue-900" 
                    : "bg-card border-border"
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      <div className={`w-3 h-3 rounded-full ${priorityColors[notification.priority]}`} title={`Priority: ${notification.priority}`} />
                    </div>

                    <div className={`flex-shrink-0 p-2 rounded-lg ${!isRead ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-muted text-muted-foreground"}`}>
                      {notificationIcons[notification.type] || <Bell className="h-5 w-5" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                        <h3 className={`text-base font-semibold ${!isRead ? "text-foreground" : "text-muted-foreground"}`}>
                          {notification.title}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      
                      <p className={`text-sm mb-4 leading-relaxed ${!isRead ? "text-foreground" : "text-muted-foreground"}`}>
                        {notification.message}
                      </p>

                      {notification.details && (
                        <div className="p-3 bg-muted/50 rounded-lg text-xs font-mono text-muted-foreground mb-4 break-all">
                          {notification.details}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={priorityBadgeVariants[notification.priority]}>
                            {notification.priority}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {notification.type.replace('_', ' ')}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          {!isRead && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => markAsRead([notification._id.toString()])}
                            >
                              <Check className="h-3.5 w-3.5 mr-1.5" />
                              Mark as read
                            </Button>
                          )}
                          {notification.actionUrl && (
                            <Button variant="secondary" size="sm" className="h-8" asChild>
                              <Link href={notification.actionUrl}>
                                Action Link
                              </Link>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteNotification(notification._id.toString())}
                          >
                            <X className="h-3.5 w-3.5 mr-1.5" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
