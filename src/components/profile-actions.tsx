
"use client";

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { User } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Mail, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { startChat } from '@/app/actions';
import { AuthModal } from './auth-modal';

interface ProfileActionsProps {
    profileUser: User;
}

export function ProfileActions({ profileUser }: ProfileActionsProps) {
    const { data: session, status } = useSession();
    const user = session?.user;
    const isOwnProfile = user?.id === String(profileUser._id);
    const router = useRouter();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleMessageUser = () => {
        if (!user) return;
        
        startTransition(async () => {
            const result = await startChat(String(profileUser._id));
            if (result.success && result.chatId) {
                router.push(`/messages/${result.chatId}`);
            } else {
                toast({ variant: 'destructive', title: 'Could not start conversation.' });
            }
        });
    }

    if (isOwnProfile) {
        return (
            <Button asChild size="lg">
                <Link href="/profile/me">My Dashboard</Link>
            </Button>
        );
    }
    
    if (status === 'unauthenticated') {
        return (
            <AuthModal>
                 <Button size="lg">
                    <Mail className="h-4 w-4 mr-2" />
                    Message
                </Button>
            </AuthModal>
        )
    }

    return (
        <Button size="lg" onClick={handleMessageUser} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Message
        </Button>
    );
}
