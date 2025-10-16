
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
import { Loader2, Send, ArrowLeft, Star, HandHeart, ImagePlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { AuthModal } from '@/components/auth-modal';
import { ReviewModal } from '@/components/review-modal';
import { ExchangeStatusBar } from '@/components/exchange-status-bar';
import { ImagePreviewModal } from '@/components/ui/image-preview-modal';
import Link from 'next/link';
import { getChatDetails, getChatExchangeDetails } from '@/app/actions';
import { getSocketUrl } from '@/lib/url-utils';
import { useToast } from '@/hooks/use-toast';

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [chat, setChat] = useState<Chat | null>(null);
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatNotFound, setChatNotFound] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);

  const { data: session, status } = useSession();
  const user = session?.user;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();
  
  const scrollToBottom = (smooth: boolean = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };
  
  // Scroll to bottom on initial load (instant) and when new messages arrive (smooth)
  const isInitialMount = useRef(true);
  
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      // Use requestAnimationFrame to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        if (isInitialMount.current) {
          // First load - instant scroll to bottom
          scrollToBottom(false);
          isInitialMount.current = false;
        } else {
          // Subsequent messages - smooth scroll
          scrollToBottom(true);
        }
      });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchChatData = async () => {
      setIsLoading(true);
      try {
        const chatData = await getChatDetails(id, user.id);
        if (!chatData.success || !chatData.data) {
          setChatNotFound(true);
          setIsLoading(false);
          return;
        }

        // Update chat and message state
        setChat(chatData.data);
        setMessages(chatData.data.messages || []);
        
        // Only fetch exchange details if chat exists and has exchangeId
        if (chatData.data.exchangeId) {
          const exchangeData = await getChatExchangeDetails(id);
          setExchange(exchangeData);
        }

        // Mark messages as read
        if (chatData.data.messages?.some(m => !m.read && m.senderId !== user.id)) {
          await fetch(`/api/messages/chats/${id}/read`, { method: 'POST' });
        }
      } catch (error) {
        console.error('Error fetching chat:', error);
        setChatNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChatData();
  }, [user, id, status, router]);

  useEffect(() => {
    if (status === 'loading' || !user || !chat || chatNotFound) return;

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
            socketRef.current.emit('leaveChat', id);
            socketRef.current.off('connect');
            socketRef.current.off('receiveMessage');
            socketRef.current.disconnect();
            socketRef.current = null;
        }
    }

  }, [user, id, status, chat, chatNotFound]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size must be less than 5MB",
        variant: "destructive"
      });
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Only JPEG, PNG, and WebP images are allowed",
        variant: "destructive"
      });
      return;
    }

    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !chat || !socketRef.current) return;
    if (!newMessage.trim() && !selectedImage) return;
    
    setIsSending(true);
    const currentMessage = newMessage;
    let imageUrl: string | undefined = undefined;

    try {
      // Upload image if selected
      if (selectedImage) {
        setIsUploadingImage(true);
        const formData = new FormData();
        formData.append('image', selectedImage);
        formData.append('folder', 'messages');

        const response = await fetch('/api/upload/image', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to upload image');
        }

        imageUrl = result.url;
        setIsUploadingImage(false);
      }

      // Clear inputs optimistically
      setNewMessage('');
      handleRemoveImage();

      // Optimistic UI update for the sender
      const tempTimestamp = new Date().toISOString();
      const optimisticMessage: Message = { 
          _id: tempTimestamp, // Use timestamp as temp ID for deduplication
          senderId: user.id, 
          text: currentMessage, 
          createdAt: tempTimestamp,
          ...(imageUrl && { imageUrl })
      };
      setMessages(prev => [...prev, optimisticMessage]);

      // Send via socket
      socketRef.current.emit('sendMessage', {
        chatId: id,
        senderId: user.id,
        text: currentMessage,
        ...(imageUrl && { imageUrl })
      });

    } catch (error: any) {
      console.error('Send message error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive"
      });
      // Restore message on error
      setNewMessage(currentMessage);
    } finally {
      setIsSending(false);
      setIsUploadingImage(false);
    }
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
  
  if (chatNotFound || !chat || !chat.otherParticipant) {
    return (
        <div className="container py-12 text-center">
            <h2 className="text-2xl font-bold">Chat Not Found</h2>
            <p className="text-muted-foreground">The chat you're looking for doesn't exist or you don't have access to it.</p>
            <Button onClick={() => router.push('/messages')} className="mt-4">
                Back to Messages
            </Button>
        </div>
    );
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
                <div className={cn("max-w-xs md:max-w-md rounded-2xl overflow-hidden", message.senderId === user.id ? "bg-primary text-primary-foreground rounded-br-none" : "bg-background rounded-bl-none border-2")}>
                    {message.imageUrl && (
                      <div 
                        className="relative w-full aspect-video cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setPreviewModalImage(message.imageUrl!)}
                      >
                        <Image
                          src={message.imageUrl}
                          alt="Message image"
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    {message.text && (
                      <p className="text-base p-3">{message.text}</p>
                    )}
                </div>
                </div>
            ))}
            <div ref={messagesEndRef} />
            </div>
        </div>
        <CardFooter className="p-4 border-t bg-background">
            <form onSubmit={handleSendMessage} className="w-full space-y-2 max-w-4xl mx-auto">
            {/* Image Preview */}
            {imagePreview && (
              <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-border">
                <Image
                  src={imagePreview}
                  alt="Preview"
                  fill
                  className="object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={handleRemoveImage}
                  disabled={isSending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {/* Input and Buttons */}
            <div className="flex items-center gap-2">
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                onChange={handleImageSelect}
                className="hidden"
              />
              
              {/* Image Upload Button */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending || !!selectedImage}
              >
                <ImagePlus className="h-5 w-5" />
              </Button>
              
              {/* Text Input */}
              <Input 
                placeholder="Type a message..." 
                className="h-12 text-base flex-1" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={isSending || isUploadingImage}
              />
              
              {/* Send Button */}
              <Button 
                type="submit" 
                size="icon" 
                className="h-12 w-12 shrink-0" 
                disabled={isSending || isUploadingImage || (!newMessage.trim() && !selectedImage)}
              >
                {isSending || isUploadingImage ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            </form>
        </CardFooter>
        
        {/* Image Preview Modal */}
        <ImagePreviewModal 
          imageUrl={previewModalImage} 
          onClose={() => setPreviewModalImage(null)} 
        />
    </div>
  );
}
