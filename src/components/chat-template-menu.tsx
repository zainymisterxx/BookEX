'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MessageSquare, Package, Calendar, MapPin, CheckCircle, XCircle } from 'lucide-react';

interface MessageTemplate {
    id: string;
    label: string;
    text: string;
    icon: React.ReactNode;
    category: 'donor' | 'organization' | 'common';
}

interface ChatTemplateMenuProps {
    onSelectTemplate: (text: string) => void;
    userRole?: 'donor' | 'organization';  // Determines which templates to show
    donationStatus?: string;              // Current donation status for contextual templates
}

const templates: MessageTemplate[] = [
    // Common templates
    {
        id: 'greeting',
        label: 'Greeting',
        text: 'Hello! Thank you for connecting with me.',
        icon: <MessageSquare className="w-4 h-4" />,
        category: 'common'
    },
    {
        id: 'thank_you',
        label: 'Thank You',
        text: 'Thank you so much for your help!',
        icon: <CheckCircle className="w-4 h-4" />,
        category: 'common'
    },
    
    // Donor templates
    {
        id: 'donor_intro',
        label: 'Introduction (Donor)',
        text: 'Hi! I have some books I\'d like to donate to your organization. Please let me know the best way to arrange this.',
        icon: <Package className="w-4 h-4" />,
        category: 'donor'
    },
    {
        id: 'donor_schedule',
        label: 'Schedule Pickup',
        text: 'I\'m available for pickup on [day/time]. Would this work for you?',
        icon: <Calendar className="w-4 h-4" />,
        category: 'donor'
    },
    {
        id: 'donor_location',
        label: 'Share Location',
        text: 'I\'m located in [area]. Can you arrange pickup from this location?',
        icon: <MapPin className="w-4 h-4" />,
        category: 'donor'
    },
    {
        id: 'donor_confirm_delivered',
        label: 'Confirm Delivery',
        text: 'I\'ve dropped off the books at the agreed location. Please confirm when you receive them.',
        icon: <CheckCircle className="w-4 h-4" />,
        category: 'donor'
    },
    
    // Organization templates
    {
        id: 'org_thank_donor',
        label: 'Thank Donor',
        text: 'Thank you so much for your generous donation! We really appreciate your support in promoting literacy.',
        icon: <MessageSquare className="w-4 h-4" />,
        category: 'organization'
    },
    {
        id: 'org_arrange_pickup',
        label: 'Arrange Pickup',
        text: 'We would love to accept your donation! Our team can arrange a pickup at your convenience. What dates work best for you?',
        icon: <Calendar className="w-4 h-4" />,
        category: 'organization'
    },
    {
        id: 'org_pickup_scheduled',
        label: 'Pickup Scheduled',
        text: 'Great! We\'ve scheduled the pickup for [date/time]. Our representative will contact you shortly.',
        icon: <Calendar className="w-4 h-4" />,
        category: 'organization'
    },
    {
        id: 'org_confirm_received',
        label: 'Confirm Receipt',
        text: 'We\'ve received the books! They\'re in excellent condition. Thank you again for your generous contribution.',
        icon: <CheckCircle className="w-4 h-4" />,
        category: 'organization'
    },
    {
        id: 'org_cannot_accept',
        label: 'Cannot Accept',
        text: 'Thank you for thinking of us! Unfortunately, we cannot accept this donation at this time due to [reason]. We appreciate your understanding.',
        icon: <XCircle className="w-4 h-4" />,
        category: 'organization'
    },
    
    // Status-specific templates
    {
        id: 'status_in_progress',
        label: 'Books In Progress',
        text: 'The books are being processed and will be on their way soon! Expected delivery: [date/time].',
        icon: <Package className="w-4 h-4" />,
        category: 'common'
    }
];

export function ChatTemplateMenu({ onSelectTemplate, userRole, donationStatus }: ChatTemplateMenuProps) {
    // Filter templates based on user role
    const filteredTemplates = templates.filter(template => {
        if (template.category === 'common') return true;
        if (!userRole) return true;
        return template.category === userRole;
    });

    const handleSelectTemplate = (templateText: string) => {
        onSelectTemplate(templateText);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Templates
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-80">
                <DropdownMenuLabel>Message Templates</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* Common templates */}
                <div className="py-1">
                    <p className="px-2 py-1 text-xs font-semibold text-gray-500">Common</p>
                    {filteredTemplates
                        .filter(t => t.category === 'common')
                        .map((template) => (
                            <DropdownMenuItem
                                key={template.id}
                                onClick={() => handleSelectTemplate(template.text)}
                                className="cursor-pointer"
                            >
                                <div className="flex items-start gap-2 w-full">
                                    <div className="mt-0.5">{template.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm">{template.label}</p>
                                        <p className="text-xs text-gray-500 line-clamp-2">{template.text}</p>
                                    </div>
                                </div>
                            </DropdownMenuItem>
                        ))}
                </div>
                
                {/* Role-specific templates */}
                {userRole && (
                    <>
                        <DropdownMenuSeparator />
                        <div className="py-1">
                            <p className="px-2 py-1 text-xs font-semibold text-gray-500 capitalize">
                                {userRole} Templates
                            </p>
                            {filteredTemplates
                                .filter(t => t.category === userRole)
                                .map((template) => (
                                    <DropdownMenuItem
                                        key={template.id}
                                        onClick={() => handleSelectTemplate(template.text)}
                                        className="cursor-pointer"
                                    >
                                        <div className="flex items-start gap-2 w-full">
                                            <div className="mt-0.5">{template.icon}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm">{template.label}</p>
                                                <p className="text-xs text-gray-500 line-clamp-2">{template.text}</p>
                                            </div>
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                        </div>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
