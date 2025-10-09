
"use client";

import { use, useEffect, useState, useRef, useTransition } from 'react';
import { notFound, useRouter } from 'next/navigation';
import type { Chat, Message, Exchange } from '@/lib/types';
import { useSession } from 'next-auth/react';
import { io, type Socket } from 'socket.io-client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardHeader, CardFooter } from '@/components/ui/card';
import { Loader2, Send, ArrowLeft, Star, HandHeart } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { AuthModal } from '@/components/auth-modal';
import { ReviewModal } from '@/components/review-modal';
import { ExchangeStatusBar } from '@/components/exchange-status-bar';
import Link from 'next/link';
import { getChatDetails, getChatExchangeDetails } from '@/app/actions';
import { getSocketUrl } from '@/lib/url-utils';

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [chat, setChat] = useState<Chat | null>(null);
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const { data: session, status } = useSession();
  const user = session?.user;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchChatData = async () => {
      setIsLoading(true);
      const chatData = await getChatDetails(id, user.id);
      if (chatData.success && chatData.data) {
        setChat(chatData.data);
        setMessages(chatData.data.messages || []);
        
        // Fetch exchange details if this chat is associated with an exchange
        const exchangeData = await getChatExchangeDetails(id);
        setExchange(exchangeData);
      }
      setIsLoading(false);
    };

    fetchChatData();

    // Initialize Socket.IO connection
    const socketUrl = getSocketUrl();
    socketRef.current = io(socketUrl);

    socketRef.current.on('connect', () => {
      console.log('Connected to socket server');
      socketRef.current?.emit('joinChat', id);
    });

    socketRef.current.on('receiveMessage', (message: Message) => {
        // Add message with deduplication check to prevent duplicates
        setMessages(prev => {
            // Check if message already exists (by ID or temporary optimistic ID)
            const messageExists = prev.some(msg => 
                String(msg._id) === String(message._id) ||
                (msg._id === message.createdAt && msg.senderId === message.senderId && msg.text === message.text)
            );
            
            if (messageExists) {
                return prev;
            }
            
            return [...prev, message];
        });
    });
    
    // Cleanup on component unmount
    return () => {
        if (socketRef.current) {
            socketRef.current.off('connect');
            socketRef.current.off('receiveMessage');
            socketRef.current.disconnect();
            socketRef.current = null;
        }
    }

  }, [user, id, status]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim() || !chat || !socketRef.current) return;
    
    setIsSending(true);
    const currentMessage = newMessage;
    setNewMessage(''); // Optimistically clear input

    // Optimistic UI update for the sender
    const tempTimestamp = new Date().toISOString();
    const optimisticMessage: Message = { 
        _id: tempTimestamp, // Use timestamp as temp ID for deduplication
        senderId: user.id, 
        text: currentMessage, 
        createdAt: tempTimestamp 
    };
    setMessages(prev => [...prev, optimisticMessage]);

    socketRef.current.emit('sendMessage', {
      chatId: id,
      senderId: user.id,
      text: currentMessage,
    });
    
    setIsSending(false);
  };

  const getChatSubject = () => {
      if (chat?.book) return `re: ${chat.book.title}`;
      if (chat?.organization) return `re: Donation to ${chat.organization.name}`;
      return 'Conversation';
  }

  const handleExchangeStatusUpdate = async () => {
    // Refetch exchange details when status updates
    const exchangeData = await getChatExchangeDetails(id);
    setExchange(exchangeData);
  };

  if (isLoading || status === 'loading') {
    return <div className="container py-12 md:py-16 flex justify-center items-center min-h-[80vh]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return (
        <div className="container py-12 text-center">
            <h2 className="text-2xl font-bold">Please log in</h2>
            <p className="text-muted-foreground">You need to be logged in to view messages.</p>
             <AuthModal>
                <Button>Login</Button>
             </AuthModal>
        </div>
    )
  }
  
  if (!chat || !chat.otherParticipant) {
    return notFound();
  }

  const sellerId = chat.book?.sellerId;
  const isBuyer = user.id !== sellerId;
  const reviewee = (chat.book && isBuyer && chat.otherParticipant) ? chat.otherParticipant : null;

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
        <CardHeader className="flex flex-row items-center gap-4 p-4 border-b bg-background z-10">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-12 w-12 border-2">
                <AvatarImage src={chat.otherParticipant?.avatarUrl} alt={chat.otherParticipant?.name} />
                <AvatarFallback>{chat.otherParticipant?.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <p className="font-bold text-lg">{chat.otherParticipant?.name}</p>
                <p className="text-sm text-muted-foreground">{getChatSubject()}</p>
            </div>
            <div className="flex items-center gap-2">
              {reviewee && (
                <ReviewModal userToReview={reviewee}>
                  <Button variant="outline">
                      <Star className="mr-2 h-4 w-4" />
                      Mark as Complete & Review
                  </Button>
                </ReviewModal>
              )}
              {chat.book && (
                   <Link href={`/books/${chat.book._id}`} className="hidden sm:block">
                    <div className="relative h-16 w-12 rounded-md overflow-hidden">
                        <Image src={chat.book.imageUrl} alt={chat.book.title} fill className="object-cover"/>
                    </div>
                   </Link>
              )}
               {chat.organization && (
                    <div className="hidden sm:flex items-center gap-2 p-2 rounded-md bg-secondary">
                        <HandHeart className="h-6 w-6 text-primary" />
                    </div>
                )}
            </div>
        </CardHeader>
        <div className="flex-1 overflow-y-auto bg-secondary p-4">
            <div className="max-w-4xl mx-auto space-y-4">
            
            {/* Exchange Status Bar */}
            {exchange && user && (
              <ExchangeStatusBar 
                exchange={exchange} 
                currentUserId={user.id}
                onStatusUpdate={handleExchangeStatusUpdate}
              />
            )}
            
            {messages.map(message => (
                <div key={String(message._id)} className={cn("flex items-end gap-2", message.senderId === user.id ? "justify-end" : "justify-start")}>
                {message.senderId !== user.id && (
                    <Avatar className="h-8 w-8 border-2 self-start">
                        <AvatarImage src={chat.otherParticipant?.avatarUrl} />
                        <AvatarFallback>{chat.otherParticipant?.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                )}
                <div className={cn("max-w-xs md:max-w-md p-3 rounded-2xl", message.senderId === user.id ? "bg-primary text-primary-foreground rounded-br-none" : "bg-background rounded-bl-none border-2")}>
                    <p className="text-base">{message.text}</p>
                </div>
                </div>
            ))}
            <div ref={messagesEndRef} />
            </div>
        </div>
        <CardFooter className="p-4 border-t bg-background">
            <form onSubmit={handleSendMessage} className="w-full flex items-center gap-2 max-w-4xl mx-auto">
            <Input 
                placeholder="Type a message..." 
                className="h-12 text-base" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={isSending}
            />
            <Button type="submit" size="icon" className="h-12 w-12" disabled={isSending || !newMessage.trim()}>
                {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
            </form>
        </CardFooter>
    </div>
  );
}
