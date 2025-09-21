"use client";

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  Repeat2, 
  ArrowRight, 
  Package,
  Handshake
} from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import type { Exchange, ExchangeStatus } from '@/lib/types';
import { acceptExchange, confirmExchangeCompletion, cancelExchange } from '@/app/actions';
import { useExchangeRealtime } from '@/hooks/use-exchange-realtime';

interface ExchangeStatusBarProps {
  exchange: Exchange | null;
  currentUserId: string;
  onStatusUpdate?: () => void;
}

export function ExchangeStatusBar({ exchange, currentUserId, onStatusUpdate }: ExchangeStatusBarProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  // Set up real-time updates
  useExchangeRealtime({
    exchangeId: exchange?._id?.toString(),
    onStatusUpdate: (data) => {
      console.log('Real-time exchange update:', data);
      // Call the parent callback to refresh data
      onStatusUpdate?.();
    },
    onError: (error) => {
      console.error('Exchange real-time error:', error);
      toast({
        title: "Connection Error",
        description: "Real-time updates may be delayed. Please refresh the page.",
        variant: "destructive",
      });
    }
  });

  if (!exchange) return null;

  const isProposer = exchange.proposerId === currentUserId;
  const canAccept = !isProposer && exchange.status === 'proposed';
  const canConfirmCompletion = exchange.status === 'in_progress';
  const canCancel = exchange.status === 'proposed' || exchange.status === 'accepted';

  const getStatusIcon = (status: ExchangeStatus) => {
    switch (status) {
      case 'proposed':
        return <Clock className="h-4 w-4" />;
      case 'accepted':
        return <CheckCircle className="h-4 w-4" />;
      case 'in_progress':
        return <Repeat2 className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      case 'disputed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: ExchangeStatus) => {
    switch (status) {
      case 'proposed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'accepted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'disputed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: ExchangeStatus) => {
    switch (status) {
      case 'proposed':
        return 'Exchange Proposed';
      case 'accepted':
        return 'Exchange Accepted';
      case 'in_progress':
        return 'Exchange in Progress';
      case 'completed':
        return 'Exchange Completed';
      case 'cancelled':
        return 'Exchange Cancelled';
      case 'disputed':
        return 'Exchange Disputed';
      default:
        return status;
    }
  };

  const handleAcceptExchange = async () => {
    setIsUpdating(true);
    try {
      const result = await acceptExchange(String(exchange._id));
      if (result.success) {
        toast({
          title: "Exchange Accepted",
          description: "The book exchange has been accepted. You can now arrange the swap!",
        });
        onStatusUpdate?.();
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to accept exchange",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to accept exchange",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmCompletion = async () => {
    setIsUpdating(true);
    try {
      const result = await confirmExchangeCompletion(String(exchange._id));
      if (result.success) {
        toast({
          title: "Exchange Completed",
          description: "Congratulations! The book exchange has been completed.",
        });
        onStatusUpdate?.();
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to confirm completion",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to confirm completion",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelExchange = async () => {
    setIsUpdating(true);
    try {
      const result = await cancelExchange(String(exchange._id));
      if (result.success) {
        toast({
          title: "Exchange Cancelled",
          description: "The exchange has been cancelled.",
        });
        onStatusUpdate?.();
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to cancel exchange",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel exchange",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const myBook = isProposer ? exchange.proposerBook : exchange.responderBook;
  const theirBook = isProposer ? exchange.responderBook : exchange.proposerBook;

  return (
    <Card className="mb-4 border-2 border-dashed border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        {/* Status Header */}
        <div className="flex items-center justify-between mb-4">
          <Badge className={`${getStatusColor(exchange.status)} border`}>
            {getStatusIcon(exchange.status)}
            <span className="ml-1">{getStatusText(exchange.status)}</span>
          </Badge>
          <div className="text-sm text-muted-foreground">
            {isProposer ? 'You proposed this exchange' : 'Exchange proposed to you'}
          </div>
        </div>

        {/* Exchange Details */}
        <div className="flex items-center gap-4 mb-4">
          {/* Your Book */}
          <div className="flex-1">
            <div className="text-sm font-medium text-muted-foreground mb-2">
              {isProposer ? 'Your Book' : 'Their Book'}
            </div>
            <div className="flex items-center gap-3">
              {myBook?.imageUrl && (
                <Image
                  src={myBook.imageUrl}
                  alt={myBook.title}
                  width={50}
                  height={60}
                  className="rounded border object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm truncate">{myBook?.title}</h4>
                <p className="text-xs text-muted-foreground">{myBook?.author}</p>
              </div>
            </div>
          </div>

          {/* Exchange Icon */}
          <div className="flex-shrink-0">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Their Book */}
          <div className="flex-1">
            <div className="text-sm font-medium text-muted-foreground mb-2">
              {isProposer ? 'Their Book' : 'Your Book'}
            </div>
            <div className="flex items-center gap-3">
              {theirBook?.imageUrl && (
                <Image
                  src={theirBook.imageUrl}
                  alt={theirBook.title}
                  width={50}
                  height={60}
                  className="rounded border object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm truncate">{theirBook?.title}</h4>
                <p className="text-xs text-muted-foreground">{theirBook?.author}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Proposal Message */}
        {exchange.proposalMessage && (
          <Alert className="mb-4">
            <AlertDescription className="text-sm">
              <strong>Proposal:</strong> "{exchange.proposalMessage}"
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          {canAccept && (
            <Button
              onClick={handleAcceptExchange}
              disabled={isUpdating}
              className="flex-1 sm:flex-none"
            >
              <Handshake className="h-4 w-4 mr-2" />
              Accept Exchange
            </Button>
          )}

          {canConfirmCompletion && (
            <Button
              onClick={handleConfirmCompletion}
              disabled={isUpdating}
              className="flex-1 sm:flex-none"
            >
              <Package className="h-4 w-4 mr-2" />
              Confirm Completion
            </Button>
          )}

          {canCancel && (
            <Button
              variant="outline"
              onClick={handleCancelExchange}
              disabled={isUpdating}
              className="flex-1 sm:flex-none"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Exchange
            </Button>
          )}
        </div>

        {/* Status-specific messages */}
        {exchange.status === 'proposed' && !isProposer && (
          <Alert className="mt-3">
            <AlertDescription className="text-sm">
              Review the proposed exchange and accept if you're interested in trading books.
            </AlertDescription>
          </Alert>
        )}

        {exchange.status === 'accepted' && (
          <Alert className="mt-3">
            <AlertDescription className="text-sm">
              Great! Both parties have agreed. Coordinate the book swap and confirm completion when done.
            </AlertDescription>
          </Alert>
        )}

        {exchange.status === 'in_progress' && (
          <Alert className="mt-3">
            <AlertDescription className="text-sm">
              Exchange is in progress. Confirm completion once you've received your book.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
