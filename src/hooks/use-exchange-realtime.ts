"use client";

import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import type { Exchange, ExchangeStatus } from '@/lib/types';
import { getSocketUrl } from '@/lib/url-utils';

interface ExchangeUpdateData {
  exchangeId: string;
  status: ExchangeStatus;
  updatedAt: string;
  acceptedAt?: string;
  completedAt?: string;
  proposerConfirmed?: boolean;
  responderConfirmed?: boolean;
}

interface UseExchangeRealtimeOptions {
  exchangeId?: string;
  onStatusUpdate?: (data: ExchangeUpdateData) => void;
  onError?: (error: string) => void;
}

export function useExchangeRealtime({
  exchangeId,
  onStatusUpdate,
  onError
}: UseExchangeRealtimeOptions = {}) {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const user = session?.user;

  // Initialize socket connection
  useEffect(() => {
    if (!user) return;

    // Use existing socket connection if available, otherwise create new one
    if (!socketRef.current || socketRef.current.disconnected) {
      const socketUrl = getSocketUrl();
      socketRef.current = io(socketUrl, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
      });
    }

    const socket = socketRef.current;

    const handleConnect = () => {
      console.log('Exchange realtime: Connected to socket server');

      // Join user room for personal updates
      socket.emit('joinUserRoom', user.id);

      // Join specific exchange room if exchangeId is provided
      if (exchangeId) {
        socket.emit('joinExchange', exchangeId);
      }
    };

    const handleExchangeStatusUpdate = (data: ExchangeUpdateData) => {
      console.log('Exchange status update received:', data);
      onStatusUpdate?.(data);
    };

    const handleError = (error: any) => {
      console.error('Exchange realtime error:', error);
      onError?.(error.message || 'Connection error');
    };

    const handleDisconnect = () => {
      console.log('Exchange realtime: Socket disconnected');
    };

    // Set up event listeners
    socket.on('connect', handleConnect);
    socket.on('exchangeStatusUpdate', handleExchangeStatusUpdate);
    socket.on('error', handleError);
    socket.on('disconnect', handleDisconnect);

    // Connect if not already connected
    if (!socket.connected) {
      socket.connect();
    } else {
      // If already connected, manually trigger join events
      handleConnect();
    }

    // Cleanup function
    return () => {
      if (exchangeId) {
        socket.emit('leaveExchange', exchangeId);
      }
      // Don't disconnect the socket here as it might be used by other components
      // The socket will be cleaned up by the header component
    };
  }, [user?.id, exchangeId, onStatusUpdate, onError]);

  // Function to manually join an exchange room
  const joinExchange = useCallback((newExchangeId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('joinExchange', newExchangeId);
    }
  }, []);

  // Function to manually leave an exchange room
  const leaveExchange = useCallback((exchangeIdToLeave: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('leaveExchange', exchangeIdToLeave);
    }
  }, []);

  // Function to check connection status
  const isConnected = useCallback(() => {
    return socketRef.current?.connected || false;
  }, []);

  return {
    joinExchange,
    leaveExchange,
    isConnected
  };
}
