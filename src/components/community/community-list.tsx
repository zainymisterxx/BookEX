
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
import { useSession } from 'next-auth/react';
import { AuthModal } from '@/components/auth-modal';
import { useSocket } from '@/components/socket-provider';

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
                ? c.members.filter(id => id !== user.id)
                : [...c.members, user.id];
            return { ...c, members: newMembers, memberCount: newMemberCount };
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
            toast({ variant: 'destructive', title: 'Could not update membership.' });
        }
    });
  }

  const isUserMember = (community: Community) => {
      return user ? community.members?.includes(user.id) : false;
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
    {communities.map((community) => {
      const isMember = isUserMember(community);
      const communityId = String(community._id);
      return (
        <Card key={communityId} className="flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-2 group">
            <div className="relative h-48 w-full overflow-hidden">
              <Link href={`/community/${communityId}`} className="block h-full w-full">
                <Image src={community.imageUrl} alt={community.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" data-ai-hint="community group" />
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
