"use client";

import Image from 'next/image';
import Link from 'next/link';
import type { Book } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Edit, Trash2, Loader2 } from 'lucide-react';
import { HighlightedBookTitle, HighlightedAuthor } from '@/components/ui/search-highlighting';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { deleteBookListing } from '@/app/actions';

interface BookCardProps {
  book: Book;
  className?: string;
  searchTerm?: string;
  showManageOptions?: boolean; // New prop for showing edit/delete
}

export function BookCard({ book, className, searchTerm = '', showManageOptions = false }: BookCardProps) {
  const bookId = String(book._id);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleDeleteListing = async () => {
    setIsDeleting(true);
    
    try {
      const result = await deleteBookListing(bookId);
      
      if (result.success) {
        toast({ title: 'Listing deleted successfully!' });
        router.refresh(); // Refresh the page to update the list
      } else {
        toast({ 
          variant: 'destructive', 
          title: 'Could not delete listing',
          description: result.message 
        });
      }
    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Error deleting listing',
        description: 'Please try again later.' 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="group relative">
      <Link href={`/books/${bookId}`} className="block">
        <Card className={cn("overflow-hidden transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 border-2 hover:border-primary/20 h-full flex flex-col", className)}>
          <CardContent className="p-0 flex flex-col h-full">
            <div className="relative aspect-[3/4] w-full bg-muted/20 overflow-hidden">
              <Image
                src={book.imageUrl}
                alt={`Cover of ${book.title}`}
                fill
                className="object-cover transition-all duration-300 group-hover:scale-105"
                data-ai-hint="book cover"
                loading="lazy"
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkrHB0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
              />
               <div className="absolute top-2 right-2 transition-transform duration-200 group-hover:scale-105">
                <Badge variant={book.type === 'sell' ? 'default' : 'secondary'} className="capitalize shadow-md text-sm">{book.type}</Badge>
              </div>
            </div>
            <div className="p-4 space-y-1 flex flex-col flex-grow">
              <div className="flex-grow space-y-2">
                <HighlightedBookTitle
                  title={book.title}
                  searchTerm={searchTerm}
                  className="font-headline text-base sm:text-lg leading-tight group-hover:text-primary transition-colors duration-200 line-clamp-2 min-h-[2.5rem] sm:min-h-[3rem]"
                />
                <HighlightedAuthor
                  author={`by ${book.author}`}
                  searchTerm={searchTerm}
                  className="text-xs sm:text-sm transition-colors duration-200 group-hover:text-muted-foreground/80 line-clamp-1"
                />
                <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 flex-shrink-0" />
                    <span className="truncate">{book.city}</span>
                  </div>
                  <Link 
                    href={`/profile/${book.sellerId}`}
                    className="text-primary hover:text-primary/80 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View Seller
                  </Link>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 mt-auto">
                {book.type === 'sell' && book.price ? (
                  <p className="font-semibold text-primary text-sm sm:text-lg">PKR {book.price.toLocaleString()}</p>
                ) : (
                  <p className="font-semibold text-primary text-sm sm:text-lg">Exchange</p>
                )}
                <Badge variant="outline" className="capitalize text-xs sm:text-sm">{book.condition.replace('-', ' ')}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
      
      {/* Management Options Overlay */}
      {showManageOptions && (
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1 z-10">
          <Button asChild size="sm" variant="secondary" className="h-8 w-8 p-0">
            <Link href={`/books/sell?edit=${bookId}`} onClick={(e) => e.stopPropagation()}>
              <Edit className="h-4 w-4" />
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                size="sm" 
                variant="destructive" 
                className="h-8 w-8 p-0" 
                disabled={isDeleting}
                onClick={(e) => e.stopPropagation()}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Book Listing</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{book.title}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteListing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
