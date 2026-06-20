import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookCheck, Repeat, Users } from 'lucide-react';
import { getPopularCommunities, getRecentListings } from '@/lib/data';
import { BookCard } from '@/components/book-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';

const getCommunityCoverImage = (community: any) => {
  const url = community.imageUrl;
  if (url && typeof url === 'string' && url.trim().length > 0) {
    return url;
  }
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><rect width="800" height="400" fill="%23edf2f7"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="32" fill="%234a5568">${encodeURIComponent(community.name)}</text></svg>`;
};

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const currentUserId = session?.user?.id;
  
  const recentListings = await getRecentListings(5);
  const popularCommunities = await getPopularCommunities(3);

  return (
    <>
      {/* Hero Section */}
      <section className="w-full bg-background border-b">
        <div className="container grid md:grid-cols-2 gap-12 items-center py-20 md:py-32">
          <div className="space-y-6 text-center md:text-left">
            <h1 className="text-4xl md:text-6xl font-bold font-headline tracking-tight text-primary">
              Give Your Books a New Chapter
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto md:mx-0">
              Join a community of book lovers to buy, sell, and exchange stories. Discover hidden gems and share your own literary treasures.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Button asChild size="lg" className="py-7 text-lg">
                <Link href="/books">Explore Collection <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="py-7 text-lg">
                <Link href="/books/sell">List a Book</Link>
              </Button>
            </div>
          </div>
          <div className="relative hidden md:block h-96 w-full max-w-lg mx-auto overflow-visible">
            <Image 
              src="https://covers.openlibrary.org/b/id/8258661-L.jpg" 
              alt="Book cover collage" 
              width={220} 
              height={330} 
              className="rounded-lg shadow-2xl absolute top-0 left-10 transform -rotate-12 hover:rotate-0 hover:scale-105 transition-transform duration-300" 
              data-ai-hint="book cover" 
              priority
            />
            <Image 
              src="https://covers.openlibrary.org/b/id/8259439-L.jpg" 
              alt="Book cover collage" 
              width={220} 
              height={330} 
              className="rounded-lg shadow-2xl absolute bottom-0 left-40 z-10 transform rotate-3 hover:rotate-0 hover:scale-105 transition-transform duration-300" 
              data-ai-hint="book cover" 
              priority
            />
            <Image 
              src="https://covers.openlibrary.org/b/id/8258664-L.jpg" 
              alt="Book cover collage" 
              width={220} 
              height={330} 
              className="rounded-lg shadow-2xl absolute top-10 right-10 transform rotate-6 hover:rotate-0 hover:scale-105 transition-transform duration-300" 
              data-ai-hint="book cover" 
              priority
            />
          </div>
        </div>
      </section>

      {/* Featured Listings Section */}
      <section className="py-16 md:py-24 bg-secondary">
        <div className="container">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-headline text-primary">Freshly Listed</h2>
            <p className="max-w-2xl mx-auto text-muted-foreground text-lg">
              These stories just hit our shelves. Be the first to discover a new adventure.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 md:gap-8">
            {recentListings.map((book) => (
              <BookCard 
                key={String(book._id)} 
                book={book} 
                isOwnListing={currentUserId === book.sellerId}
              />
            ))}
          </div>
           <div className="text-center mt-12">
              <Button asChild variant="outline" size="lg">
                <Link href="/books">
                  Browse All Listings <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
        </div>
      </section>

       {/* How It Works Section */}
       <section className="bg-background py-16 md:py-24">
        <div className="container">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-headline text-primary">A World of Stories Awaits</h2>
            <p className="max-w-2xl mx-auto text-muted-foreground text-lg">
              Engage with our community in three simple ways.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center p-8 border-2 hover:border-primary/50 hover:shadow-xl transition-all">
              <CardHeader className="p-0">
                  <div className="mx-auto bg-primary/10 rounded-full p-4 w-fit mb-4">
                    <BookCheck className="h-10 w-10 text-primary" />
                  </div>
                  <CardTitle className="font-headline text-2xl">Buy & Sell</CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-4">
                <p className="text-muted-foreground text-base">Find incredible deals on second-hand books or list your own to declutter and earn.</p>
              </CardContent>
            </Card>
            <Card className="text-center p-8 border-2 hover:border-primary/50 hover:shadow-xl transition-all">
               <CardHeader className="p-0">
                  <div className="mx-auto bg-primary/10 rounded-full p-4 w-fit mb-4">
                    <Repeat className="h-10 w-10 text-primary" />
                  </div>
                  <CardTitle className="font-headline text-2xl">Exchange</CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-4">
                <p className="text-muted-foreground text-base">Swap books with fellow readers in your city. A cost-effective way to refresh your reading list.</p>
              </CardContent>
            </Card>
            <Card className="text-center p-8 border-2 hover:border-primary/50 hover:shadow-xl transition-all">
               <CardHeader className="p-0">
                  <div className="mx-auto bg-primary/10 rounded-full p-4 w-fit mb-4">
                    <Users className="h-10 w-10 text-primary" />
                  </div>
                  <CardTitle className="font-headline text-2xl">Join the Community</CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-4">
                <p className="text-muted-foreground text-base">Connect with like-minded readers, discuss your favorite genres, and get amazing recommendations.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Community Spotlight Section */}
      <section className="bg-secondary py-16 md:py-24">
        <div className="container">
          <div className="text-center space-y-4 mb-12">
             <h2 className="text-3xl md:text-4xl font-bold font-headline text-primary">Find Your Niche</h2>
            <p className="max-w-2xl mx-auto text-muted-foreground text-lg">From sci-fi fanatics to history buffs, there's a group for everyone.</p>
          </div>
           <div className="grid md:grid-cols-3 gap-8">
             {popularCommunities.map((community) => (
              <Card key={String(community._id)} className="flex flex-col overflow-hidden group border-2">
                 <Link href={`/community/${community._id}`} className="block">
                    <div className="relative h-48 w-full overflow-hidden">
                        <Image 
                          src={getCommunityCoverImage(community)} 
                          alt={community.name} 
                          fill 
                          className="object-cover group-hover:scale-105 transition-transform duration-300" 
                          data-ai-hint="community group" 
                        />
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                        <h3 className="font-headline text-xl font-semibold mb-2">{community.name}</h3>
                        <p className="text-muted-foreground text-sm mb-4 flex-1">{community.description}</p>
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Users className="h-4 w-4" />
                                <span>{community.memberCount.toLocaleString()} members</span>
                            </div>
                            <span className="font-semibold text-primary group-hover:underline">Join Now <ArrowRight className="inline h-4 w-4"/></span>
                        </div>
                    </div>
                 </Link>
              </Card>
            ))}
           </div>
        </div>
      </section>
    </>
  );
}
