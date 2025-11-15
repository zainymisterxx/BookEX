'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    Package, 
    Calendar, 
    Truck, 
    CheckCircle, 
    XCircle,
    Clock,
    ChevronRight,
    MapPin,
    User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Donation, Organization } from '@/lib/types';

interface DonationStatusBarProps {
    donation: Donation;
    organization?: Organization;
    currentUserId: string;
    onUpdateStatus?: (status: string) => void;
    onConfirmReceipt?: () => void;
}

export function DonationStatusBar({ 
    donation, 
    organization,
    currentUserId,
    onUpdateStatus,
    onConfirmReceipt
}: DonationStatusBarProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const isDonor = donation.donorId === currentUserId;
    const isOrgRep = organization?.representatives?.some(
        (rep: any) => rep.userId === currentUserId
    );

    const statusConfig = {
        pending: {
            icon: Clock,
            label: 'Pending',
            color: 'bg-blue-500',
            textColor: 'text-blue-600',
            description: 'Awaiting organization confirmation'
        },
        confirmed: {
            icon: Calendar,
            label: 'Confirmed',
            color: 'bg-purple-500',
            textColor: 'text-purple-600',
            description: 'Donation confirmed by organization'
        },
        in_progress: {
            icon: Truck,
            label: 'In Progress',
            color: 'bg-orange-500',
            textColor: 'text-orange-600',
            description: 'Books are being processed'
        },
        completed: {
            icon: CheckCircle,
            label: 'Completed',
            color: 'bg-green-500',
            textColor: 'text-green-600',
            description: 'Donation successfully completed'
        },
        cancelled: {
            icon: XCircle,
            label: 'Cancelled',
            color: 'bg-red-500',
            textColor: 'text-red-600',
            description: 'Donation was cancelled'
        },
        rejected: {
            icon: XCircle,
            label: 'Rejected',
            color: 'bg-gray-500',
            textColor: 'text-gray-600',
            description: 'Donation was rejected'
        }
    };

    const currentStatus = donation.status?.toLowerCase() || 'pending';
    const config = statusConfig[currentStatus as keyof typeof statusConfig] || statusConfig.pending;
    const StatusIcon = config.icon;

    const statuses = ['pending', 'confirmed', 'in_progress', 'completed'];
    const currentIndex = statuses.indexOf(currentStatus);

    const canUpdateStatus = isDonor || isOrgRep;
    const canConfirmReceipt = isOrgRep && currentStatus === 'in_progress';

    return (
        <Card className="mb-4">
            <div className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-full", config.color.replace('500', '100'))}>
                            <StatusIcon className={cn("w-5 h-5", config.textColor)} />
                        </div>
                        <div>
                            <h3 className="font-semibold">
                                Donation to {organization?.name || 'Organization'}
                            </h3>
                            <p className="text-sm text-gray-600">{config.description}</p>
                        </div>
                    </div>
                    <Badge variant={currentStatus === 'completed' ? 'default' : 'secondary'}>
                        {config.label}
                    </Badge>
                </div>

                {/* Progress Bar */}
                {currentStatus !== 'cancelled' && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            {statuses.map((status, index) => {
                                const isActive = index <= currentIndex;
                                const StatusStepIcon = statusConfig[status as keyof typeof statusConfig].icon;
                                
                                return (
                                    <div key={status} className="flex items-center flex-1">
                                        <div className="flex flex-col items-center flex-1">
                                            <div
                                                className={cn(
                                                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                                                    isActive 
                                                        ? statusConfig[status as keyof typeof statusConfig].color + ' text-white'
                                                        : 'bg-gray-200 text-gray-400'
                                                )}
                                            >
                                                <StatusStepIcon className="w-4 h-4" />
                                            </div>
                                            <span className={cn(
                                                "text-xs mt-1",
                                                isActive ? 'font-medium' : 'text-gray-400'
                                            )}>
                                                {statusConfig[status as keyof typeof statusConfig].label}
                                            </span>
                                        </div>
                                        {index < statuses.length - 1 && (
                                            <div className="flex-1 h-0.5 bg-gray-200 relative -top-4">
                                                <div
                                                    className={cn(
                                                        "h-full transition-all",
                                                        index < currentIndex ? config.color : 'bg-gray-200'
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Details (Expandable) */}
                <div className="space-y-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full justify-between"
                    >
                        <span className="text-sm font-medium">
                            {isExpanded ? 'Hide Details' : 'Show Details'}
                        </span>
                        <ChevronRight className={cn(
                            "w-4 h-4 transition-transform",
                            isExpanded && "rotate-90"
                        )} />
                    </Button>

                    {isExpanded && (
                        <div className="space-y-3 pt-2 border-t">
                            {/* Books */}
                            {donation.books && donation.books.length > 0 && (
                                <div>
                                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                        <Package className="w-4 h-4" />
                                        Books ({donation.books.length})
                                    </p>
                                    <div className="space-y-1 ml-6">
                                        {donation.books.map((book: any, index: number) => (
                                            <div key={index} className="text-sm text-gray-600">
                                                <span className="font-medium">{book.title}</span>
                                                {' by '}{book.author}
                                                {' • '}<span className="capitalize">{book.condition}</span>
                                                {book.quantity > 1 && ` • Qty: ${book.quantity}`}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Pickup Details */}
                            {donation.pickupDate && (
                                <div className="text-sm">
                                    <p className="font-medium mb-1 flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        Pickup Date
                                    </p>
                                    <p className="text-gray-600 ml-6">{donation.pickupDate}</p>
                                </div>
                            )}

                            {donation.pickupLocation && (
                                <div className="text-sm">
                                    <p className="font-medium mb-1 flex items-center gap-2">
                                        <MapPin className="w-4 h-4" />
                                        Location
                                    </p>
                                    <p className="text-gray-600 ml-6">{donation.pickupLocation}</p>
                                </div>
                            )}

                            {/* Notes from latest status update */}
                            {donation.statusHistory && donation.statusHistory.length > 0 && donation.statusHistory[donation.statusHistory.length - 1].notes && (
                                <div className="text-sm">
                                    <p className="font-medium mb-1">Latest Notes</p>
                                    <p className="text-gray-600 ml-6">{donation.statusHistory[donation.statusHistory.length - 1].notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions */}
                {canUpdateStatus && currentStatus !== 'completed' && currentStatus !== 'cancelled' && currentStatus !== 'rejected' && (
                    <div className="flex gap-2 mt-4 pt-4 border-t">
                        {currentStatus === 'pending' && (
                            <Button
                                size="sm"
                                onClick={() => onUpdateStatus?.('confirmed')}
                                className="flex-1"
                            >
                                Confirm Donation
                            </Button>
                        )}
                        {currentStatus === 'confirmed' && (
                            <Button
                                size="sm"
                                onClick={() => onUpdateStatus?.('in_progress')}
                                className="flex-1"
                            >
                                Mark as In Progress
                            </Button>
                        )}
                        {canConfirmReceipt && (
                            <Button
                                size="sm"
                                onClick={onConfirmReceipt}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Confirm Receipt
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
}
