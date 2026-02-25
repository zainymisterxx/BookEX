"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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
  UserPlus,
  Paperclip
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Session } from 'next-auth';
import { useSocket } from '@/components/socket-provider';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { UserSearch } from '@/components/user-search';
import { ChatTemplateMenu } from '@/components/chat-template-menu';
import { FileAttachmentUpload } from '@/components/file-attachment-upload';
import { MessageAttachmentDisplay } from '@/components/message-attachment-display';
import { ChatControlsMenu } from '@/components/chat-controls-menu';
import type { MessageAttachment } from '@/lib/types';

interface Message {
  _id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  read?: boolean;
  attachments?: MessageAttachment[];
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
  organization?: {
    _id: string;
    name: string;
    logo?: string;
  };
  donationId?: string;
  unreadCount: number;
}

interface MessagesPageProps {
  currentUser: Session["user"];
}

export function MessagesPage({ currentUser }: MessagesPageProps) {
  const searchParams = useSearchParams();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  // Cursor for pagination (older messages). Starts null meaning first page.
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  // Track if we've done the initial load to prevent re-fetching
  const hasInitiallyLoaded = useRef(false);
  // Ref to scroll to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Track deleted legacy chats (old personalMessages format) in localStorage
  const [deletedLegacyChats, setDeletedLegacyChats] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`deletedChats_${currentUser.id}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    }
    return new Set();
  });
  
  // Track deletion timestamps to filter old messages
  const [chatDeletionTimes, setChatDeletionTimes] = useState<Map<string, string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`chatDeletionTimes_${currentUser.id}`);
      return stored ? new Map(Object.entries(JSON.parse(stored))) : new Map();
    }
    return new Map();
  });
  
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
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to start chat. Please try again.'
      });
    }
  };

  // Handle chat controls
  const fetchChats = useCallback(async () => {
    try {
      const response = await apiFetch('/api/messages/chats');
      if (response.ok) {
        const data = await response.json();
        // Filter out deleted legacy chats ONLY (composite format like "userId1_userId2")
        // ObjectId chats use server-side deletedBy field
        setChats((prevChats) => {
          const currentDeletedChats = typeof window !== 'undefined' 
            ? JSON.parse(localStorage.getItem(`deletedChats_${currentUser.id}`) || '[]')
            : [];
          const deletedSet = new Set(currentDeletedChats);
          
          const filteredChats = (data.chats || []).filter((chat: Chat) => {
            // Check if this is an ObjectId chat (24-char hex) or legacy composite chat
            const isObjectIdChat = /^[a-f\d]{24}$/i.test(chat._id);
            
            if (isObjectIdChat) {
              // ObjectId chats are already filtered by server using deletedBy field
              return true;
            } else {
              // Legacy composite chats use client-side localStorage filtering
              return !deletedSet.has(chat._id);
            }
          });
          
          return filteredChats;
        });
      }
    } catch (error) {
      // Silently handle error
    }
  }, []); // No dependencies - always stable

  const handleDeleteChat = async (chatId: string) => {
    try {
      const response = await apiFetch(`/api/messages/chats/${chatId}/delete`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const deletionTime = new Date().toISOString();
        
        // Check if this is a legacy chat (composite ID format)
        const isLegacyChat = chatId.includes('_') && chatId.length > 24;
        if (isLegacyChat) {
          const updatedDeleted = new Set(deletedLegacyChats);
          updatedDeleted.add(chatId);
          setDeletedLegacyChats(updatedDeleted);
          localStorage.setItem(`deletedChats_${currentUser.id}`, JSON.stringify([...updatedDeleted]));
          
          // Store deletion timestamp
          const updatedTimes = new Map(chatDeletionTimes);
          updatedTimes.set(chatId, deletionTime);
          setChatDeletionTimes(updatedTimes);
          localStorage.setItem(`chatDeletionTimes_${currentUser.id}`, JSON.stringify(Object.fromEntries(updatedTimes)));
        }
        
        // Refetch chats to get updated list
        await fetchChats();
        if (selectedChat?._id === chatId) {
          setSelectedChat(null);
        }
        toast({
          title: 'Chat Deleted',
          description: 'Chat has been removed from your inbox'
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete chat'
      });
    }
  };

  // Fetch user's chats on mount (ONLY ONCE)
  useEffect(() => {
    if (hasInitiallyLoaded.current) return;
    
    const loadChats = async () => {
      try {
        setIsLoading(true);
        await fetchChats();
        hasInitiallyLoaded.current = true;
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load conversations'
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadChats();
  }, []);

  // Auto-select chat from URL query parameter (e.g., from donation flow or community sidebar)
  useEffect(() => {
    const chatIdParam = searchParams.get('chatId');
    
    if (!chatIdParam) return;
    if (isLoading) return; // Don't run while loading
    
    // Only auto-select if we don't have this chat selected already
    if (selectedChat?._id === chatIdParam) {
      return;
    }
    
    // Try to find the chat in the loaded list
    const chatToSelect = chats.find(chat => chat._id === chatIdParam);

    if (chatToSelect) {
      setSelectedChat(chatToSelect);
    } else {
      // Chat not found in list - it might be a brand-new conversation.
      // Extract the other participant's ID from the chatId (legacy _ format)
      // or fall back to a userId query param (new format from community sidebar).
      const userIdParam = searchParams.get('userId');
      const participantIds = chatIdParam.includes('_') ? chatIdParam.split('_') : [];
      const otherUserId = userIdParam || participantIds.find(id => id !== currentUser.id);

      if (otherUserId) {
        // Use start-chat API to get/create the chat with user info
        apiFetch('/api/messages/start-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: otherUserId })
        })
          .then(res => res.json())
          .then(data => {
            if (data.chatId && data.otherParticipant) {
              const newChat: Chat = {
                _id: data.chatId,
                participantIds: [currentUser.id, otherUserId],
                otherParticipant: data.otherParticipant,
                unreadCount: 0
              };

              // Add to chats list if not already there
              setChats(prev => {
                if (prev.some(c => c._id === newChat._id)) return prev;
                return [newChat, ...prev];
              });

              setSelectedChat(newChat);
            }
          })
          .catch(err => console.error('Failed to start chat:', err));
      }
    }
  }, [searchParams, chats, selectedChat, isLoading, currentUser.id]);

  // Listen for presence updates (separate from checking presence)
  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    // Listen for presence updates
    const handlePresenceUpdate = (data: { userId: string; online: boolean }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (data.online) {
          next.add(data.userId);
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    };

    const handlePresenceStatuses = (statuses: Array<{ userId: string; online: boolean }>) => {
      setOnlineUsers(new Set(statuses.filter(s => s.online).map(s => s.userId)));
    };

    socket.on('presenceUpdate', handlePresenceUpdate);
    socket.on('presenceStatuses', handlePresenceStatuses);

    return () => {
      socket.off('presenceUpdate', handlePresenceUpdate);
      socket.off('presenceStatuses', handlePresenceStatuses);
    };
  }, [socket, isConnected]);

  // Check presence for chat participants when socket connects (NOT when chats change)
  useEffect(() => {
    if (!socket || !isConnected || chats.length === 0) return;

    // Get all participant IDs from chats
    const participantIds = chats
      .map(c => c.otherParticipant?._id)
      .filter((id): id is string => Boolean(id));

    if (participantIds.length === 0) return;

    // Request presence status for all participants
    socket.emit('checkPresence', { userIds: participantIds });
  }, [socket, isConnected]);

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
          
          // Filter messages based on deletion timestamp
          const deletionTime = chatDeletionTimes.get(selectedChat._id);
          let filteredMessages = data.messages || [];
          
          if (deletionTime) {
            filteredMessages = filteredMessages.filter((msg: Message) => 
              new Date(msg.createdAt) > new Date(deletionTime)
            );
          }
          
          if (cursor) {
            // Append older messages
            setMessages(prev => [...prev, ...filteredMessages]);
          } else {
            // Fresh load
            setMessages(filteredMessages);
          }
          // Store next cursor if available
          if (data.nextCursor) {
            setNextCursor(data.nextCursor);
          }
          
          // Mark messages as read and reset unread count
          if (!cursor && filteredMessages?.some((m: Message) => !m.read && m.senderId !== currentUser.id)) {
            await fetch(`/api/messages/chats/${selectedChat._id}/read`, { method: 'POST' });
            
            // Update the chat in the list to reset unreadCount
            setChats(prev => prev.map(chat => 
              chat._id === selectedChat._id ? { ...chat, unreadCount: 0 } : chat
            ));
          }
        }
      } catch (error) {
      }
    };

    fetchMessages();
  }, [selectedChat, currentUser.id, chatDeletionTimes]);

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
        return;
      }
      
      // If we receive a message in a deleted chat, un-delete it BUT keep deletion timestamp
      const chatId = [message.senderId, message.receiverId].sort().join('_');
      if (deletedLegacyChats.has(chatId)) {
        const updated = new Set(deletedLegacyChats);
        updated.delete(chatId);
        setDeletedLegacyChats(updated);
        localStorage.setItem(`deletedChats_${currentUser.id}`, JSON.stringify([...updated]));
        // Note: We keep the deletion timestamp in chatDeletionTimes to filter old messages
        // Refetch chats to show the un-deleted chat
        fetchChats();
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

  // Join/leave chat room when selecting different chats
  useEffect(() => {
    if (!socket || !isConnected || !selectedChat) return;

    // Join the chat room (for new ObjectId chats)
    socket.emit('joinChat', selectedChat._id);

    return () => {
      // Leave the chat room when switching chats
      socket.emit('leaveChat', selectedChat._id);
    };
  }, [socket, isConnected, selectedChat]);

  // Listen for new messages from the new chat system
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleReceiveMessage = (message: any) => {
      // Don't add the message if it's from the current user (already added optimistically)
      // Check if this message already exists (by comparing temporary ID or checking sender)
      setMessages(prev => {
        // If message has a temp ID and we sent it, skip (already added optimistically)
        const alreadyExists = prev.some(m => 
          m._id === message._id || 
          (m.senderId === message.senderId && m.content === message.content && 
           Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime()) < 1000)
        );
        
        if (alreadyExists) {
          // Replace the optimistic message with the real one
          return prev.map(m => 
            m._id.startsWith('temp-') && m.content === message.content && m.senderId === message.senderId
              ? message
              : m
          );
        }
        
        return [...prev, message];
      });
      
      // Update chat list with new last message
      setChats(prevChats => 
        prevChats.map(chat => 
          chat._id === selectedChat?._id 
            ? { ...chat, lastMessage: message }
            : chat
        )
      );
    };

    socket.on('receiveMessage', handleReceiveMessage);

    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
    };
  }, [socket, isConnected, selectedChat]);

  // Auto-scroll to bottom when messages change or chat is selected
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedChat]);

  // Listen for new chats being created (e.g., from donation flow)
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewChatCreated = (data: { chatId: string }) => {
      // Refresh the chat list to include the new chat
      fetchChats();
    };

    socket.on('newChatCreated', handleNewChatCreated);

    return () => {
      socket.off('newChatCreated', handleNewChatCreated);
    };
  }, [socket, isConnected]);

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
        read: false,
        attachments: attachments.length > 0 ? attachments : undefined
      };

      // Optimistic update
      setMessages(prev => [...prev, optimisticMessage]);
      setNewMessage(''); // Clear input immediately
      setAttachments([]); // Clear attachments

      // Detect if this is a new ObjectId chat or legacy composite chat
      const isObjectIdChat = selectedChat._id.length === 24 && /^[a-f\d]{24}$/i.test(selectedChat._id);

      if (socket && isConnected) {
        if (isObjectIdChat) {
          // NEW SYSTEM: Use sendMessage event for ObjectId chats
          socket.emit('sendMessage', {
            chatId: selectedChat._id,
            senderId: currentUser.id,
            text: trimmedMessage,
            attachments: attachments.length > 0 ? attachments : undefined
          });
        } else {
          // LEGACY SYSTEM: Use personalMessage event for composite chats
          const messageWithAttachments = {
            ...messageData,
            attachments: attachments.length > 0 ? attachments : undefined
          };
          socket.emit('personalMessage', messageWithAttachments);
        }
      } else {
        // Fallback to API
        const response = await fetch(`/api/messages/chats/${selectedChat._id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            content: trimmedMessage,
            attachments: attachments.length > 0 ? attachments : undefined
          })
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

  const filteredChats = chats.filter(chat => {
    const query = searchQuery.toLowerCase();
    return (
      chat.organization?.name?.toLowerCase().includes(query) ||
      chat.otherParticipant?.name?.toLowerCase().includes(query) ||
      chat.otherParticipant?.username?.toLowerCase().includes(query)
    ) ?? false;
  });

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
                filteredChats.map((chat) => {
                  return (
                  <div
                    key={chat._id}
                    className={cn(
                      "p-3 hover:bg-secondary/50 transition-colors border-b group",
                      selectedChat?._id === chat._id && "bg-secondary"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={chat.organization?.logo || chat.otherParticipant?.avatarUrl} />
                        <AvatarFallback>
                          {(chat.organization?.name || chat.otherParticipant?.name)?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => setSelectedChat(chat)}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <h3 className="font-medium truncate">
                              {chat.organization?.name || chat.otherParticipant?.name || chat.otherParticipant?.username || 'Unknown User'}
                            </h3>
                            {chat.organization && (
                              <Badge variant="outline" className="text-xs flex-shrink-0">Donation</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {chat.lastMessage && (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatTime(chat.lastMessage.createdAt)}
                              </span>
                            )}
                            {chat.unreadCount > 0 && (
                              <Badge variant="destructive" className="h-5 min-w-[20px] rounded-full px-1.5 flex items-center justify-center text-xs">
                                {chat.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground truncate pr-8">
                          {chat.lastMessage?.content || 'No messages yet'}
                        </p>
                      </div>
                      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <ChatControlsMenu
                          chatId={chat._id}
                          onDelete={handleDeleteChat}
                        />
                      </div>
                    </div>
                  </div>
                  );
                })
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
                    <AvatarImage src={selectedChat.organization?.logo || selectedChat.otherParticipant?.avatarUrl} />
                    <AvatarFallback>
                      {(selectedChat.organization?.name || selectedChat.otherParticipant?.name)?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium">
                      {selectedChat.organization?.name || selectedChat.otherParticipant?.name || selectedChat.otherParticipant?.username || 'Unknown User'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        onlineUsers.has(selectedChat.otherParticipant?._id || '') ? "bg-green-500" : "bg-gray-300"
                      )} />
                      <p className="text-sm text-muted-foreground">
                        {onlineUsers.has(selectedChat.otherParticipant?._id || '') ? "Online" : "Offline"}
                      </p>
                      {selectedChat.organization && (
                        <Badge variant="secondary" className="text-xs ml-1">Donation</Badge>
                      )}
                    </div>
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
                          {message.content && <p className="text-sm">{message.content}</p>}
                          {message.attachments && message.attachments.length > 0 && (
                            <MessageAttachmentDisplay 
                              attachments={message.attachments}
                              className="mt-2"
                            />
                          )}
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
                  {/* Invisible element to scroll to */}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="border-t p-4">
                  <div className="space-y-2">
                    {/* File Attachments */}
                    <FileAttachmentUpload
                      attachments={attachments}
                      onFilesSelected={(newFiles) => setAttachments([...attachments, ...newFiles])}
                      onRemoveAttachment={(id) => setAttachments(attachments.filter(a => a.id !== id))}
                      maxFiles={5}
                      maxFileSize={10}
                    />
                    
                    {/* Message Input with Templates */}
                    <div className="flex gap-2">
                      <ChatTemplateMenu
                        onSelectTemplate={(text) => setNewMessage(text)}
                      />
                      <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="flex-1"
                      />
                      <Button 
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() && attachments.length === 0}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
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
