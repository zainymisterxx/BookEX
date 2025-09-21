"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { updateBookStatus, renewBookListing } from '@/app/actions';
import { 
  MoreHorizontal, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  DollarSign, 
  ArrowRightLeft,
  Clock,
  Loader2
} from 'lucide-react';
import type { BookStatus } from '@/lib/types';

interface BookStatusManagerProps {
  bookId: string;
  currentStatus: BookStatus;
  bookType: 'sell' | 'exchange';
  onStatusChange?: () => void;
}

const statusConfig = {
  active: {
    label: 'Active',
    color: 'bg-green-500',
    icon: CheckCircle,
    description: 'Listing is live and visible to buyers'
  },
  sold: {
    label: 'Sold',
    color: 'bg-blue-500',
    icon: DollarSign,
    description: 'Book has been sold'
  },
  exchanged: {
    label: 'Exchanged',
    color: 'bg-purple-500',
    icon: ArrowRightLeft,
    description: 'Book has been exchanged'
  },
  inactive: {
    label: 'Inactive',
    color: 'bg-gray-500',
    icon: XCircle,
    description: 'Listing is hidden from buyers'
  },
  expired: {
    label: 'Expired',
    color: 'bg-orange-500',
    icon: Clock,
    description: 'Listing has expired'
  }
};

const getAvailableTransitions = (currentStatus: BookStatus, bookType: 'sell' | 'exchange') => {
  const transitions: Record<BookStatus, { status: BookStatus; label: string; description: string }[]> = {
    active: [
      { status: 'inactive', label: 'Mark as Inactive', description: 'Hide from listings' },
      bookType === 'sell' 
        ? { status: 'sold', label: 'Mark as Sold', description: 'Book has been sold' }
        : { status: 'exchanged', label: 'Mark as Exchanged', description: 'Book has been exchanged' }
    ],
    sold: [
      { status: 'active', label: 'Reactivate', description: 'Make visible again (if sale fell through)' }
    ],
    exchanged: [
      { status: 'active', label: 'Reactivate', description: 'Make visible again (if exchange fell through)' }
    ],
    inactive: [
      { status: 'active', label: 'Reactivate', description: 'Make visible in listings' },
      { status: 'expired', label: 'Mark as Expired', description: 'Permanently expire listing' }
    ],
    expired: [
      { status: 'active', label: 'Renew Listing', description: 'Reactivate with new expiration date' }
    ]
  };

  return transitions[currentStatus] || [];
};

export function BookStatusManager({ bookId, currentStatus, bookType, onStatusChange }: BookStatusManagerProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    status?: BookStatus;
    action?: 'update' | 'renew';
    title?: string;
    description?: string;
  }>({ open: false });
  
  const { toast } = useToast();
  const currentConfig = statusConfig[currentStatus];
  const CurrentIcon = currentConfig.icon;

  const handleStatusUpdate = async (newStatus: BookStatus) => {
    setIsUpdating(true);
    
    try {
      const result = await updateBookStatus(bookId, newStatus);
      
      if (result.success) {
        toast({ 
          title: 'Status updated successfully!'
        });
        onStatusChange?.();
      } else {
        toast({ 
          variant: 'destructive',
          title: 'Failed to update status',
          description: 'Please try again later.' 
        });
      }
    } catch (error) {
      toast({ 
        variant: 'destructive',
        title: 'Error updating status',
        description: 'Please try again later.' 
      });
    } finally {
      setIsUpdating(false);
      setConfirmDialog({ open: false });
    }
  };

  const handleRenewListing = async () => {
    setIsRenewing(true);
    
    try {
      const result = await renewBookListing(bookId);
      
      if (result.success) {
        toast({ 
          title: 'Listing renewed successfully!'
        });
        onStatusChange?.();
      } else {
        toast({ 
          variant: 'destructive',
          title: 'Failed to renew listing',
          description: 'Please try again later.' 
        });
      }
    } catch (error) {
      toast({ 
        variant: 'destructive',
        title: 'Error renewing listing',
        description: 'Please try again later.' 
      });
    } finally {
      setIsRenewing(false);
      setConfirmDialog({ open: false });
    }
  };

  const availableTransitions = getAvailableTransitions(currentStatus, bookType);

  const confirmAction = () => {
    if (confirmDialog.action === 'renew') {
      handleRenewListing();
    } else if (confirmDialog.status) {
      handleStatusUpdate(confirmDialog.status);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Current Status Badge */}
      <Badge variant="outline" className="flex items-center gap-1.5 px-2 py-1">
        <div className={`w-2 h-2 rounded-full ${currentConfig.color}`} />
        <CurrentIcon className="w-3 h-3" />
        <span className="text-xs font-medium">{currentConfig.label}</span>
      </Badge>

      {/* Status Actions Dropdown */}
      {availableTransitions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              disabled={isUpdating || isRenewing}
            >
              {(isUpdating || isRenewing) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {availableTransitions.map((transition, index) => (
              <DropdownMenuItem
                key={transition.status}
                onClick={() => {
                  if (transition.status === 'active' && currentStatus === 'expired') {
                    // Special case for renewal
                    setConfirmDialog({
                      open: true,
                      action: 'renew',
                      title: 'Renew Listing',
                      description: 'This will reactivate your listing with a new expiration date. Continue?'
                    });
                  } else {
                    setConfirmDialog({
                      open: true,
                      status: transition.status,
                      action: 'update',
                      title: `${transition.label}?`,
                      description: `${transition.description}. This action can be reversed later.`
                    });
                  }
                }}
                className="flex flex-col items-start gap-1 p-3"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  {transition.status === 'active' && currentStatus === 'expired' ? (
                    <RefreshCw className="w-4 h-4" />
                  ) : (
                    (() => {
                      const IconComponent = statusConfig[transition.status].icon;
                      return <IconComponent className="w-4 h-4" />;
                    })()
                  )}
                  {transition.label}
                </div>
                <p className="text-xs text-muted-foreground">{transition.description}</p>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmAction}
              disabled={isUpdating || isRenewing}
            >
              {(isUpdating || isRenewing) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
