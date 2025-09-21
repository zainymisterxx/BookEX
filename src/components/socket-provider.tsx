"use client";

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Community, Post, Comment } from '@/lib/types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinCommunity: (communityId: string) => void;
  leaveCommunity: (communityId: string) => void;
  emitPostCreated: (communityId: string, post: Post) => void;
  emitCommentCreated: (communityId: string, postId: string, comment: Comment) => void;
  emitPostLiked: (communityId: string, postId: string, userId: string, liked: boolean) => void;
  onNewPost: (callback: (data: { communityId: string; post: Post; timestamp: string }) => void) => void;
  onNewComment: (callback: (data: { communityId: string; postId: string; comment: Comment; timestamp: string }) => void) => void;
  onPostLikeUpdate: (callback: (data: { communityId: string; postId: string; userId: string; liked: boolean; timestamp: string }) => void) => void;
  offNewPost: (callback: (data: { communityId: string; post: Post; timestamp: string }) => void) => void;
  offNewComment: (callback: (data: { communityId: string; postId: string; comment: Comment; timestamp: string }) => void) => void;
  offPostLikeUpdate: (callback: (data: { communityId: string; postId: string; userId: string; liked: boolean; timestamp: string }) => void) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const initSocket = () => {
      const newSocket = io('http://localhost:3001', {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 20000,
      });

      newSocket.on('connect', () => {
        console.log('Connected to Socket.IO server');
        setIsConnected(true);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Disconnected from Socket.IO server:', reason);
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
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
  }, []);

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

  const value: SocketContextType = {
    socket,
    isConnected,
    joinCommunity,
    leaveCommunity,
    emitPostCreated,
    emitCommentCreated,
    emitPostLiked,
    onNewPost,
    onNewComment,
    onPostLikeUpdate,
    offNewPost,
    offNewComment,
    offPostLikeUpdate,
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
