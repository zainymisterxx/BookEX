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
  CheckCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Session } from 'next-auth';
import { useSocket } from '@/components/socket-provider';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';

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
    avatarUrl?: string;
  };
}

interface Chat {
  _id: string;
  participantIds: string[];
  lastMessage?: Message;
  otherParticipant?: {
    _id: string;
    name: string;
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
  const { socket, isConnected } = useSocket();
  const { toast } = useToast();

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

    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/messages/chats/${selectedChat._id}/messages`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();
  }, [selectedChat]);

  // Handle socket events
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = (data: { message: Message; timestamp: string }) => {
      const { message } = data;
      
      // Update messages if it's for the current chat
      if (selectedChat && 
          (message.senderId === selectedChat.otherParticipant?._id || 
           message.receiverId === currentUser.id)) {
        setMessages(prev => [...prev, message]);
      }

      // Update chat list
      setChats(prev => prev.map(chat => {
        if (chat._id === message.senderId || chat._id === message.receiverId) {
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

    socket.on('newPersonalMessage', handleNewMessage);

    return () => {
      socket.off('newPersonalMessage', handleNewMessage);
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
      if (socket && isConnected) {
        socket.emit('personalMessage', messageData);
        setNewMessage('');
      } else {
        // Fallback to API if socket not available
        const response = await fetch(`/api/messages/chats/${selectedChat._id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newMessage.trim() })
        });

        if (response.ok) {
          setNewMessage('');
        }
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
    chat.otherParticipant?.name.toLowerCase().includes(searchQuery.toLowerCase())
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
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Messages
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
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
                            {chat.otherParticipant?.name || 'Unknown User'}
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
                      {selectedChat.otherParticipant?.name || 'Unknown User'}
                    </h3>
                    <p className="text-sm text-muted-foreground">Online</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex flex-col h-[500px]">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
