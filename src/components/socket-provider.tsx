"use client";

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import type { Community, Post, Comment } from '@/lib/types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinCommunity: (communityId: string) => void;
  leaveCommunity: (communityId: string) => void;
  joinChannel: (channelId: string, communityId?: string) => void;
  leaveChannel: (channelId: string) => void;
  emitPostCreated: (communityId: string, post: Post) => void;
  emitCommentCreated: (communityId: string, postId: string, comment: Comment) => void;
  emitPostLiked: (communityId: string, postId: string, userId: string, liked: boolean) => void;
  emitChatMessage: (channelId: string, message: any) => void;
  onNewPost: (callback: (data: { communityId: string; post: Post; timestamp: string }) => void) => void;
  onNewComment: (callback: (data: { communityId: string; postId: string; comment: Comment; timestamp: string }) => void) => void;
  onPostLikeUpdate: (callback: (data: { communityId: string; postId: string; userId: string; liked: boolean; timestamp: string }) => void) => void;
  onChatMessage: (callback: (data: { channelId: string; message: any; timestamp: string }) => void) => void;
  offNewPost: (callback: (data: { communityId: string; post: Post; timestamp: string }) => void) => void;
  offNewComment: (callback: (data: { communityId: string; postId: string; comment: Comment; timestamp: string }) => void) => void;
  offPostLikeUpdate: (callback: (data: { communityId: string; postId: string; userId: string; liked: boolean; timestamp: string }) => void) => void;
  offChatMessage: (callback: (data: { channelId: string; message: any; timestamp: string }) => void) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const { data: session } = useSession();

  useEffect(() => {
    // Initialize socket connection
    const initSocket = () => {
      const socketUrl = process.env.NODE_ENV === 'production' 
        ? 'https://your-production-domain.com' 
        : 'http://localhost:3001';
        
      const newSocket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 20000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        forceNew: true,
      });

      newSocket.on('connect', () => {
        console.log('Connected to Socket.IO server');
        console.log('Socket ID:', newSocket.id);
        console.log('Socket transport:', newSocket.io.engine.transport.name);
        setIsConnected(true);
        
        // Authenticate with session token if available
        if ((session as any)?.accessToken) {
          newSocket.emit('authenticate', (session as any).accessToken);
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Disconnected from Socket.IO server:', reason);
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        setIsConnected(false);
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected to Socket.IO server after', attemptNumber, 'attempts');
        setIsConnected(true);
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('Socket.IO reconnection error:', error);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('Socket.IO reconnection failed');
        setIsConnected(false);
      });

      socketRef.current = newSocket;
      setSocket(newSocket);
    };

    initSocket();

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [session]);

  const joinCommunity = (communityId: string) => {
    if (socket && isConnected) {
      socket.emit('joinCommunity', { communityId });
      console.log(`Joined community room: ${communityId}`);
    }
  };

  const leaveCommunity = (communityId: string) => {
    if (socket && isConnected) {
      socket.emit('leaveCommunity', { communityId });
      console.log(`Left community room: ${communityId}`);
    }
  };

  const joinChannel = (channelId: string, communityId?: string) => {
    if (socket && isConnected) {
      socket.emit('joinChannel', { channelId, communityId });
      console.log(`Joined channel: ${channelId}`);
    }
  };

  const leaveChannel = (channelId: string) => {
    if (socket && isConnected) {
      socket.emit('leaveChannel', { channelId });
      console.log(`Left channel: ${channelId}`);
    }
  };

  const emitPostCreated = (communityId: string, post: Post) => {
    if (socket && isConnected) {
      socket.emit('postCreated', { communityId, post });
    }
  };

  const emitCommentCreated = (communityId: string, postId: string, comment: Comment) => {
    if (socket && isConnected) {
      socket.emit('commentCreated', { communityId, postId, comment });
    }
  };

  const emitPostLiked = (communityId: string, postId: string, userId: string, liked: boolean) => {
    if (socket && isConnected) {
      socket.emit('postLiked', { communityId, postId, userId, liked });
    }
  };

  const emitChatMessage = (channelId: string, message: any) => {
    if (socket && isConnected) {
      socket.emit('chatMessage', { channelId, message });
    }
  };

  const onNewPost = (callback: (data: { communityId: string; post: Post; timestamp: string }) => void) => {
    if (socket) {
      socket.on('newPost', callback);
    }
  };

  const onNewComment = (callback: (data: { communityId: string; postId: string; comment: Comment; timestamp: string }) => void) => {
    if (socket) {
      socket.on('newComment', callback);
    }
  };

  const onPostLikeUpdate = (callback: (data: { communityId: string; postId: string; userId: string; liked: boolean; timestamp: string }) => void) => {
    if (socket) {
      socket.on('postLikeUpdate', callback);
    }
  };

  const offNewPost = (callback: (data: { communityId: string; post: Post; timestamp: string }) => void) => {
    if (socket) {
      socket.off('newPost', callback);
    }
  };

  const offNewComment = (callback: (data: { communityId: string; postId: string; comment: Comment; timestamp: string }) => void) => {
    if (socket) {
      socket.off('newComment', callback);
    }
  };

  const offPostLikeUpdate = (callback: (data: { communityId: string; postId: string; userId: string; liked: boolean; timestamp: string }) => void) => {
    if (socket) {
      socket.off('postLikeUpdate', callback);
    }
  };

  const onChatMessage = (callback: (data: { channelId: string; message: any; timestamp: string }) => void) => {
    if (socket) {
      socket.on('newChatMessage', callback);
    }
  };

  const offChatMessage = (callback: (data: { channelId: string; message: any; timestamp: string }) => void) => {
    if (socket) {
      socket.off('newChatMessage', callback);
    }
  };

  const value: SocketContextType = {
    socket,
    isConnected,
    joinCommunity,
    leaveCommunity,
    joinChannel,
    leaveChannel,
    emitPostCreated,
    emitCommentCreated,
    emitPostLiked,
    emitChatMessage,
    onNewPost,
    onNewComment,
    onPostLikeUpdate,
    onChatMessage,
    offNewPost,
    offNewComment,
    offPostLikeUpdate,
    offChatMessage,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
