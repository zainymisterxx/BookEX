
"use client";

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { Community } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { toggleCommunityMembership } from '@/app/actions';
import { requestToJoinCommunity } from '@/app/community-admin-actions';
import { useSession } from 'next-auth/react';
import { AuthModal } from '@/components/auth-modal';
import { useSocket } from '@/components/socket-provider';

const getCommunityCoverImage = (community: Community) => {
  const url = community.imageUrl;
  if (url && typeof url === 'string' && url.trim().length > 0) {
    return url;
  }
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><rect width="800" height="400" fill="%23edf2f7"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="32" fill="%234a5568">${encodeURIComponent(community.name)}</text></svg>`;
};

export function CommunityList({ initialCommunities }: { initialCommunities: Community[] }) {
  const [communities, setCommunities] = useState(initialCommunities);
  const { data: session, status } = useSession();
  const user = session?.user;
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const { socket, isConnected, onNewPost, offNewPost } = useSocket();

  useEffect(() => {
    setCommunities(initialCommunities);
  }, [initialCommunities]);

  // Real-time community updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Listen for community member count updates
    const handleCommunityUpdate = (data: { 
      communityId: string; 
      action: 'join' | 'leave' | 'new_community'; 
      memberCount?: number;
      newCommunity?: Community;
    }) => {
      if (data.action === 'new_community' && data.newCommunity) {
        // Add new community to the list
        setCommunities(prev => {
          const exists = prev.some(c => String(c._id) === String(data.newCommunity!._id));
          if (!exists) {
            return [data.newCommunity!, ...prev];
          }
          return prev;
        });
      } else if (data.communityId) {
        // Update member count for existing community
        setCommunities(prev => prev.map(community => {
          if (String(community._id) === data.communityId && data.memberCount !== undefined) {
            return { ...community, memberCount: data.memberCount };
          }
          return community;
        }));
      }
    };

    // Listen for new community creation
    const handleNewCommunity = (data: { community: Community }) => {
      setCommunities(prev => {
        const exists = prev.some(c => String(c._id) === String(data.community._id));
        if (!exists) {
          return [data.community, ...prev];
        }
        return prev;
      });
    };

    // Register event listeners
    socket.on('communityUpdate', handleCommunityUpdate);
    socket.on('newCommunity', handleNewCommunity);

    // Cleanup
    return () => {
      socket.off('communityUpdate', handleCommunityUpdate);
      socket.off('newCommunity', handleNewCommunity);
    };
  }, [socket, isConnected]);

  const handleToggleMembership = (communityId: string, communityName: string, isMember: boolean) => {
    if (!user) return;

    // Optimistic update
    setCommunities(prev => prev.map(c => {
        if (String(c._id) === communityId) {
            const newMemberCount = isMember ? c.memberCount - 1 : c.memberCount + 1;
            const newMembers = isMember 
                ? c.members.filter((member: any) => (typeof member === 'string' ? member : member.userId) !== user.id)
                : [...c.members, user.id];
            return { ...c, members: newMembers, memberCount: newMemberCount } as Community;
        }
        return c;
    }));

    startTransition(async () => {
        const result = await toggleCommunityMembership(communityId, isMember);
        if(result.success) {
            toast({ title: isMember ? `You have left ${communityName}` : `Welcome to ${communityName}!` });
        } else {
             // Revert optimistic update
            setCommunities(initialCommunities);
            toast({ variant: 'destructive', title: 'Could not update membership.', description: result.message });
        }
    });
  }

  const handleRequestJoin = (communityId: string, communityName: string) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'You must be logged in to request to join.' });
        return;
    }
    
    startTransition(async () => {
        try {
            const result = await requestToJoinCommunity(communityId);
            if (result.success) {
                toast({ title: 'Request Sent', description: `Your request to join ${communityName} has been submitted.` });
                
                // Optimistically update pendingRequests so state updates immediately
                setCommunities(prev => prev.map(c => {
                    if (String(c._id) === communityId) {
                        const pendingRequests = c.pendingRequests || [];
                        return {
                            ...c,
                            pendingRequests: [
                                ...pendingRequests,
                                {
                                    userId: user.id,
                                    userName: user.name || '',
                                    communityId,
                                    status: 'pending',
                                    requestedAt: new Date().toISOString()
                                }
                            ]
                        };
                    }
                    return c;
                }));
            } else {
                toast({ variant: 'destructive', title: 'Could not send join request.', description: result.message });
            }
        } catch (error) {
            console.error('Error requesting to join:', error);
            toast({ variant: 'destructive', title: 'Network error. Please try again.' });
        }
    });
  }

  const isUserMember = (community: Community) => {
      return user ? community.members?.some((member: any) => 
        typeof member === 'string' ? member === user.id : member.userId === user.id
      ) : false;
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
    {communities.map((community) => {
      const isMember = isUserMember(community);
      const communityId = String(community._id);
      const isPendingRequest = (community.pendingRequests || []).some(
        r => r.userId === user?.id && r.status === 'pending'
      );

      return (
        <Card key={communityId} className="flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-2 group">
            <div className="relative h-48 w-full overflow-hidden">
              <Link href={`/community/${communityId}`} className="block h-full w-full">
                <Image src={getCommunityCoverImage(community)} alt={community.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" data-ai-hint="community group" />
              </Link>
            </div>
            <div className="flex flex-col flex-1 p-6 bg-card">
                <CardHeader className="p-0 mb-4">
                    <CardTitle className="font-headline text-2xl font-semibold text-primary">
                      <Link href={`/community/${communityId}`}>{community.name}</Link>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                    <p className="text-muted-foreground text-base line-clamp-2">{community.description}</p>
                </CardContent>
                <CardFooter className="p-0 pt-6 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{community.memberCount.toLocaleString()} members</span>
                    </div>
                    {status === 'authenticated' ? (
                        isMember ? (
                             <Button variant="secondary" onClick={() => handleToggleMembership(communityId, community.name, isMember)} disabled={isPending}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Leave
                            </Button>
                        ) : community.visibility === 'private' ? (
                            isPendingRequest ? (
                                <Button disabled variant="outline">
                                    Request Pending
                                </Button>
                            ) : (
                                <Button onClick={() => handleRequestJoin(communityId, community.name)} disabled={isPending} variant="outline">
                                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                    Request to Join
                                </Button>
                            )
                        ) : (
                            <Button onClick={() => handleToggleMembership(communityId, community.name, isMember)} disabled={isPending}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Join
                            </Button>
                        )
                    ) : (
                        <AuthModal>
                            <Button>Join</Button>
                        </AuthModal>
                    )}
                </CardFooter>
            </div>
        </Card>
      )
    })}
    </div>
  )
}
