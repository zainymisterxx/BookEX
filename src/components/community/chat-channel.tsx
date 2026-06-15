"use client";

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Send, 
  Loader2, 
  Crown,
  Shield,
  User,
  MoreHorizontal,
  Trash2,
  Flag,
  Smile
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage, CommunityRole } from '@/lib/types';
import type { Session } from 'next-auth';
import { useToast } from '@/hooks/use-toast';
import { useSocket } from '@/components/socket-provider';
import { toggleCommunityMembership } from '@/app/actions';

interface ChatChannelProps {
  channelId: string;
  communityId: string;
  currentUser: Session["user"] | null;
  userRole: CommunityRole | null;
  isMember: boolean;
}

export function ChatChannel({ 
  channelId, 
  communityId, 
  currentUser, 
  userRole, 
  isMember 
}: ChatChannelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const { toast } = useToast();
  const { 
    socket,
    isConnected,
    joinChannel, 
    leaveChannel, 
    emitChatMessage,
    onChatMessage,
    offChatMessage
  } = useSocket();

  const handleJoinCommunity = () => {
    if (!currentUser) {
      toast({ variant: 'destructive', title: 'You must be logged in to join.' });
      return;
    }
    startTransition(async () => {
      try {
        const result = await toggleCommunityMembership(communityId, false);
        if (result.success) {
          toast({ 
            title: `Welcome to the community!`,
            description: "You successfully joined the community!"
          });
          window.location.reload();
        } else {
          toast({ variant: 'destructive', title: 'Could not update membership.', description: result.message });
        }
      } catch (err) {
        toast({ variant: 'destructive', title: 'Network error. Please try again.' });
      }
    });
  };

  const messagesPerPage = 50;

  // Reusable dedupe helper to ensure message list has unique _id values
  const dedupeMessagesById = (items: ChatMessage[]) => {
    const seen = new Set<string>();
    const out: ChatMessage[] = [];
    for (const it of items) {
      const id = String(it._id);
      if (!seen.has(id)) {
        seen.add(id);
        out.push(it);
      }
    }
    return out;
  };

  // Load messages for this channel
  const loadMessages = async (page: number = 1, loadMore: boolean = false) => {
    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingMessages(true);
    }
    setError(null);
    
    try {
      const response = await fetch(`/api/communities/${communityId}/channels/${channelId}/messages?page=${page}&limit=${messagesPerPage}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Helper to dedupe messages by _id while preserving order (first occurrence wins)
        const dedupeMessages = (items: any[]) => {
          const seen = new Set<string>();
          const out: any[] = [];
          for (const it of items) {
            const id = String(it._id);
            if (!seen.has(id)) {
              seen.add(id);
              out.push(it);
            }
          }
          return out;
        };

        if (loadMore) {
          // Prepend older messages and dedupe (older first)
          setMessages(prev => dedupeMessages([...data.messages, ...prev]));
        } else {
          // Replace with new messages (dedup just in case)
          setMessages(dedupeMessages(data.messages));
        }
        
        setHasMoreMessages(data.pagination.hasNext);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load messages' }));
        const errorMessage = typeof errorData.error === 'string' ? errorData.error : 'Failed to load messages';
        setError(errorMessage);
        toast({ variant: 'destructive', title: 'Failed to load messages', description: errorMessage });
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Network error. Please check your connection and try again.');
      toast({ variant: 'destructive', title: 'Network Error', description: 'Please check your connection and try again.' });
    } finally {
      setIsLoadingMessages(false);
      setIsLoadingMore(false);
    }
  };

  // Join/leave channel room
  useEffect(() => {
    if (isConnected && isMember) {
      joinChannel(channelId, communityId);
    }

    return () => {
      if (isConnected) {
        leaveChannel(channelId);
      }
    };
  }, [isConnected, isMember, channelId, communityId, joinChannel, leaveChannel]);

  // Set up real-time event listeners
  useEffect(() => {
    const handleNewMessage = (data: { channelId: string; message: ChatMessage; timestamp: string }) => {
      if (data.channelId === channelId) {
        setMessages(prevMessages => {
          // Append then dedupe to be robust against races/duplicates
          const combined = [...prevMessages, data.message];
          return dedupeMessagesById(combined);
        });
      }
    };

    // Register event listener
    onChatMessage(handleNewMessage);

    // Cleanup event listener
    return () => {
      offChatMessage(handleNewMessage);
    };
  }, [channelId, onChatMessage, offChatMessage]);

  // Load initial messages — only when the user is a member
  useEffect(() => {
    if (isMember) {
      loadMessages(1);
    }
  }, [channelId, isMember]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, shouldAutoScroll]);

  // Handle scroll events to detect if user is at bottom
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShouldAutoScroll(isAtBottom);
    }
  };

  const handleSendMessage = async () => {
    if (!currentUser || !isMember) {
      toast({ variant: 'destructive', title: 'Authentication Required', description: 'You must be logged in to send messages.' });
      return;
    }
    
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) {
      toast({ variant: 'destructive', title: 'Message Required', description: 'Please enter a message.' });
      return;
    }

    const originalMessages = [...messages];
    const tempMessage: ChatMessage = {
      _id: `temp-${Date.now()}`,
      channelId,
      author: {
        _id: currentUser.id,
        name: currentUser.name || 'Anonymous',
        avatarUrl: currentUser.image || undefined,
        role: userRole || undefined
      },
      content: trimmedMessage,
      createdAt: new Date().toISOString()
    };

    // Optimistic update
    setMessages(prevMessages => [...prevMessages, tempMessage]);
    setNewMessage('');

    startTransition(async () => {
      try {
        const response = await fetch(`/api/communities/${communityId}/channels/${channelId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            content: trimmedMessage 
          }),
        });

        if (response.ok) {
          const result = await response.json();
            if (result.success && result.newMessage) {
            // Replace temp message with real message and dedupe
            setMessages(prevMessages => {
              const replaced = prevMessages.map(m => 
                String(m._id) === String(tempMessage._id) ? result.newMessage! : m
              );
              return dedupeMessagesById(replaced);
            });
            
            // Emit real-time update
            try {
              emitChatMessage(channelId, result.newMessage);
            } catch (emitError) {
              console.warn('Failed to emit real-time message:', emitError);
            }
          } else {
            // Revert optimistic update
            setMessages(originalMessages);
            setNewMessage(trimmedMessage);
            const errorMsg = typeof result.error === 'string' ? result.error : 'Please try again.';
            toast({ variant: 'destructive', title: 'Failed to send message', description: errorMsg });
          }
        } else {
          // Revert optimistic update
          setMessages(originalMessages);
          setNewMessage(trimmedMessage);
          toast({ variant: 'destructive', title: 'Failed to send message', description: 'Please try again.' });
        }
      } catch (error) {
        // Revert optimistic update
        setMessages(originalMessages);
        setNewMessage(trimmedMessage);
        console.error('Error sending message:', error);
        toast({ variant: 'destructive', title: 'Network Error', description: 'Unable to send message. Please check your connection and try again.' });
      }
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const loadMoreMessages = () => {
    if (!isLoadingMore && hasMoreMessages) {
      const currentPage = Math.ceil(messages.length / messagesPerPage) + 1;
      loadMessages(currentPage, true);
    }
  };

  const getRoleIcon = (role?: CommunityRole) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-3 w-3 text-yellow-500" />;
      case 'moderator':
        return <Shield className="h-3 w-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const getRoleColor = (role?: CommunityRole) => {
    switch (role) {
      case 'admin':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'moderator':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return '';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than 1 minute
    if (diff < 60000) return 'Just now';
    
    // Less than 1 hour
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    
    // Less than 24 hours
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    // More than 24 hours
    return date.toLocaleDateString();
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isMember) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Join to Chat</h3>
            <p className="text-muted-foreground mb-4">
              You need to be a member of this community to participate in chat.
            </p>
            <Button
              className="w-full"
              onClick={handleJoinCommunity}
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join Community
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onScroll={handleScroll}
      >
        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-destructive">Failed to load messages</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => loadMessages(1)} disabled={isLoadingMessages}>
                  {isLoadingMessages ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Retry'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Load More Button */}
        {hasMoreMessages && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMoreMessages}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Load More Messages
            </Button>
          </div>
        )}

        {/* Messages */}
        {messages.map((message, index) => {
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const showAvatar = !prevMessage || prevMessage.author._id !== message.author._id;
          const showTime = !prevMessage || 
            new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() > 300000; // 5 minutes

          return (
            <div key={String(message._id)} className={cn("flex gap-3 group", showAvatar ? "items-start" : "items-center")}>
              {showAvatar ? (
                <Avatar className="h-8 w-8 border-2 flex-shrink-0">
                  <AvatarImage src={message.author.avatarUrl} alt={message.author.name} />
                  <AvatarFallback className="text-xs">{message.author.name.charAt(0)}</AvatarFallback>
                </Avatar>
              ) : (
                <div className="w-8 flex-shrink-0" />
              )}
              
              <div className="flex-1 min-w-0">
                {showAvatar && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{message.author.name}</span>
                    {getRoleIcon(message.author.role)}
                    {message.author.role && (
                      <Badge variant="outline" className={cn("text-xs", getRoleColor(message.author.role))}>
                        {message.author.role}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
                  </div>
                )}
                
                <div className="flex items-start gap-2">
                  <div className="bg-secondary/70 rounded-lg px-3 py-2 max-w-xs lg:max-w-md">
                    <p className="text-sm break-words">{message.content}</p>
                  </div>
                  
                  {/* Message Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(userRole === 'admin' || userRole === 'moderator') && (
                      <>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Flag className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Smile className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                {showTime && (
                  <p className="text-xs text-muted-foreground mt-1">{formatMessageTime(message.createdAt)}</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {isLoadingMessages && (
          <div className="flex justify-center py-8">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading messages...</span>
            </div>
          </div>
        )}

        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-border bg-background">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              disabled={isPending || !isConnected}
              className="resize-none"
            />
          </div>
          <Button 
            onClick={handleSendMessage} 
            disabled={isPending || !newMessage.trim() || !isConnected}
            size="icon"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        
        {!isConnected && (
          <p className="text-xs text-muted-foreground mt-2">Connecting to chat...</p>
        )}
      </div>
    </div>
  );
}
