"use client";

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Shield, ShieldOff, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { suspendUser, activateUser, deleteUser } from '@/app/actions';
import type { User } from '@/lib/types';

interface AdminUserActionsProps {
  user: User;
  onUserStatusChanged: (userId: string, newStatus: 'active' | 'suspended') => void;
  onUserDeleted: (userId: string) => void;
}

export function AdminUserActions({ user, onUserStatusChanged, onUserDeleted }: AdminUserActionsProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const userId = String(user._id);
  const userStatus = user.status || 'active';
  const isCurrentUserAdmin = user.role === 'admin';

  const handleSuspendUser = () => {
    if (isCurrentUserAdmin) {
      toast({ variant: 'destructive', title: 'Cannot suspend admin users' });
      return;
    }

    startTransition(async () => {
      const result = await suspendUser(userId);
      if (result.success) {
        onUserStatusChanged(userId, 'suspended');
        toast({ title: 'User suspended successfully' });
      } else {
        toast({ variant: 'destructive', title: 'Failed to suspend user', description: result.message });
      }
    });
  };

  const handleActivateUser = () => {
    startTransition(async () => {
      const result = await activateUser(userId);
      if (result.success) {
        onUserStatusChanged(userId, 'active');
        toast({ title: 'User activated successfully' });
      } else {
        toast({ variant: 'destructive', title: 'Failed to activate user', description: result.message });
      }
    });
  };

  const handleDeleteUser = () => {
    if (isCurrentUserAdmin) {
      toast({ variant: 'destructive', title: 'Cannot delete admin users' });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete user "${user.name}"? This action cannot be undone and will permanently remove all associated data including books, reviews, and messages.`
    );

    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteUser(userId);
      if (result.success) {
        onUserDeleted(userId);
        toast({ title: 'User deleted successfully', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Failed to delete user', description: result.message });
      }
    });
  };

  if (isCurrentUserAdmin) {
    return <span className="text-muted-foreground text-sm">Admin</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {userStatus === 'active' ? (
          <DropdownMenuItem onClick={handleSuspendUser} className="text-destructive">
            <ShieldOff className="mr-2 h-4 w-4" />
            Suspend User
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={handleActivateUser}>
            <Shield className="mr-2 h-4 w-4" />
            Activate User
          </DropdownMenuItem>
        )}
        {!isCurrentUserAdmin && (
          <DropdownMenuItem onClick={handleDeleteUser} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete User
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
