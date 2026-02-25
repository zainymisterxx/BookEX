'use client';

/**
 * MembershipManager
 *
 * Displays the full member list for a community with role-aware action menus.
 * Actions: promote, demote, remove, ban, unban.
 *
 * Only renders actions the caller actually has permission to perform — an
 * additional server-side check fires on each mutation.
 */

import React, { useState, useTransition } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, Shield, ShieldCheck, ShieldX, UserMinus, UserX, UserCheck, Crown } from 'lucide-react';
import type { CommunityRole } from '@/lib/types';
import {
  promoteMember,
  demoteMember,
  removeMemberFromCommunity,
  banMemberFromCommunity,
  unbanMemberFromCommunity,
} from '@/app/community-admin-actions';

interface Member {
  userId: string;
  role: CommunityRole;
  joinedAt: string;
  banned?: boolean;
  banReason?: string;
  user?: {
    _id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

interface MembershipManagerProps {
  communityId: string;
  members: Member[];
  callerRole: CommunityRole;
  callerId: string;
  onMembersChange?: () => void;
}

const ROLE_LEVEL: Record<CommunityRole, number> = {
  creator: 4,
  admin: 3,
  moderator: 2,
  member: 1,
};

const ROLE_BADGE: Record<CommunityRole, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  creator: { label: 'Owner', variant: 'default' },
  admin:   { label: 'Admin', variant: 'default' },
  moderator: { label: 'Moderator', variant: 'secondary' },
  member: { label: 'Member', variant: 'outline' },
};

type ConfirmDialog =
  | { type: 'ban'; member: Member }
  | { type: 'remove'; member: Member }
  | null;

export function MembershipManager({
  communityId,
  members: initialMembers,
  callerRole,
  callerId,
  onMembersChange,
}: MembershipManagerProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);
  const [banReason, setBanReason] = useState('');
  const [removeReason, setRemoveReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const callerLevel = ROLE_LEVEL[callerRole];

  function canActOn(target: Member): boolean {
    if (target.userId === callerId) return false;
    return callerLevel > ROLE_LEVEL[target.role];
  }

  function applyRoleChange(userId: string, newRole: CommunityRole) {
    setMembers(prev =>
      prev.map(m => (m.userId === userId ? { ...m, role: newRole } : m))
    );
    onMembersChange?.();
  }

  function applyBanChange(userId: string, banned: boolean) {
    setMembers(prev =>
      prev.map(m => (m.userId === userId ? { ...m, banned } : m))
    );
    onMembersChange?.();
  }

  function applyRemove(userId: string) {
    setMembers(prev => prev.filter(m => m.userId !== userId));
    onMembersChange?.();
  }

  function handleAction(
    fn: () => Promise<{ success: boolean; message: string; newRole?: string }>,
    onSuccess: () => void,
    successMsg: string
  ) {
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        toast({ title: successMsg });
        onSuccess();
      } else {
        toast({ variant: 'destructive', title: 'Action failed', description: result.message });
      }
    });
  }

  const sorted = [...members].sort(
    (a, b) => ROLE_LEVEL[b.role] - ROLE_LEVEL[a.role]
  );

  return (
    <div className="space-y-2">
      {sorted.map(member => {
        const displayName = member.user?.name ?? member.userId;
        const { label, variant } = ROLE_BADGE[member.role] ?? { label: member.role, variant: 'outline' as const };

        return (
          <div
            key={member.userId}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 ${member.banned ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30' : 'bg-card'}`}
          >
            {/* Avatar + info */}
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={member.user?.avatarUrl} alt={displayName} />
                <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-none">{displayName}</p>
                {member.user?.email && (
                  <p className="truncate text-xs text-muted-foreground mt-0.5">{member.user.email}</p>
                )}
                {member.banned && member.banReason && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                    Banned: {member.banReason}
                  </p>
                )}
              </div>
            </div>

            {/* Role badge + actions */}
            <div className="flex items-center gap-2 shrink-0">
              {member.role === 'creator' && <Crown className="h-4 w-4 text-yellow-500" aria-label="Owner" />}
              {member.banned && (
                <Badge variant="destructive" className="text-xs">Banned</Badge>
              )}
              <Badge variant={variant} className="text-xs">{label}</Badge>

              {canActOn(member) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Member actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Actions for {displayName}</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {/* Promote — only if there's a tier above and caller's level is sufficient */}
                    {!member.banned && member.role !== 'admin' && callerLevel >= ROLE_LEVEL['admin'] && (
                      <DropdownMenuItem
                        onClick={() =>
                          handleAction(
                            () => promoteMember(communityId, member.userId),
                            () => {
                              const next: Record<CommunityRole, CommunityRole> = {
                                member: 'moderator',
                                moderator: 'admin',
                                admin: 'creator',
                                creator: 'creator',
                              };
                              applyRoleChange(member.userId, next[member.role]);
                            },
                            'Member promoted'
                          )
                        }
                      >
                        <ShieldCheck className="mr-2 h-4 w-4 text-green-600" />
                        Promote
                      </DropdownMenuItem>
                    )}

                    {/* Demote — only if member has a role above 'member' */}
                    {!member.banned && member.role !== 'member' && member.role !== 'creator' && callerLevel >= ROLE_LEVEL['admin'] && (
                      <DropdownMenuItem
                        onClick={() =>
                          handleAction(
                            () => demoteMember(communityId, member.userId),
                            () => {
                              const prev: Record<CommunityRole, CommunityRole> = {
                                admin: 'moderator',
                                moderator: 'member',
                                member: 'member',
                                creator: 'admin',
                              };
                              applyRoleChange(member.userId, prev[member.role]);
                            },
                            'Member demoted'
                          )
                        }
                      >
                        <ShieldX className="mr-2 h-4 w-4 text-orange-600" />
                        Demote
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    {/* Ban / Unban */}
                    {member.banned ? (
                      <DropdownMenuItem
                        onClick={() =>
                          handleAction(
                            () => unbanMemberFromCommunity(communityId, member.userId),
                            () => applyBanChange(member.userId, false),
                            'Member unbanned'
                          )
                        }
                      >
                        <UserCheck className="mr-2 h-4 w-4 text-green-600" />
                        Unban
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => {
                          setBanReason('');
                          setConfirmDialog({ type: 'ban', member });
                        }}
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Ban
                      </DropdownMenuItem>
                    )}

                    {/* Remove */}
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onClick={() => {
                        setRemoveReason('');
                        setConfirmDialog({ type: 'remove', member });
                      }}
                    >
                      <UserMinus className="mr-2 h-4 w-4" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        );
      })}

      {/* Ban confirmation dialog */}
      <AlertDialog
        open={confirmDialog?.type === 'ban'}
        onOpenChange={open => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will ban{' '}
              <strong>{confirmDialog?.type === 'ban' ? (confirmDialog.member.user?.name ?? confirmDialog.member.userId) : ''}</strong>{' '}
              from the community. They will remain in the members list but cannot interact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="ban-reason">Reason (required)</Label>
            <Input
              id="ban-reason"
              placeholder="Enter ban reason..."
              value={banReason}
              onChange={e => setBanReason(e.target.value)}
              maxLength={500}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!banReason.trim() || isPending}
              onClick={() => {
                if (confirmDialog?.type !== 'ban') return;
                const { member } = confirmDialog;
                handleAction(
                  () => banMemberFromCommunity(communityId, { targetUserId: member.userId, reason: banReason }),
                  () => applyBanChange(member.userId, true),
                  'Member banned'
                );
                setConfirmDialog(null);
              }}
            >
              Ban member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove confirmation dialog */}
      <AlertDialog
        open={confirmDialog?.type === 'remove'}
        onOpenChange={open => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{' '}
              <strong>{confirmDialog?.type === 'remove' ? (confirmDialog.member.user?.name ?? confirmDialog.member.userId) : ''}</strong>{' '}
              from the community. They can rejoin if the community is public.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="remove-reason">Reason (optional)</Label>
            <Input
              id="remove-reason"
              placeholder="Enter reason..."
              value={removeReason}
              onChange={e => setRemoveReason(e.target.value)}
              maxLength={500}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending}
              onClick={() => {
                if (confirmDialog?.type !== 'remove') return;
                const { member } = confirmDialog;
                handleAction(
                  () => removeMemberFromCommunity(communityId, member.userId, removeReason || undefined),
                  () => applyRemove(member.userId),
                  'Member removed'
                );
                setConfirmDialog(null);
              }}
            >
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
