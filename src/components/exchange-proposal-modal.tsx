"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import type { Book } from '@/lib/types';
import { getMyProfileData, proposeExchange } from '@/app/actions';

interface ExchangeProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetBook: Book;
  targetUserId: string;
  currentUserId: string;
}

export function ExchangeProposalModal({ 
  isOpen, 
  onClose, 
  targetBook, 
  targetUserId, 
  currentUserId 
}: ExchangeProposalModalProps) {
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [proposalMessage, setProposalMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invalidReason, setInvalidReason] = useState<string | null>(null);
  const [currentUserCity, setCurrentUserCity] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<'friendly' | 'direct' | 'enthusiastic'>('friendly');
  const [isEdited, setIsEdited] = useState(false);
  
  const { toast } = useToast();
  const router = useRouter();

  const getTemplateMessage = (tone: 'friendly' | 'direct' | 'enthusiastic', bookOfferTitle?: string) => {
    const offerTitle = bookOfferTitle || 'one of my books';
    const targetTitle = targetBook.title;
    
    switch (tone) {
      case 'friendly':
        return `Hi! I'd love to swap my copy of "${offerTitle}" for your "${targetTitle}". I've been hoping to read it and would be thrilled if we could make this exchange. Let me know if that works for you!`;
      case 'direct':
        return `Hi! Would you be interested in exchanging your "${targetTitle}" for my copy of "${offerTitle}"? Let me know if you're open to the swap.`;
      case 'enthusiastic':
        return `Hi there! I saw you have "${targetTitle}" available for exchange. I have a copy of "${offerTitle}" that I'd love to trade. Let's make this swap happen!`;
      default:
        return '';
    }
  };

  useEffect(() => {
    if (isOpen && currentUserId) {
      fetchMyExchangeBooks();
      setIsEdited(false);
      setSelectedTone('friendly');
      setSelectedBookId('');
      setProposalMessage(`Hi! I'm interested in your book "${targetBook.title}". Would you like to exchange it for one of my books?`);
    }
  }, [isOpen, currentUserId, targetBook.title]);

  useEffect(() => {
    if (!isEdited && isOpen) {
      const selectedBook = myBooks.find(b => String(b._id) === selectedBookId);
      setProposalMessage(getTemplateMessage(selectedTone, selectedBook?.title));
    }
  }, [selectedBookId, selectedTone, myBooks, isOpen]);

  const fetchMyExchangeBooks = async () => {
    setIsLoading(true);
    try {
      const profileData = await getMyProfileData(currentUserId);
      if (profileData.success && profileData.data?.userListings) {
        const exchangeBooks = profileData.data.userListings.filter(
          (book: Book) => book.type === 'exchange' && String(book._id) !== String(targetBook._id)
        );
        setMyBooks(exchangeBooks);
        // capture user's city for same-city prevalidation
        const profileUser = profileData.data.profileUser || {};
        const city = profileUser.cityName || null;
        setCurrentUserCity(city);
        // Client-side normalized key helper (simple, authoritative check is server-side)
        const normalizeKey = (s?: string | null) => (s ? String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '') : '');
        const myKey = normalizeKey(profileUser.cityNormalized || profileUser.city);
        const theirKey = normalizeKey((targetBook as any).cityNormalized || targetBook.city);

        if (!city) {
          setInvalidReason('Please set your city in your profile before proposing exchanges.');
        } else if (theirKey && myKey !== theirKey) {
          setInvalidReason(`Exchanges are limited to users in the same city. You are in ${profileUser.cityName || profileUser.city} and the owner is in ${(targetBook as any).cityName || (targetBook as any).city}.`);
        } else if (currentUserId === targetUserId) {
          setInvalidReason('You cannot propose an exchange on your own listing.');
        } else if (targetBook.status && targetBook.status !== 'active') {
          setInvalidReason('This listing is not currently available for exchange.');
        } else {
          setInvalidReason(null);
        }
      }
    } catch (error) {
      console.error('Error fetching books:', error);
      toast({
        title: "Error",
        description: "Failed to load your books",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBookId) {
      toast({
        title: "Select a book",
        description: "Please select one of your books to offer in exchange",
        variant: "destructive",
      });
      return;
    }

    if (!proposalMessage.trim()) {
      toast({
        title: "Add a message",
        description: "Please include a message with your proposal",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await proposeExchange(
        targetUserId,
        selectedBookId,
        String(targetBook._id),
        proposalMessage.trim()
      );

      if (result.success && result.data?.chatId) {
        toast({
          title: "Exchange Proposed!",
          description: "Your proposal has been sent. Continue the conversation in the chat.",
        });
        onClose();
        router.push(`/messages?chatId=${result.data.chatId}&userId=${targetUserId}`);
      } else {
        toast({
          title: "Could not propose exchange",
          description: (!result.success && result.message) || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error proposing exchange:', error);
      toast({
        title: "Error",
        description: (error as Error)?.message || "Failed to propose exchange",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBook = myBooks.find(book => String(book._id) === selectedBookId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Propose Book Exchange</DialogTitle>
          <DialogDescription>
            Select one of your books to exchange for "{targetBook.title}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Book Selection */}
          <div className="space-y-2">
            <Label htmlFor="book-select">Select Your Book to Exchange</Label>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading your books...</span>
              </div>
            ) : myBooks.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground">
                  You don't have any books listed for exchange yet. 
                  <br />
                  List some books first to propose exchanges.
                </p>
              </Card>
            ) : (
              <>
                <Select value={selectedBookId} onValueChange={setSelectedBookId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose one of your books" />
                  </SelectTrigger>
                  <SelectContent>
                    {myBooks.map((book) => (
                      <SelectItem key={String(book._id)} value={String(book._id)}>
                        <div className="flex items-center gap-2">
                          <span>{book.title}</span>
                          <Badge variant="outline" className="text-xs">
                            {book.condition}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Exchange Preview */}
                {selectedBook && (
                  <Card className="mt-4 p-4 bg-muted/50">
                    <div className="flex items-center gap-4">
                      {/* Your Book */}
                      <div className="flex-1">
                        <div className="text-sm font-medium text-muted-foreground mb-2">Your Book</div>
                        <div className="flex items-center gap-3">
                          {selectedBook.imageUrl && (
                            <Image
                              src={selectedBook.imageUrl}
                              alt={selectedBook.title}
                              width={50}
                              height={60}
                              className="rounded border object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate">{selectedBook.title}</h4>
                            <p className="text-xs text-muted-foreground">{selectedBook.author}</p>
                            <Badge variant="outline" className="text-xs mt-1">
                              {selectedBook.condition}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Exchange Arrow */}
                      <div className="flex-shrink-0">
                        <ArrowRight className="h-6 w-6 text-muted-foreground" />
                      </div>

                      {/* Their Book */}
                      <div className="flex-1">
                        <div className="text-sm font-medium text-muted-foreground mb-2">Their Book</div>
                        <div className="flex items-center gap-3">
                          {targetBook.imageUrl && (
                            <Image
                              src={targetBook.imageUrl}
                              alt={targetBook.title}
                              width={50}
                              height={60}
                              className="rounded border object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate">{targetBook.title}</h4>
                            <p className="text-xs text-muted-foreground">{targetBook.author}</p>
                            <Badge variant="outline" className="text-xs mt-1">
                              {targetBook.condition}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>

          {/* Proposal Message */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="proposal-message">Proposal Message</Label>
              {selectedBookId && (
                <div className="flex gap-1.5">
                  {(['friendly', 'direct', 'enthusiastic'] as const).map((tone) => (
                    <Button
                      key={tone}
                      type="button"
                      variant={selectedTone === tone ? "default" : "outline"}
                      size="sm"
                      className="text-xs px-2.5 py-1 h-7 capitalize transition-all duration-200"
                      onClick={() => {
                        setSelectedTone(tone);
                        const selectedBook = myBooks.find(b => String(b._id) === selectedBookId);
                        setProposalMessage(getTemplateMessage(tone, selectedBook?.title));
                        setIsEdited(false);
                      }}
                    >
                      {tone}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            
            <Textarea
              id="proposal-message"
              placeholder="Introduce yourself and explain why you'd like to make this exchange..."
              value={proposalMessage}
              onChange={(e) => {
                setProposalMessage(e.target.value);
                setIsEdited(true);
              }}
              rows={4}
              required
              className="resize-none focus-visible:ring-primary focus-visible:ring-offset-2 transition-all"
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>This message will be sent to the book owner along with your exchange proposal.</span>
              {isEdited && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEdited(false);
                    const selectedBook = myBooks.find(b => String(b._id) === selectedBookId);
                    setProposalMessage(getTemplateMessage(selectedTone, selectedBook?.title));
                  }}
                  className="text-primary hover:underline font-medium focus:outline-none"
                >
                  Reset Template
                </button>
              )}
            </div>
          </div>

                {/* Action Buttons */}
          {invalidReason && (
            <div className="mb-3">
              <div className="text-sm text-red-700 bg-red-50 border border-red-100 p-3 rounded">{invalidReason}</div>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || myBooks.length === 0 || !selectedBookId || !!invalidReason}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Proposing...
                </>
              ) : (
                'Propose Exchange'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
