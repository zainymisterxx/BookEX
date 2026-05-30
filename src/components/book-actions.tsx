
"use client";

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Book, User } from '@/lib/types';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Heart, MessageSquare, Loader2, Flag, Repeat, Trash2, Edit } from 'lucide-react';
import { AuthModal } from './auth-modal';
import { ReportModal } from './report-modal';
import { ExchangeProposalModal } from './exchange-proposal-modal';
import { isBookWishlisted, toggleWishlist, startChat, startExchangeChat, deleteBookListing } from '@/app/actions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { getMyProfileData } from '@/app/actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

interface BookActionsProps {
    book: Book;
    seller: User | null;
}

export function BookActions({ book, seller }: BookActionsProps) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true);
  const [userHasExchangeBooks, setUserHasExchangeBooks] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { data: session, status } = useSession();
  const user = session?.user;
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (user && book) {
      const checkUserData = async () => {
        setIsInitialDataLoading(true);
        const [wishlistResult, profileData] = await Promise.all([
          isBookWishlisted(String(book._id)),
          getMyProfileData(user.id)
        ]);
        
        setIsWishlisted(wishlistResult);
        if (profileData.success && profileData.data?.userListings) {
          setUserHasExchangeBooks(profileData.data.userListings.some((b: Book) => b.type === 'exchange'));
        }
        setIsInitialDataLoading(false);
      };
      checkUserData();
    } else if (status !== 'loading') {
      setIsWishlisted(false);
      setIsInitialDataLoading(false);
    }
  }, [user, book, status]);
  
  const handleToggleWishlist = async () => {
      if (!user) return; // AuthModal will handle it
      
      const previousWishlistedState = isWishlisted;
      
      // Implement optimistic update with proper rollback
      setIsWishlisted(!previousWishlistedState);
      
      startTransition(async () => {
          try {
              const result = await toggleWishlist(String(book._id), previousWishlistedState);
              if (result.success) {
                  toast({ title: previousWishlistedState ? 'Removed from wishlist!' : 'Added to wishlist!' });
                  // State is already updated optimistically, no need to change again
              } else {
                  // Rollback optimistic update on server error
                  setIsWishlisted(previousWishlistedState);
                  toast({ 
                      variant: 'destructive', 
                      title: 'Could not update wishlist.',
                      description: result.message || 'Please try again.' 
                  });
              }
          } catch (error) {
              // Rollback optimistic update on network error
              setIsWishlisted(previousWishlistedState);
              toast({ 
                  variant: 'destructive', 
                  title: 'Network error',
                  description: 'Please check your connection and try again.' 
              });
          }
      });
  };

  const handleContactSeller = async () => {
    if (!user || !book || !seller) return;
    if (user.id === String(seller._id)) {
        toast({ variant: 'destructive', title: 'This is your own listing.' });
        return;
    }

    if (book.type === 'exchange') {
        // Open exchange proposal modal instead of directly starting chat
        setShowExchangeModal(true);
        return;
    }

    startTransition(async () => {
        const result = await startChat(String(seller._id), String(book._id));
        
        if (result.success && result.data?.chatId) {
            router.push(`/messages/${result.data.chatId}`);
        } else {
            toast({ variant: 'destructive', title: 'Could not start conversation.', description: 'Failed to start conversation' });
        }
    });
  }

  const handleDeleteListing = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    
    try {
      const result = await deleteBookListing(String(book._id));
      
      if (result.success) {
        toast({ title: 'Listing deleted successfully!' });
        router.push('/profile/me');
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

  const showReportButton = user && seller && user.id !== String(seller._id);
  const isOwner = user && seller && user.id === String(seller._id);
  const bookId = String(book._id);
  const sellerId = String(seller?._id);
  
  const ContactIcon = book.type === 'exchange' ? Repeat : MessageSquare;
  const contactText = book.type === 'exchange' ? 'Propose Exchange' : 'Contact Seller';
  const isExchangeDisabled = book.type === 'exchange' && !userHasExchangeBooks;
  const isSellerInactive = !seller;

  const contactButton = (
    <Button 
      size="lg" 
      className="flex-1 py-7 text-lg" 
      onClick={handleContactSeller} 
      disabled={isPending || user?.id === sellerId || isExchangeDisabled || isInitialDataLoading || isSellerInactive}
    >
        {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ContactIcon className="mr-2 h-5 w-5"/>}
        {isInitialDataLoading ? 'Loading...' : (user?.id === sellerId ? "This is your listing" : contactText)}
    </Button>
  );

  return (
    <TooltipProvider>
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
        {status === 'authenticated' ? (
           isOwner ? (
             // Show manage options for owner
             <>
               <Button asChild size="lg" className="flex-1 py-7 text-lg" variant="outline">
                 <a href={`/books/sell?edit=${bookId}`}>
                   <Edit className="mr-2 h-5 w-5" />
                   Edit Listing
                 </a>
               </Button>
               <AlertDialog>
                 <AlertDialogTrigger asChild>
                   <Button size="lg" className="flex-1 py-7 text-lg" variant="destructive" disabled={isDeleting}>
                     {isDeleting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Trash2 className="mr-2 h-5 w-5" />}
                     {isDeleting ? 'Deleting...' : 'Delete Listing'}
                   </Button>
                 </AlertDialogTrigger>
                 <AlertDialogContent>
                   <AlertDialogHeader>
                     <AlertDialogTitle>Delete Book Listing</AlertDialogTitle>
                     <AlertDialogDescription>
                       Are you sure you want to delete "{book.title}"? This action cannot be undone and will remove all related chats, notifications, and exchange proposals.
                     </AlertDialogDescription>
                   </AlertDialogHeader>
                   <AlertDialogFooter>
                     <AlertDialogCancel>Cancel</AlertDialogCancel>
                     <AlertDialogAction onClick={handleDeleteListing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                       Delete Listing
                     </AlertDialogAction>
                   </AlertDialogFooter>
                 </AlertDialogContent>
               </AlertDialog>
             </>
           ) : isSellerInactive ? (
             <Tooltip>
                <TooltipTrigger asChild>
                    <span className="flex-1 contents">{contactButton}</span>
                </TooltipTrigger>
                <TooltipContent>
                    <p>This book is unavailable because the seller's account has been deactivated.</p>
                </TooltipContent>
             </Tooltip>
           ) : isExchangeDisabled ? (
             <Tooltip>
                <TooltipTrigger asChild>
                    <span className="flex-1 contents">{contactButton}</span>
                </TooltipTrigger>
                <TooltipContent>
                    <p>You need an active exchange listing to propose a swap. <a href="/books/sell" className="underline font-medium">List a book for exchange →</a></p>
                </TooltipContent>
             </Tooltip>
           ) : (
             contactButton
           )
        ) : (
            <AuthModal>
            <Button size="lg" className="flex-1 py-7 text-lg">
                <ContactIcon className="mr-2 h-5 w-5"/> {contactText}
            </Button>
            </AuthModal>
        )}

        {status === 'authenticated' ? (
            <Button size="lg" variant="outline" className="flex-1 py-7 text-lg" onClick={handleToggleWishlist} disabled={isInitialDataLoading || isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : <Heart className={`mr-2 h-5 w-5 ${isWishlisted ? 'fill-destructive text-destructive' : ''}`}/>}
                {isInitialDataLoading ? 'Loading...' : (isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist')}
            </Button>
        ) : (
            <AuthModal>
                <Button size="lg" variant="outline" className="flex-1 py-7 text-lg">
                <Heart className="mr-2 h-5 w-5"/> Add to Wishlist
                </Button>
            </AuthModal>
        )}
        </div>
        {showReportButton && seller && (
            <div className="mt-4 text-right">
                <ReportModal
                    reportedContentId={bookId}
                    reportedContentType="book"
                    reportedUserId={sellerId}
                    >
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                        <Flag className="h-4 w-4 mr-2" />
                        Report this listing
                    </Button>
                </ReportModal>
            </div>
        )}
        
        {/* Exchange Proposal Modal */}
        {user && seller && book.type === 'exchange' && (
          <ExchangeProposalModal
            isOpen={showExchangeModal}
            onClose={() => setShowExchangeModal(false)}
            targetBook={book}
            targetUserId={String(seller._id)}
            currentUserId={user.id}
          />
        )}
    </TooltipProvider>
  );
}
