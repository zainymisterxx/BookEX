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
  
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (isOpen && currentUserId) {
      fetchMyExchangeBooks();
      setProposalMessage(`Hi! I'm interested in your book "${targetBook.title}". Would you like to exchange it for one of my books?`);
    }
  }, [isOpen, currentUserId, targetBook.title]);

  const fetchMyExchangeBooks = async () => {
    setIsLoading(true);
    try {
      const profileData = await getMyProfileData(currentUserId);
      if (profileData?.userListings) {
        const exchangeBooks = profileData.userListings.filter(
          (book: Book) => book.type === 'exchange' && String(book._id) !== String(targetBook._id)
        );
        setMyBooks(exchangeBooks);
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

      if (result.success && result.chatId) {
        toast({
          title: "Exchange Proposed!",
          description: "Your exchange proposal has been sent. You can continue the conversation in the chat.",
        });
        onClose();
        router.push(`/messages/${result.chatId}`);
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to propose exchange",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error proposing exchange:', error);
      toast({
        title: "Error",
        description: "Failed to propose exchange",
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
          <div className="space-y-2">
            <Label htmlFor="proposal-message">Proposal Message</Label>
            <Textarea
              id="proposal-message"
              placeholder="Introduce yourself and explain why you'd like to make this exchange..."
              value={proposalMessage}
              onChange={(e) => setProposalMessage(e.target.value)}
              rows={4}
              required
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This message will be sent to the book owner along with your exchange proposal.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || myBooks.length === 0 || !selectedBookId}
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
