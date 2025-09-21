
import { notFound } from 'next/navigation';
import { getUserProfileData } from '@/lib/data';
import { Suspense } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, MapPin, Star, Loader2 } from 'lucide-react';
import { BookCard } from '@/components/book-card';
import Link from 'next/link';
import { ProfileActions } from '@/components/profile-actions';

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getUserProfileData(id);

  if (!data) {
    notFound();
  }

  const { profileUser, userListings } = data;

  return (
    <div className="bg-secondary">
      <div className="container py-12 md:py-16">
          <Card className="mb-8 border-2 shadow-xl shadow-primary/10">
              <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                      <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                          <AvatarImage src={profileUser.avatarUrl || undefined} alt={profileUser.name || 'User'} />
                          <AvatarFallback className="text-4xl">{profileUser.name?.charAt(0) || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-center md:text-left">
                          <h1 className="text-4xl font-bold font-headline text-primary">{profileUser.name}</h1>
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
                        <Suspense fallback={<Button size="lg" disabled><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</Button>}>
                          <ProfileActions profileUser={profileUser} />
                        </Suspense>
                      </div>
                  </div>
              </CardContent>
          </Card>

          <div>
            <h2 className="text-2xl font-bold font-headline text-primary mb-6">{profileUser.name}'s Listings ({userListings.length})</h2>
            {userListings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {userListings.map(book => <BookCard key={String(book._id)} book={book} />)}
                </div>
            ) : (
              <div className="text-center py-16 bg-background rounded-lg border-2 border-dashed">
                <h3 className="text-xl font-semibold font-headline">No listings yet!</h3>
                <p className="text-muted-foreground mt-2">{profileUser.name} hasn't listed any books for sale or exchange.</p>
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
