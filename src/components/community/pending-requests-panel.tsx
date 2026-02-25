'use client';

/**
 * PendingRequestsPanel
 *
 * Displays all pending join requests for a private community.
 * Allows admins/moderators to approve or reject individual requests.
 *
 * Real-time updates are handled via Socket.IO: the parent admin panel
 * listens for `communityJoinRequestUpdated` events.
 */

import React, { useState, useTransition } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { approveJoinRequest, rejectJoinRequest } from '@/app/community-admin-actions';
import type { JoinRequest } from '@/lib/types';

interface PendingRequestsPanelProps {
  communityId: string;
  initialRequests: JoinRequest[];
}

export function PendingRequestsPanel({ communityId, initialRequests }: PendingRequestsPanelProps) {
  const [requests, setRequests] = useState<JoinRequest[]>(initialRequests);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const { toast } = useToast();

  function markProcessing(userId: string, processing: boolean) {
    setProcessingIds(prev => {
      const next = new Set(prev);
      processing ? next.add(userId) : next.delete(userId);
      return next;
    });
  }

  function removeRequest(userId: string) {
    setRequests(prev => prev.filter(r => r.userId !== userId));
  }

  function handleApprove(req: JoinRequest) {
    const userId = req.userId;
    markProcessing(userId, true);
    startTransition(async () => {
      const result = await approveJoinRequest(communityId, userId);
      markProcessing(userId, false);
      if (result.success) {
        removeRequest(userId);
        toast({ title: `Approved ${req.userName}'s request` });
      } else {
        toast({ variant: 'destructive', title: 'Failed to approve', description: result.message });
      }
    });
  }

  function handleReject(req: JoinRequest) {
    const userId = req.userId;
    markProcessing(userId, true);
    startTransition(async () => {
      const result = await rejectJoinRequest(communityId, userId);
      markProcessing(userId, false);
      if (result.success) {
        removeRequest(userId);
        toast({ title: `Rejected ${req.userName}'s request` });
      } else {
        toast({ variant: 'destructive', title: 'Failed to reject', description: result.message });
      }
    });
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
        <Clock className="h-10 w-10 opacity-30" />
        <p className="text-sm">No pending join requests</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">{requests.length}</Badge>
        <span>pending {requests.length === 1 ? 'request' : 'requests'}</span>
      </div>

      {requests.map(req => {
        const isProcessing = processingIds.has(req.userId);
        const requestedAt = new Date(req.requestedAt).toLocaleDateString(undefined, {
          day: 'numeric', month: 'short', year: 'numeric',
        });

        return (
          <div
            key={req.userId}
            className="flex items-start justify-between gap-3 rounded-lg border bg-card px-4 py-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                <AvatarImage src={req.userAvatarUrl} alt={req.userName} />
                <AvatarFallback>{req.userName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium truncate">{req.userName}</p>
                <p className="text-xs text-muted-foreground">Requested {requestedAt}</p>
                {req.message && (
                  <p className="text-xs text-muted-foreground italic truncate max-w-xs">
                    &ldquo;{req.message}&rdquo;
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 dark:border-green-800 dark:hover:bg-green-950"
                disabled={isProcessing}
                onClick={() => handleApprove(req)}
              >
                <CheckCircle className="mr-1.5 h-4 w-4" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950"
                disabled={isProcessing}
                onClick={() => handleReject(req)}
              >
                <XCircle className="mr-1.5 h-4 w-4" />
                Reject
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
