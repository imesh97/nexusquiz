/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from "react";
import { getLeaderUrl, clearLeaderCache } from "@/utils/network";

interface WebSocketHookOptions {
  gameCode: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  onMessage?: (data: any) => void;
  onError?: (error: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export function useGameWebSocket({
  gameCode,
  autoReconnect = true,
  maxReconnectAttempts = 5,
  onMessage,
  onError,
  onOpen,
  onClose,
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
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;

      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
  }, [gameCode]);

  // Connect function with retry logic
  const connect = useCallback(async () => {
    cleanup();

    try {
      // Clear leader cache if this is a retry attempt
      if (connectionAttempts > 0) {
        clearLeaderCache();
      }

      const leaderUrl = await getLeaderUrl();

      const wsUrl = `${leaderUrl.replace(/^http/, "ws")}/ws/${gameCode}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Only show connection success logs
        console.log(`✅ WebSocket connected to game ${gameCode}`);
        setIsConnected(true);
        setConnectionAttempts(0);
        setError(null);
        if (onOpen) onOpen();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessage) onMessage(data);
        } catch (err) {
          // Use warn instead of error to avoid red text
          console.warn(`⚠️ Issue parsing WebSocket message:`, err);
        }
      };

      ws.onerror = (err) => {
        // Skip empty errors entirely
        const isEmptyError = !err || JSON.stringify(err) === "{}";
        setError(new Error("Connection issue"));

        if (onError && !isEmptyError) onError(err);
      };

      ws.onclose = (event) => {
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

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (err) {
      // Use warn instead of error to avoid red text
      console.warn(`⚠️ Connection setup issue:`, err);

      setError(err instanceof Error ? err : new Error("Connection failed"));
      if (onError) onError(err);

      // Handle reconnection for connection setup errors
      if (autoReconnect && connectionAttempts < maxReconnectAttempts) {
        const nextAttempt = connectionAttempts + 1;
        setConnectionAttempts(nextAttempt);

        const delay = Math.min(1000 * Math.pow(1.5, nextAttempt), 10000);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    }
  }, [
    gameCode,
    connectionAttempts,
    autoReconnect,
    maxReconnectAttempts,
    cleanup,
    onMessage,
    onError,
    onOpen,
    onClose,
  ]);

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
    reconnect,
  };
}
