'use client';

/**
 * PostAdminControls
 *
 * Renders a dropdown menu on community posts for moderators/admins.
 * Actions: pin, unpin, lock, unlock, delete.
 *
 * Only appears if callerRole >= moderator. Server-side checks still enforce
 * permissions on every mutation.
 */

import React, { useTransition } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MoreVertical, Pin, PinOff, Lock, LockOpen, Trash2 } from 'lucide-react';
import type { CommunityRole } from '@/lib/types';
import { setPinPost, setLockPost, adminDeletePost } from '@/app/community-admin-actions';

interface PostAdminControlsProps {
  communityId: string;
  postId: string;
  callerRole: CommunityRole;
  isPinned: boolean;
  isLocked: boolean;
  onPinChange?: (pinned: boolean) => void;
  onLockChange?: (locked: boolean) => void;
  onDelete?: () => void;
  className?: string;
}

const ROLE_LEVEL: Record<CommunityRole, number> = {
  creator: 4,
  admin: 3,
  moderator: 2,
  member: 1,
};

export function PostAdminControls({
  communityId,
  postId,
  callerRole,
  isPinned,
  isLocked,
  onPinChange,
  onLockChange,
  onDelete,
  className,
}: PostAdminControlsProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  // Only moderators and above see these controls
  if (ROLE_LEVEL[callerRole] < ROLE_LEVEL['moderator']) {
    return null;
  }

  function handlePin() {
    startTransition(async () => {
      const result = await setPinPost(communityId, postId, !isPinned);
      if (result.success) {
        toast({ title: isPinned ? 'Post unpinned' : 'Post pinned' });
        onPinChange?.(!isPinned);
      } else {
        toast({ variant: 'destructive', title: 'Failed', description: result.message });
      }
    });
  }

  function handleLock() {
    startTransition(async () => {
      const result = await setLockPost(communityId, postId, !isLocked);
      if (result.success) {
        toast({ title: isLocked ? 'Post unlocked' : 'Post locked' });
        onLockChange?.(!isLocked);
      } else {
        toast({ variant: 'destructive', title: 'Failed', description: result.message });
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await adminDeletePost(communityId, postId);
      if (result.success) {
        toast({ title: 'Post deleted' });
        onDelete?.();
      } else {
        toast({ variant: 'destructive', title: 'Failed', description: result.message });
      }
    });
  }

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${className ?? ''}`}
            disabled={isPending}
            aria-label="Post moderation actions"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Moderation</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handlePin} disabled={isPending}>
            {isPinned ? (
              <>
                <PinOff className="mr-2 h-4 w-4 text-muted-foreground" /> Unpin post
              </>
            ) : (
              <>
                <Pin className="mr-2 h-4 w-4 text-blue-600" /> Pin post
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleLock} disabled={isPending}>
            {isLocked ? (
              <>
                <LockOpen className="mr-2 h-4 w-4 text-muted-foreground" /> Unlock post
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4 text-yellow-600" /> Lock post
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Delete triggers AlertDialog */}
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              disabled={isPending}
              onSelect={e => e.preventDefault()} // keep dropdown open while dialog loads
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete post
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirmation */}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this post?</AlertDialogTitle>
          <AlertDialogDescription>
            The post will be soft-deleted and hidden from the community. This action is logged
            in the moderation audit trail.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleDelete}
          >
            Delete post
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
