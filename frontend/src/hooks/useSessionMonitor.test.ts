import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSessionMonitor } from './useSessionMonitor';
import { useAuthStore } from '../stores/auth-store';
import * as clientModule from '../lib/api/client';

vi.mock('../lib/api/client', () => ({
  executeTokenRefresh: vi.fn(),
  isJwtValid: vi.fn(),
}));

function createMockJwt(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'user_1', exp: expSeconds }));
  return `${header}.${payload}.mockSignature`;
}

describe('useSessionMonitor Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    useAuthStore.getState().clearSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when status is anonymous or no token is present', () => {
    renderHook(() => useSessionMonitor());
    expect(clientModule.executeTokenRefresh).not.toHaveBeenCalled();
  });

  it('triggers proactive background refresh when token expires in less than 90 seconds', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const nearExpiryToken = createMockJwt(nowSec + 60); // 60s remaining (< 90s)

    useAuthStore.getState().setSession(
      nearExpiryToken,
      { id: 'usr_1', email: 'test@example.com', fullName: 'Test User', status: 'active', emailVerifiedAt: '2026-09-30T10:00:00Z' },
      { id: 'org_1', name: 'Test Org', subdomain: 'testorg', status: 'active' }
    );

    vi.mocked(clientModule.executeTokenRefresh).mockResolvedValueOnce('fresh_access_token');

    renderHook(() => useSessionMonitor());

    expect(clientModule.executeTokenRefresh).toHaveBeenCalledTimes(1);
  });

  it('triggers session expiration event when token is already expired and refresh fails', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const expiredToken = createMockJwt(nowSec - 10); // Expired 10s ago

    useAuthStore.getState().setSession(
      expiredToken,
      { id: 'usr_1', email: 'test@example.com', fullName: 'Test User', status: 'active', emailVerifiedAt: '2026-09-30T10:00:00Z' },
      { id: 'org_1', name: 'Test Org', subdomain: 'testorg', status: 'active' }
    );

    const eventSpy = vi.fn();
    window.addEventListener('orvio:auth:session-expired', eventSpy);

    vi.mocked(clientModule.executeTokenRefresh).mockResolvedValueOnce(null);

    renderHook(() => useSessionMonitor());

    // Allow promise resolution
    await vi.waitFor(() => {
      expect(clientModule.executeTokenRefresh).toHaveBeenCalled();
    });

    window.removeEventListener('orvio:auth:session-expired', eventSpy);
  });

  it('triggers checkSession immediately upon document visibilitychange', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const nearExpiryToken = createMockJwt(nowSec + 45); // 45s remaining

    useAuthStore.getState().setSession(
      nearExpiryToken,
      { id: 'usr_1', email: 'test@example.com', fullName: 'Test User', status: 'active', emailVerifiedAt: '2026-09-30T10:00:00Z' },
      { id: 'org_1', name: 'Test Org', subdomain: 'testorg', status: 'active' }
    );

    vi.mocked(clientModule.executeTokenRefresh).mockResolvedValue('fresh_access_token');

    renderHook(() => useSessionMonitor());

    // Wait for initial mount checkSession to finish
    await vi.waitFor(() => {
      expect(clientModule.executeTokenRefresh).toHaveBeenCalledTimes(1);
    });

    vi.clearAllMocks();

    // Simulate tab becoming visible
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(clientModule.executeTokenRefresh).toHaveBeenCalledTimes(1);
  });
});
