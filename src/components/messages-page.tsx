"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  Send, 
  Search,
  User,
  Clock,
  Check,
  CheckCheck,
  Plus,
  UserPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Session } from 'next-auth';
import { useSocket } from '@/components/socket-provider';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { UserSearch } from '@/components/user-search';

interface Message {
  _id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  read?: boolean;
  sender?: {
    _id: string;
    name: string;
    username?: string;
    avatarUrl?: string;
  };
}

interface User {
  _id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
}

interface Chat {
  _id: string;
  participantIds: string[];
  lastMessage?: Message;
  otherParticipant?: {
    _id: string;
    name: string;
    username?: string;
    avatarUrl?: string;
  };
  unreadCount: number;
}

interface MessagesPageProps {
  currentUser: Session["user"];
}

export function MessagesPage({ currentUser }: MessagesPageProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  // Cursor for pagination (older messages). Starts null meaning first page.
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const { socket, isConnected } = useSocket();
  const { toast } = useToast();

  // Handle starting a new chat with a selected user
  const handleStartChat = async (user: { _id: string; name: string; username?: string; avatarUrl?: string }) => {
    try {
      const response = await apiFetch('/api/messages/start-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Create or find the chat object
        const newChat: Chat = {
          _id: data.chatId,
          participantIds: [currentUser.id, user._id],
          otherParticipant: data.otherParticipant,
          unreadCount: 0
        };

        // Update chats list if this is a new chat
        if (!data.existing) {
          setChats(prev => [newChat, ...prev]);
        }

        // Select the chat
        setSelectedChat(newChat);

        // If it's a new chat, initialize empty messages
        if (!data.existing) {
          setMessages([]);
          setNextCursor(null);
        }

        toast({
          title: 'Chat Started',
          description: `Started conversation with ${user.username ? `@${user.username}` : user.name}`
        });
      } else {
        throw new Error('Failed to start chat');
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to start chat. Please try again.'
      });
    }
  };

  // Fetch user's chats
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const response = await apiFetch('/api/messages/chats');
        if (response.ok) {
          const data = await response.json();
          setChats(data.chats || []);
        }
      } catch (error) {
        console.error('Error fetching chats:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load conversations'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchChats();
  }, [toast]);

  // Fetch messages for selected chat
  useEffect(() => {
    if (!selectedChat) return;

    const fetchMessages = async (cursor?: string) => {
      try {
        const url = new URL(`/api/messages/chats/${selectedChat._id}/messages`, window.location.origin);
        if (cursor) {
          url.searchParams.set('cursor', cursor);
        }
        url.searchParams.set('limit', '50');

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (cursor) {
            // Append older messages
            setMessages(prev => [...prev, ...data.messages]);
          } else {
            // Fresh load
            setMessages(data.messages || []);
          }
          // Store next cursor if available
          if (data.nextCursor) {
            setNextCursor(data.nextCursor);
          }
          
          // Mark messages as read and reset unread count
          if (!cursor && data.messages?.some((m: Message) => !m.read && m.senderId !== currentUser.id)) {
            await fetch(`/api/messages/chats/${selectedChat._id}/read`, { method: 'POST' });
            
            // Update the chat in the list to reset unreadCount
            setChats(prev => prev.map(chat => 
              chat._id === selectedChat._id ? { ...chat, unreadCount: 0 } : chat
            ));
          }
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();
  }, [selectedChat, currentUser.id]);

  const loadOlderMessages = () => {
    if (nextCursor && selectedChat) {
      // Load next (older) page; we append at end since list is chronological ascending
      // If you'd like newest at bottom, consider unshifting or reversing logic.
      const currentCursor = nextCursor;
      // Clear nextCursor optimistically to prevent duplicate fetches
      setNextCursor(null);
      (async () => {
        try {
          const url = new URL(`/api/messages/chats/${selectedChat._id}/messages`, window.location.origin);
          url.searchParams.set('cursor', currentCursor);
          url.searchParams.set('limit', '50');
          const res = await fetch(url.toString());
          if (res.ok) {
            const data = await res.json();
            setMessages(prev => [...data.messages, ...prev]); // prepend older messages
            if (data.nextCursor) setNextCursor(data.nextCursor);
          }
        } catch (e) {
          console.error('Error loading older messages:', e);
        }
      })();
    }
  };

  // Handle socket events
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = (data: { message: Message; timestamp: string }) => {
      const { message } = data;
      
      // newPersonalMessage is for RECEIVED messages (not sent by current user)
      // messageConfirmed handles messages sent by current user
      if (message.senderId === currentUser.id) {
        console.log('Ignoring newPersonalMessage for own message (should use messageConfirmed)');
        return;
      }
      
      // Update messages if it's for the current chat
      // Check if message is from the selected chat's other participant
      if (selectedChat && selectedChat.otherParticipant) {
        const isMessageForThisChat = 
          (message.senderId === selectedChat.otherParticipant._id && message.receiverId === currentUser.id);
        
        if (isMessageForThisChat) {
          // Only add if not already present (avoid duplicates)
          setMessages(prev => {
            const exists = prev.some(m => m._id === message._id);
            return exists ? prev : [...prev, message];
          });
        }
      }

      // Update chat list - chatId format is "userId1_userId2" (sorted)
      setChats(prev => prev.map(chat => {
        // Check if this message belongs to this chat
        const chatParticipants = chat.participantIds || [];
        const messageParticipants = [message.senderId, message.receiverId];
        const isSameChat = chatParticipants.every(id => messageParticipants.includes(id)) &&
                           messageParticipants.every(id => chatParticipants.includes(id));
        
        if (isSameChat) {
          return {
            ...chat,
            lastMessage: message,
            unreadCount: message.senderId !== currentUser.id ? 
              (chat.unreadCount || 0) + 1 : chat.unreadCount
          };
        }
        return chat;
      }));
    };

    const handleMessageConfirmed = (data: { message: Message; timestamp: string }) => {
      const { message } = data;
      
      // Replace optimistic message (temp-*) with the real message from server
      setMessages(prev => prev.map(msg => 
        msg._id.toString().startsWith('temp-') && 
        msg.senderId === message.senderId && 
        msg.receiverId === message.receiverId &&
        msg.content === message.content ? message : msg
      ));
    };

    const handleMessagesRead = (data: { chatId: string; userId: string }) => {
      const { chatId } = data;
      
      // Reset unread count for the specified chat
      setChats(prev => prev.map(chat => 
        chat._id === chatId ? { ...chat, unreadCount: 0 } : chat
      ));
    };

    socket.on('newPersonalMessage', handleNewMessage);
    socket.on('messageConfirmed', handleMessageConfirmed);
    socket.on('messagesRead', handleMessagesRead);

    return () => {
      socket.off('newPersonalMessage', handleNewMessage);
      socket.off('messageConfirmed', handleMessageConfirmed);
      socket.off('messagesRead', handleMessagesRead);
    };
  }, [socket, isConnected, selectedChat, currentUser.id]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    const messageData = {
      receiverId: selectedChat.otherParticipant?._id,
      content: newMessage.trim(),
      senderName: currentUser.name
    };

    try {
      const trimmedMessage = newMessage.trim();
      if (!trimmedMessage || !selectedChat) return;

      // Create optimistic message
      if (!selectedChat.otherParticipant?._id) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Cannot send message: recipient not found.'
        });
        return;
      }
      const optimisticMessage: Message = {
        _id: `temp-${Date.now()}`,
        senderId: currentUser.id,
        receiverId: selectedChat.otherParticipant._id,
        content: trimmedMessage,
        createdAt: new Date().toISOString(),
        read: false
      };

      // Optimistic update
      setMessages(prev => [...prev, optimisticMessage]);
      setNewMessage(''); // Clear input immediately

      if (socket && isConnected) {
        // Send via socket
        socket.emit('personalMessage', messageData);
      } else {
        // Fallback to API
        const response = await fetch(`/api/messages/chats/${selectedChat._id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: trimmedMessage })
        });

        if (!response.ok) {
          // Revert optimistic update on error
          setMessages(prev => prev.filter(msg => msg._id !== optimisticMessage._id));
          setNewMessage(trimmedMessage);
          throw new Error('Failed to send message');
        }

        const { message: serverMessage } = await response.json();
        
        // Replace optimistic message with server message
        setMessages(prev => prev.map(msg => 
          msg._id === optimisticMessage._id ? serverMessage : msg
        ));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send message'
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const filteredChats = chats.filter(chat => 
    chat.otherParticipant?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false
  );

  if (isLoading) {
    return (
      <div className="container py-8 max-w-6xl mx-auto">
        <div className="text-center">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Chat List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Messages
              </div>
            </CardTitle>
            
            {/* User Search */}
            <div className="space-y-3">
              <UserSearch
                onUserSelect={handleStartChat}
                placeholder="Start new conversation..."
                className="w-full"
              />
              
              {/* Conversation Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {filteredChats.length > 0 ? (
                filteredChats.map((chat) => (
                  <div
                    key={chat._id}
                    className={cn(
                      "p-4 cursor-pointer hover:bg-secondary/50 transition-colors border-b",
                      selectedChat?._id === chat._id && "bg-secondary"
                    )}
                    onClick={() => setSelectedChat(chat)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={chat.otherParticipant?.avatarUrl} />
                        <AvatarFallback>
                          {chat.otherParticipant?.name?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium truncate">
                            {chat.otherParticipant?.username || chat.otherParticipant?.name || 'Unknown User'}
                          </h3>
                          {chat.lastMessage && (
                            <span className="text-xs text-muted-foreground">
                              {formatTime(chat.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {chat.lastMessage?.content || 'No messages yet'}
                        </p>
                      </div>
                      {chat.unreadCount > 0 && (
                        <Badge variant="destructive" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                          {chat.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No conversations yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chat Messages */}
        <Card className="lg:col-span-2">
          {selectedChat ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedChat.otherParticipant?.avatarUrl} />
                    <AvatarFallback>
                      {selectedChat.otherParticipant?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium">
                      {selectedChat.otherParticipant?.username || selectedChat.otherParticipant?.name || 'Unknown User'}
                    </h3>
                    <p className="text-sm text-muted-foreground">Online</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex flex-col h-[500px]">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {nextCursor && (
                    <div className="text-center">
                      <Button variant="ghost" size="sm" onClick={loadOlderMessages}>
                        Load older messages
                      </Button>
                    </div>
                  )}
                  {messages.length > 0 ? (
                    messages.map((message) => (
                      <div
                        key={message._id}
                        className={cn(
                          "flex",
                          message.senderId === currentUser.id ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg px-3 py-2",
                            message.senderId === currentUser.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary"
                          )}
                        >
                          <p className="text-sm">{message.content}</p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-xs opacity-70">
                              {formatTime(message.createdAt)}
                            </span>
                            {message.senderId === currentUser.id && (
                              <CheckCheck className="h-3 w-3 opacity-70" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  )}
                </div>

                {/* Message Input */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[500px]">
              <div className="text-center text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to start messaging</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
