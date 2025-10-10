"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Crown, 
  Shield, 
  User, 
  MoreHorizontal,
  UserPlus,
  UserMinus,
  Ban,
  CheckCircle,
  AlertCircle,
  Clock,
  MessageCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Community, CommunityRole } from '@/lib/types';
import type { Session } from 'next-auth';
import { useToast } from '@/hooks/use-toast';
import { useTransition } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useSocket } from '@/components/socket-provider';

interface MemberWithDetails {
  userId: string;
  role: CommunityRole;
  joinedAt: string;
  banned?: boolean;
  banReason?: string;
  bannedAt?: string;
  user: {
    _id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    city?: string;
    bio?: string;
    createdAt: string;
  } | null;
}

interface MemberSidebarProps {
  community: Community;
  currentUser: Session["user"] | null;
  userRole: CommunityRole | null;
}

export function MemberSidebar({ community, currentUser, userRole }: MemberSidebarProps) {
  const [members, setMembers] = useState<MemberWithDetails[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { socket, isConnected } = useSocket();

  // Fetch members with user details
  useEffect(() => {
    const fetchMembers = async () => {
      try {
  const response = await apiFetch(`/communities/${community._id}/members`);
        if (response.ok) {
          const data = await response.json();
          setMembers(data.members || []);
        } else {
          console.error('Failed to fetch members');
        }
      } catch (error) {
        console.error('Error fetching members:', error);
      }
    };

    fetchMembers();
  }, [community._id]);

  // Handle socket events for online/offline status
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleUserOnline = (data: { userId: string; communityId: string }) => {
      if (data.communityId === community._id) {
        setOnlineUsers(prev => new Set([...prev, data.userId]));
      }
    };

    const handleUserOffline = (data: { userId: string; communityId: string }) => {
      if (data.communityId === community._id) {
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.userId);
          return newSet;
        });
      }
    };

    socket.on('userOnline', handleUserOnline);
    socket.on('userOffline', handleUserOffline);

    return () => {
      socket.off('userOnline', handleUserOnline);
      socket.off('userOffline', handleUserOffline);
    };
  }, [socket, isConnected, community._id]);

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

  const getStatusIcon = (member: MemberWithDetails) => {
    if (member.banned) {
      return <Ban className="h-3 w-3 text-red-500" />;
    }
    const isOnline = onlineUsers.has(member.userId);
    return isOnline ? 
      <CheckCircle className="h-3 w-3 text-green-500" /> : 
      <Clock className="h-3 w-3 text-gray-400" />;
  };

  const getStatusColor = (member: MemberWithDetails) => {
    if (member.banned) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    const isOnline = onlineUsers.has(member.userId);
    return isOnline ? 
      'bg-green-100 text-green-800 border-green-200' : 
      'bg-gray-100 text-gray-600 border-gray-200';
  };

  const getStatusText = (member: MemberWithDetails) => {
    if (member.banned) {
      return 'Banned';
    }
    const isOnline = onlineUsers.has(member.userId);
    return isOnline ? 'Online' : 'Offline';
  };

  const canModerate = userRole === 'admin' || userRole === 'moderator';
  const isAdmin = userRole === 'admin';

  const handleMemberAction = async (member: any, action: string) => {
    if (!canModerate) return;

    startTransition(async () => {
      try {
  const response = await apiFetch(`/communities/${community._id}/members/${member.userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // Update local state
            setMembers(prev => prev.map(m => 
              m.userId === member.userId 
                ? { ...m, ...result.updatedMember }
                : m
            ));
            
            toast({ 
              title: 'Action completed', 
              description: `${action} action completed successfully.` 
            });
          } else {
            toast({ 
              variant: 'destructive', 
              title: 'Action failed', 
              description: result.message || 'Failed to complete action.' 
            });
          }
        } else {
          toast({ 
            variant: 'destructive', 
            title: 'Action failed', 
            description: 'Failed to complete action.' 
          });
        }
      } catch (error) {
        console.error('Error performing member action:', error);
        toast({ 
          variant: 'destructive', 
          title: 'Network Error', 
          description: 'Unable to complete action. Please try again.' 
        });
      }
    });
  };

  // Deduplicate members by userId first, then group by role
  const uniqueMembers = members.reduce((acc, member) => {
    const existingMember = acc.find(m => m.userId === member.userId);
    if (!existingMember) {
      acc.push(member);
    } else {
      // If duplicate found, prefer the one with banned status (more recent state)
      const index = acc.findIndex(m => m.userId === member.userId);
      if (member.banned || member.role === 'admin') {
        acc[index] = member;
      }
    }
    return acc;
  }, [] as typeof members);

  // Group members by role - ensure no duplicates
  const admins = uniqueMembers.filter(m => m.role === 'admin' && !m.banned);
  const moderators = uniqueMembers.filter(m => m.role === 'moderator' && !m.banned);
  const regularMembers = uniqueMembers.filter(m => m.role === 'member' && !m.banned);
  const bannedMembers = uniqueMembers.filter(m => m.banned);

  return (
    <div className="w-80 bg-background border-l border-border flex flex-col">
      <div className="p-4">
        <div className="pb-3">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5" />
            Members ({members.length})
          </h3>
        </div>
        <div className="space-y-4">
          {/* Admins */}
          {admins.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-700">Administrators</span>
              </div>
              <div className="space-y-2">
                {admins.map((member, index) => (
                  <MemberItem
                    key={`admin-${member.userId}-${index}`}
                    member={member}
                    currentUser={currentUser}
                    userRole={userRole}
                    onAction={handleMemberAction}
                    canModerate={canModerate}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Moderators */}
          {moderators.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-blue-700">Moderators</span>
              </div>
              <div className="space-y-2">
                {moderators.map((member, index) => (
                  <MemberItem
                    key={`moderator-${member.userId}-${index}`}
                    member={member}
                    currentUser={currentUser}
                    userRole={userRole}
                    onAction={handleMemberAction}
                    canModerate={canModerate}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Regular Members */}
          {regularMembers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Members</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {regularMembers.map((member, index) => (
                  <MemberItem
                    key={`regular-${member.userId}-${index}`}
                    member={member}
                    currentUser={currentUser}
                    userRole={userRole}
                    onAction={handleMemberAction}
                    canModerate={canModerate}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Banned Members */}
          {bannedMembers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Ban className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-red-700">Banned</span>
              </div>
              <div className="space-y-2">
                {bannedMembers.map((member, index) => (
                  <MemberItem
                    key={`banned-${member.userId}-${index}`}
                    member={member}
                    currentUser={currentUser}
                    userRole={userRole}
                    onAction={handleMemberAction}
                    canModerate={canModerate}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Individual Member Item Component
function MemberItem({ 
  member, 
  currentUser, 
  userRole, 
  onAction, 
  canModerate, 
  isAdmin 
}: {
  member: MemberWithDetails;
  currentUser: Session["user"] | null;
  userRole: CommunityRole | null;
  onAction: (member: MemberWithDetails, action: string) => void;
  canModerate: boolean;
  isAdmin: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const isSelf = member.userId === currentUser?.id;
  const { socket } = useSocket();

  const handleMessageUser = () => {
    // Navigate to messages page or open chat modal
    window.location.href = `/messages?user=${member.userId}`;
  };

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

  const getStatusIcon = (member: any) => {
    if (member.banned) {
      return <Ban className="h-3 w-3 text-red-500" />;
    }
    return <CheckCircle className="h-3 w-3 text-green-500" />;
  };

  const getStatusColor = (member: any) => {
    if (member.banned) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getStatusText = (member: any) => {
    if (member.banned) {
      return 'Banned';
    }
    return 'Online';
  };

  return (
    <div 
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <Avatar className="h-8 w-8 border-2 flex-shrink-0">
        <AvatarImage src={member.user?.avatarUrl} />
        <AvatarFallback className="text-xs">
          {member.user?.name?.charAt(0).toUpperCase() || member.userId.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {member.user?.name || member.userId}
          </span>
          {getRoleIcon(member.role)}
        </div>
        
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={cn("text-xs", getRoleColor(member.role))}>
            {member.role}
          </Badge>
          <Badge variant="outline" className={cn("text-xs", getStatusColor(member))}>
            {getStatusIcon(member)}
            <span className="ml-1">{getStatusText(member)}</span>
          </Badge>
        </div>
      </div>

      {/* Member Actions */}
      <div className="flex items-center gap-1">
        {/* Message button - always visible for non-self members */}
        {!isSelf && member.user && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleMessageUser}
            className="h-6 px-2 text-xs"
            title="Send message"
          >
            <MessageCircle className="h-3 w-3" />
          </Button>
        )}
        
        {/* Moderation actions */}
        {canModerate && !isSelf && showActions && (
          <>
            {isAdmin && member.role === 'member' && !member.banned && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction(member, 'promote')}
                className="h-6 px-2 text-xs"
                title="Promote to moderator"
              >
                <UserPlus className="h-3 w-3" />
              </Button>
            )}
            
            {isAdmin && member.role === 'moderator' && !member.banned && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction(member, 'demote')}
                className="h-6 px-2 text-xs"
                title="Demote to member"
              >
                <UserMinus className="h-3 w-3" />
              </Button>
            )}
            
            {!member.banned && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onAction(member, 'ban')}
                className="h-6 px-2 text-xs"
                title="Ban member"
              >
                <Ban className="h-3 w-3" />
              </Button>
            )}
            
            {member.banned && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction(member, 'unban')}
                className="h-6 px-2 text-xs"
                title="Unban member"
              >
                <CheckCircle className="h-3 w-3" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
