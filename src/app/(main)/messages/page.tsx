
"use client";

import { useEffect, useState, useRef } from 'react';
import type { Chat } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { Loader2, MessageSquare, HandHeart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthModal } from '@/components/auth-modal';
import { useSession } from 'next-auth/react';
import { getUserChats } from '@/app/actions';
import { io, type Socket } from 'socket.io-client';

let socket: Socket;

export default function MessagesPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { data: session, status } = useSession();
  const user = session?.user;
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) {
        if (status !== 'loading') setIsLoading(false);
        return;
    }

    const fetchChats = async () => {
        setIsLoading(true);
        const userChats = await getUserChats(user.id);
        setChats(userChats);
        setIsLoading(false);
    };

    fetchChats();

    // Initialize Socket.IO connection for real-time updates
    socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001');
    socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to socket server for chat list');
      socket.emit('joinUserRoom', user.id);
    });

    // Listen for new messages to update chat list
    socket.on('receiveMessage', (message) => {
      // Make sure this message is for a chat in our list
      const chatId = message.chatId || message.chatId;
      if (!chatId) return;
      
      setChats(prevChats => {
        return prevChats.map(chat => {
          if (String(chat._id) === String(chatId)) {
            return {
              ...chat,
              lastMessage: message.text,
              updatedAt: message.createdAt
            };
          }
          return chat;
        }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });
    });

    // Listen for new notifications to refresh chat list
    socket.on('newNotification', () => {
      fetchChats(); // Refresh the entire chat list when new notifications arrive
    });

    // Cleanup on component unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.off('connect');
        socketRef.current.off('receiveMessage');
        socketRef.current.off('newNotification');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user, status]);
  
  const getChatSubject = (chat: Chat) => {
      if (chat.book) return `Re: ${chat.book.title}`;
      if (chat.organization) return `Re: ${chat.organization.name}`;
      return 'Conversation';
  }

  const formatTimestamp = (timestamp: string) => {
      if (!timestamp) return '';
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  if (isLoading || status === 'loading') {
    return (
      <div className="container py-12 md:py-16 flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-secondary">
        <div className="container py-12 md:py-16 text-center min-h-[60vh] flex flex-col justify-center items-center">
            <h2 className="text-2xl font-bold font-headline">Please log in</h2>
            <p className="text-muted-foreground mt-2 mb-6">You need to be logged in to view your messages.</p>
            <AuthModal>
              <Button size="lg">Login to Continue</Button>
            </AuthModal>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-secondary">
      <div className="container py-12 md:py-16">
        <div className="space-y-2 mb-12">
            <h1 className="text-4xl font-bold font-headline text-primary">Inbox</h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
                Your conversations with other members.
            </p>
        </div>

        <Card className="border-2 shadow-xl shadow-primary/10">
          <div className="divide-y-2">
            {chats.length > 0 ? (
              chats.map(chat => (
                <Link key={String(chat._id)} href={`/messages/${chat._id}`} className="block hover:bg-secondary/50 transition-colors">
                  <div className="p-6 flex items-center gap-4">
                    <Avatar className="h-16 w-16 border-2">
                      <AvatarImage src={chat.otherParticipant?.avatarUrl} alt={chat.otherParticipant?.name} />
                      <AvatarFallback>{chat.otherParticipant?.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-lg">{chat.otherParticipant?.name}</p>
                          <p className="text-sm text-primary font-medium flex items-center gap-1.5">
                            {chat.organizationId && <HandHeart className="h-4 w-4" />}
                            {getChatSubject(chat)}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground flex-shrink-0 ml-2">{formatTimestamp(chat.updatedAt)}</p>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 truncate">{chat.lastMessage || 'No messages yet.'}</p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center p-16">
                <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-xl font-semibold">No messages yet</h3>
                <p className="mt-2 text-muted-foreground">Start a conversation by contacting a seller on a book listing page.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
