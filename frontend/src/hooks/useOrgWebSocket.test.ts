import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useOrgWebSocket } from './useOrgWebSocket';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = 0; // CONNECTING
  sentMessages: string[] = [];
  onopen: ((ev: any) => void) | null = null;
  onclose: ((ev: any) => void) | null = null;
  onmessage: ((ev: any) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Simulate connection open next tick
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen({} as any);
    }, 10);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code = 1000, reason = '') {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose({ code, reason, wasClean: true } as any);
  }

  // Helper for test to simulate incoming message
  triggerMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) } as any);
    }
  }
}

describe('useOrgWebSocket Hook', () => {
  let queryClient: QueryClient;
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    vi.useRealTimers();
    MockWebSocket.instances = [];
    (global as any).WebSocket = MockWebSocket;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    (global as any).WebSocket = originalWebSocket;
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );

  it('establishes connection with token and orgId', async () => {
    const { result } = renderHook(
      () => useOrgWebSocket('org-123', 'valid-jwt-token'),
      { wrapper }
    );

    expect(result.current.status).toBe('connecting');

    // Wait for mock connection open
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(result.current.status).toBe('connected');
    expect(MockWebSocket.instances.length).toBe(1);
    expect(MockWebSocket.instances[0].url).toContain('/api/v1/events?token=valid-jwt-token');
  });

  it('dispatches incoming event to onEvent callback and invalidates queries', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const onEvent = vi.fn();

    const { result } = renderHook(
      () => useOrgWebSocket('org-123', 'valid-jwt-token', { onEvent }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(result.current.status).toBe('connected');

    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.triggerMessage({
        type: 'product:created',
        payload: { id: 'prod-999', name: 'Fresh Milk', orgId: 'org-123' },
      });
    });

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'product:created',
        payload: expect.objectContaining({ id: 'prod-999' }),
      })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['inventory', 'products'] });
  });

  it('sends token:refresh when accessToken updates while connected', async () => {
    let token = 'initial-token';
    const { rerender } = renderHook(
      ({ t }) => useOrgWebSocket('org-123', t),
      {
        wrapper,
        initialProps: { t: token },
      }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    const socket = MockWebSocket.instances[0];

    // Rerender with refreshed token inside act
    act(() => {
      rerender({ t: 'refreshed-token' });
    });

    expect(socket.sentMessages.length).toBe(1);
    const sent = JSON.parse(socket.sentMessages[0]);
    expect(sent).toEqual({
      type: 'token:refresh',
      payload: { token: 'refreshed-token' },
    });
  });

  it('handles disconnect and allows manual reconnect', async () => {
    const { result } = renderHook(
      () => useOrgWebSocket('org-123', 'valid-token'),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(result.current.status).toBe('connected');

    // Simulate connection drop
    act(() => {
      MockWebSocket.instances[0].close(1006, 'Connection dropped');
    });

    expect(result.current.status).toBe('disconnected');

    // Manually trigger reconnect
    act(() => {
      result.current.reconnect();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(result.current.status).toBe('connected');
    expect(MockWebSocket.instances.length).toBe(2);
  });
});
