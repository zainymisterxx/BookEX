'use client';

/**
 * ModerationLogViewer
 *
 * Displays a paginated audit trail of all admin/moderator actions taken in
 * the community, including role changes, bans, post deletions, pinning, etc.
 *
 * Read-only. Accessible to moderators and above.
 */

import React, { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  UserX,
  UserCheck,
  UserMinus,
  Pin,
  Lock,
  Trash2,
  MessageSquareX,
  ArrowRightLeft,
  Settings,
} from 'lucide-react';
import type { CommunityModerationLog, CommunityAdminActionType } from '@/lib/types';

const ACTION_META: Record<CommunityAdminActionType, { label: string; icon: React.ReactNode; color: string }> = {
  member_promoted:          { label: 'Promoted',            icon: <Shield className="h-4 w-4" />,          color: 'text-green-600' },
  member_demoted:           { label: 'Demoted',             icon: <Shield className="h-4 w-4" />,          color: 'text-orange-500' },
  member_removed:           { label: 'Removed',             icon: <UserMinus className="h-4 w-4" />,       color: 'text-red-600' },
  member_banned:            { label: 'Banned',              icon: <UserX className="h-4 w-4" />,           color: 'text-red-600' },
  member_unbanned:          { label: 'Unbanned',            icon: <UserCheck className="h-4 w-4" />,       color: 'text-green-600' },
  join_request_approved:    { label: 'Request approved',    icon: <UserCheck className="h-4 w-4" />,       color: 'text-green-600' },
  join_request_rejected:    { label: 'Request rejected',    icon: <UserX className="h-4 w-4" />,           color: 'text-orange-500' },
  post_pinned:              { label: 'Post pinned',         icon: <Pin className="h-4 w-4" />,             color: 'text-blue-600' },
  post_unpinned:            { label: 'Post unpinned',       icon: <Pin className="h-4 w-4" />,             color: 'text-muted-foreground' },
  post_locked:              { label: 'Post locked',         icon: <Lock className="h-4 w-4" />,            color: 'text-yellow-600' },
  post_unlocked:            { label: 'Post unlocked',       icon: <Lock className="h-4 w-4" />,            color: 'text-muted-foreground' },
  post_deleted:             { label: 'Post deleted',        icon: <Trash2 className="h-4 w-4" />,          color: 'text-red-600' },
  comment_deleted:          { label: 'Comment deleted',     icon: <MessageSquareX className="h-4 w-4" />,  color: 'text-red-600' },
  settings_updated:         { label: 'Settings updated',   icon: <Settings className="h-4 w-4" />,         color: 'text-muted-foreground' },
  ownership_transferred:    { label: 'Ownership transferred', icon: <ArrowRightLeft className="h-4 w-4" />, color: 'text-purple-600' },
};

interface ModerationLogViewerProps {
  communityId: string;
  initialLogs: CommunityModerationLog[];
  initialTotal: number;
  limit?: number;
}

export function ModerationLogViewer({
  communityId,
  initialLogs,
  initialTotal,
  limit = 20,
}: ModerationLogViewerProps) {
  const [logs, setLogs] = useState<CommunityModerationLog[]>(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const fetchPage = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/communities/${communityId}/moderation-log?page=${targetPage}&limit=${limit}`
        );
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs ?? []);
          setTotal(data.total ?? 0);
          setPage(targetPage);
        }
      } finally {
        setLoading(false);
      }
    },
    [communityId, limit]
  );

  if (logs.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
        <Shield className="h-10 w-10 opacity-30" />
        <p className="text-sm">No moderation actions recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[480px] pr-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log, i) => {
              const meta = ACTION_META[log.actionType] ?? {
                label: log.actionType,
                icon: <Shield className="h-4 w-4" />,
                color: 'text-muted-foreground',
              };
              const date = new Date(log.createdAt).toLocaleString(undefined, {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              });

              return (
                <div
                  key={String(log._id ?? i)}
                  className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3"
                >
                  <span className={`mt-0.5 shrink-0 ${meta.color}`}>{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium">{log.actorName}</span>
                      <Badge variant="outline" className="text-xs py-0">{meta.label}</Badge>
                      {log.targetUserName && (
                        <span className="text-sm text-muted-foreground">• {log.targetUserName}</span>
                      )}
                    </div>
                    {log.reason && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">&ldquo;{log.reason}&rdquo;</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {total} total entries
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => fetchPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => fetchPage(page + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
