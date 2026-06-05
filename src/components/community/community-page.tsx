"use client";

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  MessageSquare, 
  Hash, 
  Users, 
  Crown, 
  Shield, 
  User, 
  ChevronDown,
  ChevronRight,
  Settings,
  Plus,
  X,
  Menu,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Community, CommunityRole, ChatMessage } from '@/lib/types';
import type { Session } from 'next-auth';
import { ForumChannel } from './forum-channel';
import { ChatChannel } from './chat-channel';
import { MemberSidebar } from './member-sidebar';
import { isMember, getMemberInfo } from '@/lib/community-permissions-client';
import { useToast } from '@/hooks/use-toast';
import { toggleCommunityMembership, createChannel } from '@/app/actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CommunityPageProps {
  community: Community;
  currentUser: Session["user"] | null;
}

export function CommunityPage({ community, currentUser }: CommunityPageProps) {
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [userRole, setUserRole] = useState<CommunityRole | null>(null);
  const [showChannelSidebar, setShowChannelSidebar] = useState(false);
  const [showMemberSidebar, setShowMemberSidebar] = useState(false);

  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  // Add Channel Modal states
  const [addChannelOpen, setAddChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'forum' | 'chat'>('forum');
  const [newChannelDesc, setNewChannelDesc] = useState('');

  const handleToggleMembership = () => {
    if (!currentUser || !community) {
      toast({ variant: 'destructive', title: 'You must be logged in to join.' });
      return;
    }
    const communityId = String(community._id);
    startTransition(async () => {
      try {
        const result = await toggleCommunityMembership(communityId, isMember);
        if (result.success) {
          setIsMember(!isMember);
          toast({ 
            title: isMember ? `You left ${community.name}` : `Welcome to ${community.name}!`,
            description: isMember ? "You are no longer a member." : "You successfully joined the community!"
          });
          window.location.reload();
        } else {
          toast({ variant: 'destructive', title: 'Could not update membership.', description: result.message });
        }
      } catch (err) {
        toast({ variant: 'destructive', title: 'Network error. Please try again.' });
      }
    });
  };

  const handleCreateChannelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newChannelName.trim();
    if (!name) return;
    const communityId = String(community._id);
    startTransition(async () => {
      try {
        const result = await createChannel(communityId, {
          name,
          type: newChannelType,
          description: newChannelDesc.trim() || undefined
        });
        if (result.success) {
          toast({ title: 'Channel created successfully!' });
          setAddChannelOpen(false);
          setNewChannelName('');
          setNewChannelDesc('');
          window.location.reload();
        } else {
          toast({ variant: 'destructive', title: 'Failed to create channel', description: result.message });
        }
      } catch {
        toast({ variant: 'destructive', title: 'Network error. Please try again.' });
      }
    });
  };

  // Get user membership status and role
  useEffect(() => {
    if (currentUser?.id && community?.members) {
      try {
        const memberInfo = getMemberInfo(currentUser.id, community);
        if (memberInfo) {
          setIsMember(true);
          setUserRole(memberInfo.role);
        } else {
          setIsMember(false);
          setUserRole(null);
        }
      } catch (error) {
        console.error('Error getting member info:', error);
        setIsMember(false);
        setUserRole(null);
      }
    } else {
      setIsMember(false);
      setUserRole(null);
    }
  }, [currentUser, community.members]);

  // Set default channel on load
  useEffect(() => {
    if (community.channels && community.channels.length > 0 && !activeChannel) {
      setActiveChannel(community.channels[0]._id);
    }
  }, [community, community.channels, activeChannel]);

  // Add error boundary for community data
  if (!community) {
    return (
      <div className="flex h-screen bg-secondary items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Community Not Found</h2>
          <p className="text-muted-foreground">The community you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  // Group channels by type
  const forumChannels = community.channels?.filter(c => c.type === 'forum') || [];
  const chatChannels = community.channels?.filter(c => c.type === 'chat') || [];

  const getRoleIcon = (role: CommunityRole) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-3 w-3 text-yellow-500" />;
      case 'moderator':
        return <Shield className="h-3 w-3 text-blue-500" />;
      default:
        return <User className="h-3 w-3 text-gray-500" />;
    }
  };

  const getRoleColor = (role: CommunityRole) => {
    switch (role) {
      case 'admin':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'moderator':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const activeChannelData = community.channels?.find(c => c._id === activeChannel);

  return (
    <div className="flex h-screen bg-secondary">
      {/* Mobile Channel Sidebar Overlay */}
      {showChannelSidebar && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowChannelSidebar(false)} />
          <div className="absolute left-0 top-0 w-64 h-full bg-background border-r border-border flex flex-col">
            {/* Mobile Channel Content - Same as desktop but with close button */}
            <div className="p-4 border-b border-border">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={community.imageUrl} alt={community.name} />
                    <AvatarFallback>{community.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h1 className="font-semibold text-lg truncate">{community.name}</h1>
                    <p className="text-sm text-muted-foreground truncate">{community.description}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowChannelSidebar(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant={isMember ? "outline" : "default"}
                size="sm"
                className="w-full mt-2"
                onClick={handleToggleMembership}
                disabled={isPending}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isMember ? "Leave Community" : "Join Community"}
              </Button>
            </div>
            {/* Channel List - Same as desktop */}
            <div className="flex-1 overflow-y-auto">
              {forumChannels.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <MessageSquare className="h-3 w-3" />
                    Forum Channels
                  </div>
                  {forumChannels.map((channel) => (
                    <Button
                      key={channel._id}
                      variant={activeChannel === channel._id ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-2 h-8 px-2 text-sm",
                        activeChannel === channel._id && "bg-primary/10 text-primary"
                      )}
                      onClick={() => {
                        setActiveChannel(channel._id);
                        setShowChannelSidebar(false);
                      }}
                    >
                      <Hash className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{channel.name}</span>
                    </Button>
                  ))}
                </div>
              )}
              {chatChannels.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <MessageSquare className="h-3 w-3" />
                    Chat Channels
                  </div>
                  {chatChannels.map((channel) => (
                    <Button
                      key={channel._id}
                      variant={activeChannel === channel._id ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-2 h-8 px-2 text-sm",
                        activeChannel === channel._id && "bg-primary/10 text-primary"
                      )}
                      onClick={() => {
                        setActiveChannel(channel._id);
                        setShowChannelSidebar(false);
                      }}
                    >
                      <Hash className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{channel.name}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Left Sidebar - Channels */}
      <div className="w-64 bg-background border-r border-border flex flex-col hidden lg:flex">
        {/* Community Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={community.imageUrl} alt={community.name} />
              <AvatarFallback>{community.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-lg truncate">{community.name}</h1>
              <p className="text-sm text-muted-foreground truncate">{community.description}</p>
            </div>
            {userRole && (userRole === 'creator' || userRole === 'admin') && (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <Link href={`/community/${community._id}/settings`}>
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
          <Button
            variant={isMember ? "outline" : "default"}
            size="sm"
            className="w-full mt-3"
            onClick={handleToggleMembership}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isMember ? "Leave Community" : "Join Community"}
          </Button>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto">
          {/* Forum Channels */}
          {forumChannels.length > 0 && (
            <div className="p-2">
              <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <MessageSquare className="h-3 w-3" />
                Forum Channels
              </div>
              {forumChannels.map((channel) => (
                <Button
                  key={channel._id}
                  variant={activeChannel === channel._id ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-2 h-8 px-2 text-sm",
                    activeChannel === channel._id && "bg-primary/10 text-primary"
                  )}
                  onClick={() => setActiveChannel(channel._id)}
                >
                  <Hash className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{channel.name}</span>
                </Button>
              ))}
            </div>
          )}

          {/* Chat Channels */}
          {chatChannels.length > 0 && (
            <div className="p-2">
              <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <MessageSquare className="h-3 w-3" />
                Chat Channels
              </div>
              {chatChannels.map((channel) => (
                <Button
                  key={channel._id}
                  variant={activeChannel === channel._id ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-2 h-8 px-2 text-sm",
                    activeChannel === channel._id && "bg-primary/10 text-primary"
                  )}
                  onClick={() => setActiveChannel(channel._id)}
                >
                  <Hash className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{channel.name}</span>
                </Button>
              ))}
            </div>
          )}

          {/* Add Channel Button (Admin/Moderator only) */}
          {userRole && (userRole === 'admin' || userRole === 'moderator') && (
            <div className="p-2">
              <Dialog open={addChannelOpen} onOpenChange={setAddChannelOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 px-2 text-sm text-muted-foreground hover:text-foreground">
                    <Plus className="h-3 w-3" />
                    Add Channel
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <form onSubmit={handleCreateChannelSubmit}>
                    <DialogHeader>
                      <DialogTitle>Add New Channel</DialogTitle>
                      <DialogDescription>
                        Create a new channel in this community.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                          Name
                        </Label>
                        <Input
                          id="name"
                          value={newChannelName}
                          onChange={(e) => setNewChannelName(e.target.value)}
                          placeholder="general"
                          className="col-span-3"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="type" className="text-right">
                          Type
                        </Label>
                        <Select
                          value={newChannelType}
                          onValueChange={(value) => setNewChannelType(value as 'forum' | 'chat')}
                        >
                          <SelectTrigger id="type" className="col-span-3">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="forum">Forum</SelectItem>
                            <SelectItem value="chat">Chat</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="description" className="text-right">
                          Description
                        </Label>
                        <Input
                          id="description"
                          value={newChannelDesc}
                          onChange={(e) => setNewChannelDesc(e.target.value)}
                          placeholder="Channel description"
                          className="col-span-3"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setAddChannelOpen(false)} disabled={isPending}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isPending || !newChannelName.trim()}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Channel
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* User Info */}
        {currentUser && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={currentUser.image || undefined} alt={currentUser.name || ''} />
                <AvatarFallback>{currentUser.name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{currentUser.name}</p>
                {userRole && (
                  <Badge variant="outline" className={cn("text-xs", getRoleColor(userRole))}>
                    {getRoleIcon(userRole)}
                    <span className="ml-1 capitalize">{userRole}</span>
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Channel Content */}
        <div className="flex-1 flex flex-col">
          {activeChannelData ? (
            <>
              {/* Channel Header */}
              <div className="p-4 border-b border-border bg-background">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="lg:hidden"
                    onClick={() => setShowChannelSidebar(true)}
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold text-lg">{activeChannelData.name}</h2>
                  {activeChannelData.description && (
                    <span className="text-sm text-muted-foreground hidden sm:inline">- {activeChannelData.description}</span>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="ml-auto xl:hidden"
                    onClick={() => setShowMemberSidebar(true)}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Channel Content */}
              <div className="flex-1 overflow-hidden">
                {activeChannelData.type === 'forum' ? (
                  <ForumChannel
                    channelId={activeChannelData._id}
                    communityId={community._id as string}
                    currentUser={currentUser}
                    userRole={userRole}
                    isMember={isMember}
                  />
                ) : (
                  <ChatChannel
                    channelId={activeChannelData._id}
                    communityId={community._id as string}
                    currentUser={currentUser}
                    userRole={userRole}
                    isMember={isMember}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <Card className="w-96">
                <CardContent className="pt-6 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Welcome to {community.name}</h3>
                  <p className="text-muted-foreground">
                    Select a channel to start participating in the community.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Mobile Member Sidebar Overlay */}
        {showMemberSidebar && (
          <div className="fixed inset-0 z-50 xl:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowMemberSidebar(false)} />
            <div className="absolute right-0 top-0 w-80 h-full bg-background border-l border-border">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Members</h2>
                  <Button variant="ghost" size="icon" onClick={() => setShowMemberSidebar(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="h-full overflow-y-auto">
                <MemberSidebar
                  community={community}
                  currentUser={currentUser}
                  userRole={userRole}
                />
              </div>
            </div>
          </div>
        )}

        {/* Member Sidebar */}
        <div className="hidden xl:block">
          <MemberSidebar
            community={community}
            currentUser={currentUser}
            userRole={userRole}
          />
        </div>
      </div>
    </div>
  );
}
