import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getWsBaseUrl } from '../lib/api/client';
import {
  broadcastCrossTabEvent,
  invalidateInventoryQueries,
  useCrossTabSync,
  type RealtimeInventoryEvent,
} from './useCrossTabSync';

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseOrgWebSocketOptions {
  enabled?: boolean;
  onEvent?: (event: RealtimeInventoryEvent) => void;
}

export function useOrgWebSocket(
  orgId?: string | null,
  accessToken?: string | null,
  options: UseOrgWebSocketOptions = {}
): {
  status: WebSocketStatus;
  reconnect: () => void;
} {
  const { enabled = true, onEvent } = options;
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<WebSocketStatus>('disconnected');

  // Activate cross-tab BroadcastChannel listener for this org
  useCrossTabSync(orgId);

  const socketRef = React.useRef<WebSocket | null>(null);
  const reconnectAttemptRef = React.useRef(0);
  const reconnectTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const intentionalCloseRef = React.useRef(false);
  const prevTokenRef = React.useRef<string | null>(null);
  const tokenRef = React.useRef(accessToken);
  tokenRef.current = accessToken;
  const onEventRef = React.useRef(onEvent);
  onEventRef.current = onEvent;

  const cleanupTimers = React.useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const connect = React.useCallback(() => {
    const currentToken = tokenRef.current;
    if (!enabled || !orgId || !currentToken) {
      setStatus('disconnected');
      return;
    }

    cleanupTimers();

    // Close any existing socket
    if (socketRef.current) {
      try {
        intentionalCloseRef.current = true;
        socketRef.current.close();
      } catch {
        // ignore
      }
      socketRef.current = null;
    }

    intentionalCloseRef.current = false;
    setStatus('connecting');

    const wsBase = getWsBaseUrl();
    const wsUrl = `${wsBase}/events?token=${encodeURIComponent(currentToken)}&org=${encodeURIComponent(orgId)}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;
    } catch (err) {
      console.error('Failed to construct WebSocket:', err);
      setStatus('error');
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      setStatus('connected');
      reconnectAttemptRef.current = 0;

      // Start client heartbeat ping every 25 seconds
      heartbeatTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: 'ping' }));
          } catch {
            // ignore
          }
        }
      }, 25000);
    };

    ws.onmessage = (evt) => {
      try {
        const text = evt.data?.toString();
        if (text === 'pong') return;

        const data = JSON.parse(text);
        if (data.type === 'welcome') {
          setStatus('connected');
          return;
        }

        if (data.type === 'pong' || data.type === 'token:refreshed') {
          return;
        }

        if (data.type === 'token:expired') {
          console.warn('Realtime token expired, reconnecting...');
          ws.close(4001, 'Token expired');
          return;
        }

        // It is an inventory mutation event
        const eventOrgId = data.orgId || data.payload?.orgId;
        if (data.type && (!eventOrgId || eventOrgId === orgId)) {
          const realtimeEvent: RealtimeInventoryEvent = {
            type: data.type,
            payload: data.payload || {},
            orgId: eventOrgId || orgId,
            timestamp: data.timestamp || new Date().toISOString(),
          };
          // Invalidate local React Query caches
          invalidateInventoryQueries(queryClient, realtimeEvent);
          // Broadcast to other open browser tabs
          broadcastCrossTabEvent(realtimeEvent);
          // Custom consumer callback if provided
          onEventRef.current?.(realtimeEvent);
        }
      } catch {
        // non-JSON message ignored
      }
    };

    ws.onerror = (err) => {
      console.warn('WebSocket encountered error:', err);
      setStatus('error');
    };

    ws.onclose = (evt) => {
      cleanupTimers();
      socketRef.current = null;

      if (!intentionalCloseRef.current) {
        setStatus('disconnected');
        // Do not immediately spam if unauthorized
        if (evt.code !== 4001 && evt.code !== 4003) {
          scheduleReconnect();
        }
      }
    };

    function scheduleReconnect() {
      const attempt = reconnectAttemptRef.current++;
      // Exponential backoff: 1s, 2s, 4s, 8s, up to 30s + jitter
      const delay = Math.min(1000 * Math.pow(1.5, attempt), 30000) + Math.random() * 500;
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    }
  }, [enabled, orgId, cleanupTimers, queryClient]);

  // Handle in-socket token refresh when token changes without dropping connection
  React.useEffect(() => {
    if (!accessToken) return;

    if (!prevTokenRef.current) {
      prevTokenRef.current = accessToken;
      return;
    }

    if (accessToken !== prevTokenRef.current) {
      prevTokenRef.current = accessToken;
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'token:refresh', payload: { token: accessToken } }));
        } catch {
          // If sending fails, trigger full reconnect
          connect();
        }
      } else {
        connect();
      }
    }
  }, [accessToken, connect]);

  // Connect on mount / param changes
  React.useEffect(() => {
    connect();

    // Reconnect when browser comes back online
    const handleOnline = () => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        reconnectAttemptRef.current = 0;
        connect();
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      intentionalCloseRef.current = true;
      cleanupTimers();
      window.removeEventListener('online', handleOnline);
      if (socketRef.current) {
        try {
          socketRef.current.close(1000, 'Unmounting');
        } catch {
          // ignore
        }
        socketRef.current = null;
      }
    };
  }, [connect, cleanupTimers]);

  const forceReconnect = React.useCallback(() => {
    reconnectAttemptRef.current = 0;
    connect();
  }, [connect]);

  return {
    status,
    reconnect: forceReconnect,
  };
}
