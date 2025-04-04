// src/hooks/useGameWebSocket.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { getLeaderUrl, clearLeaderCache } from '@/utils/network';

interface WebSocketHookOptions {
  gameCode: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  onMessage?: (data: any) => void;
  onError?: (error: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

/**
 * Custom hook for managing a resilient WebSocket connection to the game server
 */
export function useGameWebSocket({
  gameCode,
  autoReconnect = true,
  maxReconnectAttempts = 5,
  onMessage,
  onError,
  onOpen,
  onClose
}: WebSocketHookOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Clean up function to properly close WebSocket and clear timeouts
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      console.log(`🔌 Closing WebSocket connection to ${gameCode}`);
      // Remove all event listeners to avoid memory leaks
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      
      if (wsRef.current.readyState === WebSocket.OPEN || 
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
  }, [gameCode]);
  
  // Connect function with retry logic
  const connect = useCallback(async () => {
    // Clean up existing connection first
    cleanup();
    
    try {
      console.log(`🔄 Connecting to game ${gameCode}, attempt ${connectionAttempts + 1}`);
      
      // Clear leader cache if this is a retry attempt
      if (connectionAttempts > 0) {
        clearLeaderCache();
      }
      
      const leaderUrl = await getLeaderUrl();
      console.log(`📡 Got leader URL: ${leaderUrl}`);
      
      const wsUrl = `${leaderUrl.replace(/^http/, "ws")}/ws/${gameCode}`;
      console.log(`🔌 Opening WebSocket connection to ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log(`✅ WebSocket connected to ${gameCode}`);
        setIsConnected(true);
        setConnectionAttempts(0);
        setError(null);
        if (onOpen) onOpen();
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`📩 WebSocket message received:`, data);
          if (onMessage) onMessage(data);
        } catch (err) {
          console.error(`❌ Error parsing WebSocket message:`, err);
        }
      };
      
      ws.onerror = (err) => {
        console.error(`❌ WebSocket error:`, err);
        setError(new Error('WebSocket connection error'));
        if (onError) onError(err);
      };
      
      ws.onclose = (event) => {
        console.log(`🔌 WebSocket connection closed: ${event.code} - ${event.reason}`);
        setIsConnected(false);
        
        if (onClose) onClose();
        
        // Handle reconnection if enabled
        if (autoReconnect && connectionAttempts < maxReconnectAttempts) {
          const nextAttempt = connectionAttempts + 1;
          setConnectionAttempts(nextAttempt);
          
          // Exponential backoff with jitter
          const baseDelay = Math.min(1000 * Math.pow(1.5, nextAttempt), 10000);
          const jitter = Math.random() * 1000;
          const delay = baseDelay + jitter;
          
          console.log(`🔄 Will try reconnecting in ${delay.toFixed(0)}ms (attempt ${nextAttempt}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (err) {
      console.error(`❌ Failed to establish WebSocket connection:`, err);
      setError(err instanceof Error ? err : new Error('Connection failed'));
      if (onError) onError(err);
      
      // Handle reconnection for connection setup errors
      if (autoReconnect && connectionAttempts < maxReconnectAttempts) {
        const nextAttempt = connectionAttempts + 1;
        setConnectionAttempts(nextAttempt);
        
        const delay = Math.min(1000 * Math.pow(1.5, nextAttempt), 10000);
        console.log(`🔄 Will try reconnecting in ${delay}ms (attempt ${nextAttempt}/${maxReconnectAttempts})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    }
  }, [gameCode, connectionAttempts, autoReconnect, maxReconnectAttempts, cleanup, onMessage, onError, onOpen, onClose]);
  
  // Force a new connection attempt
  const reconnect = useCallback(() => {
    setConnectionAttempts(0);
    connect();
  }, [connect]);
  
  // Initialize connection when component mounts
  useEffect(() => {
    if (gameCode) {
      connect();
    }
    
    // Clean up when component unmounts
    return cleanup;
  }, [gameCode, connect, cleanup]);
  
  return {
    isConnected,
    connectionAttempts,
    error,
    reconnect
  };
}