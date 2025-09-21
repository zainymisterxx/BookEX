
"use client";

import { useEffect, useState } from 'react';
import type { Book as BookType, Community, User, WishlistItem } from '@/lib/types';
import { useSession } from 'next-auth/react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Star, Settings, Loader2 } from 'lucide-react';
import { BookCard } from '@/components/book-card';
import Link from 'next/link';
import Image from 'next/image';
import { AuthModal } from '@/components/auth-modal';
import { getMyProfileData } from '@/app/actions';

interface MyProfileData {
  profileUser: User;
  userListings: BookType[];
  wishlist: BookType[];
  userCommunities: Community[];
}

export default function MyProfilePage() {
  const { data: session, status } = useSession();
  const user = session?.user;
  
  const [data, setData] = useState<MyProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user?.id) {
        setIsLoading(true);
        try {
          const profileData = await getMyProfileData(user.id);
          const { totalRatingPoints = 0, reviews = 0 } = profileData.profileUser;
          profileData.profileUser.averageRating = reviews > 0 ? parseFloat((totalRatingPoints / reviews).toFixed(1)) : 0;
          setData(profileData);
        } catch (error) {
            console.error("Error fetching user profile data:", error);
        } finally {
            setIsLoading(false);
        }
      } else if (status !== 'loading') {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [user, status]);

  if (status === 'loading' || isLoading) {
    return (
        <div className="container py-12 md:py-16 flex justify-center items-center min-h-[60vh]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  if (!user || !data?.profileUser) {
    return (
      <div className="bg-secondary">
        <div className="container py-12 md:py-16 text-center min-h-[60vh] flex flex-col justify-center items-center">
            <h2 className="text-2xl font-bold font-headline">Please log in</h2>
            <p className="text-muted-foreground mt-2 mb-6">You need to be logged in to view your profile.</p>
            <AuthModal>
              <Button size="lg">Login</Button>
            </AuthModal>
        </div>
      </div>
    )
  }

  const { profileUser, userListings, wishlist, userCommunities } = data;

  return (
    <div className="bg-secondary">
      <div className="container py-12 md:py-16">
          <Card className="mb-8 border-2 shadow-xl shadow-primary/10">
              <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                      <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                          <AvatarImage src={user.image || undefined} alt={user.name || 'User'} />
                          <AvatarFallback className="text-4xl">{user.name?.charAt(0) || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-center md:text-left">
                          <h1 className="text-4xl font-bold font-headline text-primary">{user.name}</h1>
                          <div className="flex items-center justify-center md:justify-start gap-6 text-muted-foreground mt-2">
                              <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4" />
                                  <span>{profileUser.city || 'City not set'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                  <Star className="w-5 h-5 text-accent fill-accent" />
                                  <span className="font-semibold">{profileUser.averageRating}</span> 
                                  <span>({profileUser.reviews} reviews)</span>
                              </div>
                          </div>
                      </div>
                      <div className="flex gap-2">
                        <Button asChild variant="outline" size="lg">
                          <Link href="/profile/settings">
                            <Settings className="h-4 w-4 mr-2" />
                            Profile Settings
                          </Link>
                        </Button>
                      </div>
                  </div>
              </CardContent>
          </Card>

          <Tabs defaultValue="listings" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-14">
                  <TabsTrigger value="listings" className="text-base">My Listings ({userListings.length})</TabsTrigger>
                  <TabsTrigger value="wishlist" className="text-base">Wishlist ({wishlist.length})</TabsTrigger>
                  <TabsTrigger value="communities" className="text-base">My Communities ({userCommunities.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="listings" className="mt-8">
                {userListings.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {userListings.map(book => <BookCard key={String(book._id)} book={book} showManageOptions={true} />)}
                    </div>
                ) : (
                  <div className="text-center py-16 bg-background rounded-lg border-2 border-dashed">
                    <h3 className="text-xl font-semibold font-headline">No listings yet!</h3>
                    <p className="text-muted-foreground mt-2 mb-6">You haven't listed any books for sale or exchange.</p>
                    <Button asChild>
                      <Link href="/books/sell">List a Book</Link>
                    </Button>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="wishlist" className="mt-8">
                {wishlist.length > 0 ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {wishlist.map((book) => (
                            <BookCard key={String(book._id)} book={book} showManageOptions={false} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-background rounded-lg border-2 border-dashed">
                        <h3 className="text-xl font-semibold font-headline">Your wishlist is empty</h3>
                        <p className="text-muted-foreground mt-2 mb-6">Add books you're interested in to see them here.</p>
                        <Button asChild>
                          <Link href="/books">Browse Books</Link>
                        </Button>
                    </div>
                )}
              </TabsContent>
              <TabsContent value="communities" className="mt-8">
                  {userCommunities.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {userCommunities.map(community => (
                            <Card key={String(community._id)} className="overflow-hidden border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                                <Link href={`/community/${community._id}`} className="block">
                                    <div className="relative h-32 w-full">
                                        <Image src={community.imageUrl} alt={community.name} fill className="object-cover" data-ai-hint="community group"/>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-headline font-semibold text-lg">{community.name}</h3>
                                        <p className="text-sm text-muted-foreground">{community.memberCount} members</p>
                                    </div>
                                </Link>
                            </Card>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-background rounded-lg border-2 border-dashed">
                        <h3 className="text-xl font-semibold font-headline">You haven't joined any communities</h3>
                        <p className="text-muted-foreground mt-2 mb-6">Explore communities to connect with other readers.</p>
                        <Button asChild>
                          <Link href="/community">Find Communities</Link>
                        </Button>
                    </div>
                  )}
              </TabsContent>
          </Tabs>
      </div>
    </div>
  );
}
