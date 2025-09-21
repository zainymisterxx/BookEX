
"use client";

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { submitReport } from '@/app/actions';
import { useSession } from 'next-auth/react';

interface ReportModalProps {
  children: React.ReactNode;
  reportedContentId: string;
  reportedContentType: 'book' | 'user';
  reportedUserId: string;
}

const reportReasons = [
  "Inappropriate Content",
  "Scam or Fraud",
  "Spam",
  "Misleading Information",
  "Other"
];

export function ReportModal({ children, reportedContentId, reportedContentType, reportedUserId }: ReportModalProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { data: session } = useSession();


  const handleSubmitReport = async () => {
    if (!session?.user) {
        toast({ variant: 'destructive', title: 'You must be logged in to report content.' });
        return;
    }
    if (!reason) {
      toast({ variant: 'destructive', title: 'Please select a reason for the report.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await submitReport({
        reporterId: session.user.id,
        reportedUserId,
        reportedContentId,
        reportedContentType,
        reason,
        details,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      toast({ title: 'Report submitted', description: 'Thank you for helping us keep the community safe.' });
      setOpen(false);
      setReason('');
      setDetails('');
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({ variant: 'destructive', title: 'Failed to submit report.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Report Content</DialogTitle>
          <DialogDescription>
            Help us understand the problem. What is wrong with this listing?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Reason for reporting</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {reportReasons.map((r) => (
                <div key={r} className="flex items-center space-x-2">
                  <RadioGroupItem value={r} id={r} />
                  <Label htmlFor={r} className="font-normal">{r}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="details">Additional Details (optional)</Label>
            <Textarea
              id="details"
              placeholder="Provide any extra information that might be helpful."
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSubmitReport} disabled={isSubmitting || !reason}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

    