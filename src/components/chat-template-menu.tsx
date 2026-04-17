'use client';

import type { ReactNode } from 'react';
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
    icon: ReactNode;
    category: 'sell' | 'exchange' | 'donation' | 'common';
}

type ChatTemplateContext = 'sell' | 'exchange' | 'donation';

interface ChatTemplateMenuProps {
    onSelectTemplate: (text: string) => void;
    context?: ChatTemplateContext;
}

const templates: MessageTemplate[] = [
    // Common templates
    {
        id: 'greeting',
        label: 'Greeting',
        text: 'Hi! Thanks for reaching out.',
        icon: <MessageSquare className="w-4 h-4" />,
        category: 'common'
    },
    {
        id: 'thank_you',
        label: 'Thank You',
        text: 'Thanks, I appreciate the quick response.',
        icon: <CheckCircle className="w-4 h-4" />,
        category: 'common'
    },
    
    // Sell templates
    {
        id: 'sell_interest',
        label: 'Interested in Buying',
        text: 'Hi! I am interested in this book. Is it still available?',
        icon: <Package className="w-4 h-4" />,
        category: 'sell'
    },
    {
        id: 'sell_price',
        label: 'Ask About Price',
        text: 'Could you confirm the final price and preferred payment method?',
        icon: <Calendar className="w-4 h-4" />,
        category: 'sell'
    },
    {
        id: 'sell_meetup',
        label: 'Arrange Meetup',
        text: 'I can meet at a convenient public location. What time works best for you?',
        icon: <MapPin className="w-4 h-4" />,
        category: 'sell'
    },
    {
        id: 'sell_follow_up',
        label: 'Follow Up',
        text: 'Just checking in to see if you still want to move forward with the purchase.',
        icon: <CheckCircle className="w-4 h-4" />,
        category: 'sell'
    },
    
    // Exchange templates
    {
        id: 'exchange_intro',
        label: 'Propose Exchange',
        text: 'Hi! I am interested in exchanging books with you. Would you consider a trade?',
        icon: <MessageSquare className="w-4 h-4" />,
        category: 'exchange'
    },
    {
        id: 'exchange_offer',
        label: 'Share My Offer',
        text: 'I can offer one of my listed books in exchange. Let me know if any of them interest you.',
        icon: <Calendar className="w-4 h-4" />,
        category: 'exchange'
    },
    {
        id: 'exchange_condition',
        label: 'Confirm Condition',
        text: 'Before we decide, could you share a bit more about the book\'s condition?',
        icon: <Calendar className="w-4 h-4" />,
        category: 'exchange'
    },
    {
        id: 'exchange_meetup',
        label: 'Arrange Swap',
        text: 'I am happy to meet in a public place to complete the swap. What works for you?',
        icon: <CheckCircle className="w-4 h-4" />,
        category: 'exchange'
    },
    {
        id: 'exchange_follow_up',
        label: 'Follow Up',
        text: 'Just following up to see if you are still interested in the exchange.',
        icon: <XCircle className="w-4 h-4" />,
        category: 'exchange'
    },
    
    // Donation templates
    {
        id: 'donation_intro',
        label: 'Introduction (Donation)',
        text: 'Hi! I would like to donate some books. Please let me know the best way to arrange it.',
        icon: <Package className="w-4 h-4" />,
        category: 'donation'
    },
    {
        id: 'donation_schedule',
        label: 'Schedule Pickup',
        text: 'I am available for pickup on [day/time]. Would that work for your team?',
        icon: <Calendar className="w-4 h-4" />,
        category: 'donation'
    },
    {
        id: 'donation_location',
        label: 'Share Location',
        text: 'I am located in [area]. Can you arrange pickup from there?',
        icon: <MapPin className="w-4 h-4" />,
        category: 'donation'
    },
    {
        id: 'donation_confirm',
        label: 'Confirm Delivery',
        text: 'I have dropped off the books at the agreed location. Please confirm when they are received.',
        icon: <CheckCircle className="w-4 h-4" />,
        category: 'donation'
    },
    {
        id: 'donation_status',
        label: 'Processing Update',
        text: 'The books are being processed and will be on their way soon. Expected delivery: [date/time].',
        icon: <Package className="w-4 h-4" />,
        category: 'donation'
    }
];

export function ChatTemplateMenu({ onSelectTemplate, context }: ChatTemplateMenuProps) {
    // Filter templates based on the current conversation type
    const filteredTemplates = templates.filter(template => {
        if (template.category === 'common') return true;
        if (!context) return template.category === 'sell' || template.category === 'exchange';
        return template.category === context;
    });

    const marketplaceTemplates = filteredTemplates.filter(
        (template) => template.category === 'sell' || template.category === 'exchange'
    );

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
                
                {/* Context-specific templates */}
                {context ? (
                    <>
                        <DropdownMenuSeparator />
                        <div className="py-1">
                            <p className="px-2 py-1 text-xs font-semibold text-gray-500 capitalize">
                                {context} Templates
                            </p>
                            {filteredTemplates
                                .filter(t => t.category === context)
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
                ) : marketplaceTemplates.length > 0 ? (
                    <>
                        <DropdownMenuSeparator />
                        <div className="py-1">
                            <p className="px-2 py-1 text-xs font-semibold text-gray-500">
                                Marketplace
                            </p>
                            {marketplaceTemplates.map((template) => (
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
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
