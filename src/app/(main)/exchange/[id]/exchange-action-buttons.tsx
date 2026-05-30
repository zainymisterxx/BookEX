'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import {
  acceptExchange,
  rejectExchange,
  cancelExchange,
  confirmExchangeCompletion,
} from '@/app/actions';
import type { ExchangeStatus } from '@/lib/types';

interface Props {
  exchangeId: string;
  status: ExchangeStatus;
  isProposer: boolean;
  isResponder: boolean;
  proposerConfirmed?: boolean;
  responderConfirmed?: boolean;
}

export function ExchangeActionButtons({
  exchangeId,
  status,
  isProposer,
  isResponder,
  proposerConfirmed,
  responderConfirmed,
}: Props) {
  const [pending, setPending] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const run = async (label: string, action: () => Promise<{ success: boolean; message?: string; data?: unknown }>) => {
    setPending(label);
    try {
      const result = await action();
      if (!result.success) throw new Error(result.message ?? 'Action failed');
      toast({ title: 'Done', description: result.message ?? 'Updated successfully' });
      router.refresh();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Something went wrong',
      });
    } finally {
      setPending(null);
    }
  };

  const isLoading = (label: string) => pending === label;

  const canCancel =
    (isProposer || isResponder) &&
    (status === 'proposed' || status === 'accepted');

  const alreadyConfirmed =
    (isProposer && proposerConfirmed) || (isResponder && responderConfirmed);

  const canConfirm =
    (isProposer || isResponder) &&
    (status === 'accepted' || status === 'in_progress') &&
    !alreadyConfirmed;

  return (
    <>
      {/* Responder: accept / decline when proposed */}
      {isResponder && status === 'proposed' && (
        <>
          <Button
            onClick={() => run('accept', () => acceptExchange(exchangeId))}
            disabled={!!pending}
          >
            {isLoading('accept') && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Accept
          </Button>
          <Button
            variant="destructive"
            onClick={() => run('decline', () => rejectExchange(exchangeId))}
            disabled={!!pending}
          >
            {isLoading('decline') && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Decline
          </Button>
        </>
      )}

      {/* Either participant: confirm completion */}
      {canConfirm && (
        <Button
          variant="outline"
          onClick={() => run('confirm', () => confirmExchangeCompletion(exchangeId))}
          disabled={!!pending}
        >
          {isLoading('confirm') && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Confirm Completion
        </Button>
      )}

      {/* Either participant: cancel */}
      {canCancel && (
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => run('cancel', () => cancelExchange(exchangeId))}
          disabled={!!pending}
        >
          {isLoading('cancel') && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Cancel Exchange
        </Button>
      )}
    </>
  );
}
