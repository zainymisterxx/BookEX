'use client';

/**
 * AdminSettingsPanel
 *
 * The full community admin control center. Displayed server-side only to
 * members with admin or creator roles. Tabs:
 *
 *   1. General    — name, description, image, cover, rules, visibility & permissions
 *   2. Members    — full membership list with promote/demote/remove/ban
 *   3. Requests   — pending join requests (private communities only)
 *   4. Mod Log    — paginated audit trail
 *   5. Danger     — ownership transfer
 *
 * All mutations delegate to server actions which enforce permissions again
 * server-side, making the UI checks advisory only.
 */

import React, { useState, useTransition } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Settings, Users, Clock, Shield, AlertTriangle, Loader2, Crown } from 'lucide-react';
import type { Community, CommunityRole, JoinRequest, CommunityModerationLog } from '@/lib/types';
import { MembershipManager } from './membership-manager';
import { PendingRequestsPanel } from './pending-requests-panel';
import { ModerationLogViewer } from './moderation-log-viewer';
import { updateCommunitySettings, transferCommunityOwnership } from '@/app/community-admin-actions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberWithUser {
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

interface AdminSettingsPanelProps {
  community: Community;
  membersWithDetails: MemberWithUser[];
  pendingRequests: JoinRequest[];
  moderationLogs: CommunityModerationLog[];
  moderationLogsTotal: number;
  callerId: string;
  callerRole: CommunityRole;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PERMISSION_OPTIONS = [
  { value: 'anyone',       label: 'Anyone' },
  { value: 'members_only', label: 'Members only' },
  { value: 'admins_only',  label: 'Admins only' },
];

const INVITE_OPTIONS = [
  { value: 'anyone',      label: 'Any member' },
  { value: 'admins_only', label: 'Admins only' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminSettingsPanel({
  community,
  membersWithDetails,
  pendingRequests,
  moderationLogs,
  moderationLogsTotal,
  callerId,
  callerRole,
}: AdminSettingsPanelProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // General settings form state
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description);
  const [imageUrl, setImageUrl] = useState(community.imageUrl ?? '');
  const [coverImage, setCoverImage] = useState(community.coverImage ?? '');
  const [rules, setRules] = useState(community.rules ?? '');
  const [isPrivate, setIsPrivate] = useState(community.visibility === 'private');
  const [postingPerm, setPostingPerm] = useState<string>(community.postingPermissions ?? 'anyone');
  const [commentPerm, setCommentPerm] = useState<string>(community.commentPermissions ?? 'anyone');
  const [invitePerm, setInvitePerm] = useState<string>(community.invitePermissions ?? 'anyone');

  // Ownership transfer state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [newOwnerIdInput, setNewOwnerIdInput] = useState('');
  const [confirmNameInput, setConfirmNameInput] = useState('');

  const communityId = String(community._id);

  // General settings save
  function handleSaveGeneralSettings() {
    startTransition(async () => {
      const result = await updateCommunitySettings(communityId, {
        name: name.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim() || undefined,
        coverImage: coverImage.trim() || undefined,
        rules: rules || undefined,
        visibility: isPrivate ? 'private' : 'public',
        postingPermissions: postingPerm as any,
        commentPermissions: commentPerm as any,
        invitePermissions: invitePerm as any,
      });
      if (result.success) {
        toast({ title: 'Settings saved successfully' });
      } else {
        toast({ variant: 'destructive', title: 'Save failed', description: result.message });
      }
    });
  }

  // Ownership transfer
  function handleTransferOwnership() {
    startTransition(async () => {
      const result = await transferCommunityOwnership(communityId, {
        newOwnerId: newOwnerIdInput.trim(),
        confirmName: confirmNameInput.trim(),
      });
      if (result.success) {
        toast({ title: 'Ownership transferred. Redirecting...' });
        setTransferDialogOpen(false);
        // Soft reload to reflect revoked permissions
        window.location.href = `/community/${communityId}`;
      } else {
        toast({ variant: 'destructive', title: 'Transfer failed', description: result.message });
      }
    });
  }

  const isOwner = callerRole === 'creator';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">Community Settings</h1>
          <p className="text-sm text-muted-foreground">{community.name}</p>
        </div>
        <Badge variant={isOwner ? 'default' : 'secondary'} className="ml-auto">
          {isOwner ? (
            <><Crown className="mr-1 h-3 w-3" /> Owner</>
          ) : (
            'Admin'
          )}
        </Badge>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">
            <Settings className="mr-1.5 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="mr-1.5 h-4 w-4" />
            Members
            <Badge variant="outline" className="ml-1.5 text-xs">{membersWithDetails.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="requests" disabled={!isPrivate && pendingRequests.length === 0}>
            <Clock className="mr-1.5 h-4 w-4" />
            Requests
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-xs">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="modlog">
            <Shield className="mr-1.5 h-4 w-4" />
            Mod Log
          </TabsTrigger>
          <TabsTrigger value="danger">
            <AlertTriangle className="mr-1.5 h-4 w-4" />
            Danger
          </TabsTrigger>
        </TabsList>

        {/* ── General Settings ─────────────────────────────────────────── */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Update community name, description, images, rules and access permissions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Identity */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Identity</h3>
                <div className="space-y-2">
                  <Label htmlFor="comm-name">Community Name</Label>
                  <Input
                    id="comm-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={50}
                    placeholder="Community name"
                  />
                  <p className="text-xs text-muted-foreground">{name.length}/50</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comm-desc">Description</Label>
                  <Textarea
                    id="comm-desc"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Describe your community..."
                  />
                  <p className="text-xs text-muted-foreground">{description.length}/1000</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="comm-image">Avatar Image URL</Label>
                    <Input id="comm-image" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comm-cover">Cover Image URL</Label>
                    <Input id="comm-cover" value={coverImage} onChange={e => setCoverImage(e.target.value)} placeholder="https://..." />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comm-rules">Rules (Markdown)</Label>
                  <Textarea
                    id="comm-rules"
                    value={rules}
                    onChange={e => setRules(e.target.value)}
                    maxLength={5000}
                    rows={5}
                    placeholder="## Community Rules&#10;1. Be respectful..."
                  />
                  <p className="text-xs text-muted-foreground">{rules.length}/5000</p>
                </div>
              </section>

              <Separator />

              {/* Privacy */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Privacy</h3>
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Private community</p>
                    <p className="text-xs text-muted-foreground">
                      {isPrivate
                        ? 'New members must request to join and be approved.'
                        : 'Anyone can join without approval.'}
                    </p>
                  </div>
                  <Switch
                    checked={isPrivate}
                    onCheckedChange={setIsPrivate}
                    aria-label="Toggle community privacy"
                  />
                </div>
              </section>

              <Separator />

              {/* Permissions */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Permissions</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Who can post?</Label>
                    <Select value={postingPerm} onValueChange={setPostingPerm}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PERMISSION_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Who can comment?</Label>
                    <Select value={commentPerm} onValueChange={setCommentPerm}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PERMISSION_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Who can invite members?</Label>
                    <Select value={invitePerm} onValueChange={setInvitePerm}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INVITE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveGeneralSettings} disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Members ──────────────────────────────────────────────────── */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Member Management</CardTitle>
              <CardDescription>
                Promote, demote, remove, ban, or unban members. Actions are role-checked server-side
                and logged to the moderation audit trail.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MembershipManager
                communityId={communityId}
                members={membersWithDetails}
                callerRole={callerRole}
                callerId={callerId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Join Requests ─────────────────────────────────────────────── */}
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Join Requests</CardTitle>
              <CardDescription>
                {isPrivate
                  ? 'Approve or reject membership requests for this private community.'
                  : 'This community is public. Switch to private mode to enable join requests.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PendingRequestsPanel
                communityId={communityId}
                initialRequests={pendingRequests}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Moderation Log ────────────────────────────────────────────── */}
        <TabsContent value="modlog">
          <Card>
            <CardHeader>
              <CardTitle>Moderation Audit Log</CardTitle>
              <CardDescription>
                Complete history of all admin and moderator actions in this community.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ModerationLogViewer
                communityId={communityId}
                initialLogs={moderationLogs}
                initialTotal={moderationLogsTotal}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Danger Zone ──────────────────────────────────────────────── */}
        <TabsContent value="danger">
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                These actions are irreversible or have significant consequences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Transfer Ownership */}
              {isOwner && (
                <div className="flex items-start justify-between gap-4 rounded-lg border border-destructive/30 p-4">
                  <div>
                    <p className="font-medium text-sm">Transfer Ownership</p>
                    <p className="text-sm text-muted-foreground">
                      Transfer community ownership to another admin. You will be demoted to admin.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground shrink-0"
                    onClick={() => {
                      setNewOwnerIdInput('');
                      setConfirmNameInput('');
                      setTransferDialogOpen(true);
                    }}
                  >
                    Transfer
                  </Button>
                </div>
              )}

              {!isOwner && (
                <p className="text-sm text-muted-foreground">
                  Only the community owner can perform danger zone actions.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Ownership Transfer Dialog ─────────────────────────────────── */}
      <AlertDialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Community Ownership</AlertDialogTitle>
            <AlertDialogDescription>
              This will make another member the owner. You will be demoted to admin. This action
              is logged and cannot be undone without the new owner&apos;s consent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-owner-id">New Owner&apos;s User ID</Label>
              <Input
                id="new-owner-id"
                placeholder="Paste the member's user ID..."
                value={newOwnerIdInput}
                onChange={e => setNewOwnerIdInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The user must be a current member of this community.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-name">
                Type the community name to confirm: <span className="font-semibold">{community.name}</span>
              </Label>
              <Input
                id="confirm-name"
                placeholder={community.name}
                value={confirmNameInput}
                onChange={e => setConfirmNameInput(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={
                !newOwnerIdInput.trim() ||
                confirmNameInput !== community.name ||
                isPending
              }
              onClick={handleTransferOwnership}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Transfer ownership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
