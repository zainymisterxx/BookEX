
"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Star, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from './ui/label';
import { submitReview } from '@/app/actions';

interface ReviewModalProps {
  children: React.ReactNode;
  userToReview: User;
}

export function ReviewModal({ children, userToReview }: ReviewModalProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: session } = useSession();
  const { toast } = useToast();

  const handleSubmitReview = async () => {
    if (!session?.user) {
      toast({ variant: 'destructive', title: 'You must be logged in to leave a review.' });
      return;
    }
    if (rating === 0) {
      toast({ variant: 'destructive', title: 'Please select a rating.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await submitReview({
        reviewerId: session.user.id,
        revieweeId: String(userToReview._id),
        rating,
        comment,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      toast({ title: 'Review submitted!', description: `Thank you for your feedback on ${userToReview.name}.` });
      setOpen(false);
      setRating(0);
      setComment('');

    } catch (error) {
      console.error("Error submitting review: ", error);
      toast({ variant: 'destructive', title: 'Failed to submit review.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Leave a Review for {userToReview.name}</DialogTitle>
          <DialogDescription>
            Your feedback helps build a trustworthy community.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
            <div className="space-y-2">
                <Label>Your Rating</Label>
                <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={cn(
                        'h-8 w-8 cursor-pointer transition-colors',
                        rating >= star ? 'text-accent fill-accent' : 'text-muted-foreground/50'
                        )}
                        onClick={() => setRating(star)}
                    />
                    ))}
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="comment">Your Comment (optional)</Label>
                <Textarea 
                    id="comment"
                    placeholder={`Describe your experience with ${userToReview.name}...`}
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                />
            </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSubmitReview} disabled={isSubmitting || rating === 0}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit Review
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

    