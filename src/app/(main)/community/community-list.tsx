
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
import { useSession } from 'next-auth/react';
import { AuthModal } from '@/components/auth-modal';

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
             // Revert to previous state instead of initial state
            setCommunities(currentCommunities);
            toast({ variant: 'destructive', title: 'Could not update membership.' });
        }
    });
  }

  const isUserMember = (community: Community) => {
      return user ? community.members?.includes(user.id) : false;
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
                                <Button asChild variant="secondary">
                                    <Link href={`/community/${communityId}`}>View</Link>
                                </Button>
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
