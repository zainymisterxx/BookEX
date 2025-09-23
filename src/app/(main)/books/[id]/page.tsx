
import { Suspense } from 'react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getBookAndSellerDetails } from '@/lib/data';


import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Flag } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BookActions } from '@/components/book-actions';


// This is a server component
export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getBookAndSellerDetails(id);
  
  if (!data) {
    notFound();
  }

  const { book, seller } = data;

  return (
    <div className="bg-background">
      <div className="container py-8 md:py-12">
        <Suspense fallback={<BookDetailSkeleton />}>
          <div className="grid md:grid-cols-3 gap-8 md:gap-16">
            <div className="md:col-span-1">
              <Card className="overflow-hidden sticky top-24 border-2 shadow-xl shadow-primary/10">
                <div className="relative aspect-[3/4]">
                  <Image
                    src={book.imageUrl}
                    alt={`Cover of ${book.title}`}
                    fill
                    className="object-cover"
                    data-ai-hint="book cover"
                  />
                </div>
              </Card>
            </div>

            <div className="md:col-span-2">
              <Badge variant="outline" className="mb-2 capitalize text-base border-primary/50 text-primary">{book.genre}</Badge>
              <h1 className="text-4xl lg:text-5xl font-bold font-headline text-primary">{book.title}</h1>
              <p className="text-xl text-muted-foreground mt-1">by {book.author}</p>
              
              <div className="flex items-center gap-4 mt-6">
                <Badge className="text-base capitalize py-1 px-3 border-primary/50 text-primary bg-primary/10">{book.condition.replace('-', ' ')}</Badge>
                {book.type === 'sell' && book.price ? (
                    <p className="text-4xl font-bold text-primary">PKR {book.price.toLocaleString()}</p>
                ) : (
                    <p className="text-4xl font-bold text-primary">For Exchange</p>
                )}
              </div>

              <Separator className="my-8" />

              <div className="space-y-4 text-foreground/90">
                <h2 className="text-2xl font-headline font-semibold text-primary">Description</h2>
                <p className="text-lg leading-relaxed">{book.description}</p>
              </div>

              <Separator className="my-8" />
              
              {seller && (
                  <Card className="border-2 shadow-lg shadow-primary/5">
                  <CardHeader>
                      <div>
                          <CardTitle className="font-headline text-xl">Seller Information</CardTitle>
                          <CardDescription>Details about who listed this book.</CardDescription>
                      </div>
                  </CardHeader>
                  <CardContent>
                      <div className="flex items-center gap-4">
                        <Link href={`/profile/${seller._id}`} className="contents">
                          <Avatar className="h-16 w-16 border-2">
                              <AvatarImage src={seller.avatarUrl} alt={seller.name} />
                              <AvatarFallback>{seller.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                        </Link>
                        <div>
                            <Link href={`/profile/${seller._id}`} className="hover:underline">
                              <p className="font-semibold text-lg">{seller.name}</p>
                            </Link>
                            <p className="text-sm text-muted-foreground">{seller.city}</p>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <Star className="w-4 h-4 text-accent fill-accent" />
                            <span>{seller.averageRating} ({seller.reviews} reviews)</span>
                            </div>
                        </div>
                      </div>
                  </CardContent>
                  </Card>
              )}
              
              <Suspense fallback={<ActionButtonsSkeleton />}>
                  <BookActions 
                      book={book} 
                      seller={seller} 
                  />
              </Suspense>

            </div>
          </div>
        </Suspense>
      </div>
    </div>
  );
}


function BookDetailSkeleton() {
    return (
        <div className="grid md:grid-cols-3 gap-8 md:gap-16">
            <div className="md:col-span-1">
                <Skeleton className="aspect-[3/4] w-full" />
            </div>
            <div className="md:col-span-2 space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-12 w-3/4" />
                    <Skeleton className="h-6 w-1/2" />
                </div>
                <div className="flex gap-4">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-32" />
                </div>
                <Skeleton className="h-px w-full" />
                <div className="space-y-2">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-20 w-full" />
                </div>
                <Skeleton className="h-px w-full" />
                <div className="space-y-4">
                    <Skeleton className="h-6 w-40" />
                    <div className="flex gap-4">
                        <Skeleton className="h-16 w-16 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-20" />
                        </div>
                    </div>
                </div>
                <div className="flex gap-4">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                </div>
            </div>
        </div>
    );
}

function ActionButtonsSkeleton() {
    return (
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
        </div>
    )
}
