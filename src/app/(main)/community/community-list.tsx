
"use client";

import { useEffect, useState, useTransition, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Users, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { Community } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { toggleCommunityMembership, searchCommunities } from '@/app/actions';
import { requestToJoinCommunity } from '@/app/community-admin-actions';
import { useSession } from 'next-auth/react';
import { AuthModal } from '@/components/auth-modal';
import { isUserMember as checkUserMembership, addMember, removeMember, updateMemberCount } from '@/lib/community-utils';

const getCommunityCoverImage = (community: Community) => {
  const url = community.imageUrl;
  if (url && typeof url === 'string' && url.trim().length > 0) {
    return url;
  }
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><rect width="800" height="400" fill="%23edf2f7"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="32" fill="%234a5568">${encodeURIComponent(community.name)}</text></svg>`;
};

export function CommunityList({ initialCommunities }: { initialCommunities: Community[] }) {
  const [communities, setCommunities] = useState(initialCommunities);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { data: session, status } = useSession();
  const user = session?.user;
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Update state if initialCommunities prop changes
  useEffect(() => {
    setCommunities(initialCommunities);
  }, [initialCommunities]);

  // Simple debounce using useEffect
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setCommunities(initialCommunities);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const result = await searchCommunities(searchQuery);
        if (result.success) {
          setCommunities(result.communities);
        } else {
          toast({ variant: 'destructive', title: 'Search failed', description: result.message });
        }
      } catch (error) {
        toast({ variant: 'destructive', title: 'Search error' });
      }
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, initialCommunities, toast]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleToggleMembership = (communityId: string, communityName: string, isMember: boolean) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'You must be logged in to join.' });
        return;
    }
    
    // Store current state for proper revert on failure
    const currentCommunities = [...communities];
    
    // Optimistic update using utility functions
    setCommunities(prev => prev.map(c => {
        if (String(c._id) === communityId) {
            const newMembers = isMember 
                ? removeMember(c.members || [], user.id)
                : addMember(c.members || [], user.id);
            const newMemberCount = updateMemberCount(c.memberCount || 0, !isMember);
            
            return { ...c, members: newMembers, memberCount: newMemberCount };
        }
        return c;
    }));

    startTransition(async () => {
        try {
            const result = await toggleCommunityMembership(communityId, isMember);
            if(result.success) {
                toast({ title: isMember ? `You have left ${communityName}` : `Welcome to ${communityName}!` });
            } else {
                // Revert to previous state instead of initial state
                setCommunities(currentCommunities);
                toast({ variant: 'destructive', title: 'Could not update membership.', description: result.message });
            }
        } catch (error) {
            // Revert to previous state on error
            setCommunities(currentCommunities);
            console.error('Error toggling membership:', error);
            toast({ variant: 'destructive', title: 'Network error. Please try again.' });
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
      if (!user) return false;
      return checkUserMembership(community.members, user.id);
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Input 
          placeholder="Search for communities..." 
          className="pl-10 h-12 text-base" 
          value={searchQuery}
          onChange={handleSearchChange}
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      </div>

      {/* Loading State */}
      {isSearching && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Searching communities...</p>
        </div>
      )}

      {/* No Results */}
      {!isSearching && searchQuery && communities.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No communities found matching "{searchQuery}"</p>
        </div>
      )}

      {/* Communities Grid */}
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
                                <Button asChild variant="secondary">
                                    <Link href={`/community/${communityId}`}>View</Link>
                                </Button>
                            ) : community.visibility === 'private' ? (
                                isPendingRequest ? (
                                    <Button disabled variant="outline">
                                        Request Pending
                                    </Button>
                                ) : (
                                    <Button onClick={() => handleRequestJoin(communityId, community.name)} disabled={isPending} variant="outline">
                                        Request to Join
                                    </Button>
                                )
                            ) : (
                                <Button onClick={() => handleToggleMembership(communityId, community.name, false)} disabled={isPending}>
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
    </div>
  )
}
