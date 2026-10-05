import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, apiClient, ApiError } from './client';
import { useAuthStore } from '../../stores/auth-store';

describe('API Client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    useAuthStore.getState().clearSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('unwraps successful data envelope from response', async () => {
    const mockData = { id: 'org_123', name: 'Acme Corp' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ status: 'success', data: mockData, meta: { requestId: 'req_1' } }),
    } as unknown as Response);

    const result = await api.get('/orgs/me');
    expect(result).toEqual(mockData);
  });

  it('throws typed ApiError on 400 Bad Request with error details', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email address',
          details: { field: 'email' },
        },
        meta: { requestId: 'req_err_1' },
      }),
    } as unknown as Response);

    await expect(api.post('/auth/register', { email: 'bad' })).rejects.toThrow(ApiError);

    try {
      await api.post('/auth/register', { email: 'bad' });
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe('VALIDATION_ERROR');
      expect(apiErr.status).toBe(400);
      expect(apiErr.message).toBe('Invalid email address');
      expect(apiErr.details).toEqual({ field: 'email' });
      expect(apiErr.requestId).toBe('req_err_1');
    }
  });

  it('performs single-flight token refresh on 401 and retries the original request', async () => {
    useAuthStore.getState().setSession(
      'expired-token',
      { id: 'usr_1', email: 'test@example.com', fullName: 'Tester', status: 'active' },
      { id: 'org_1', name: 'Test Org', subdomain: 'testorg', status: 'active' }
    );

    let refreshCallCount = 0;
    let protectedCallCount = 0;

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const urlStr = url.toString();

      if (urlStr.includes('/auth/refresh')) {
        refreshCallCount++;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            status: 'success',
            data: {
              accessToken: 'new-valid-token',
              user: { id: 'usr_1', email: 'test@example.com', fullName: 'Tester', status: 'active', emailVerifiedAt: '2026-09-30T00:00:00Z' },
              organization: { id: 'org_1', name: 'Test Org', subdomain: 'testorg', status: 'active' },
            },
          }),
        } as unknown as Response;
      }

      if (urlStr.includes('/orgs/me')) {
        protectedCallCount++;
        const authHeader = (init?.headers as Headers)?.get?.('Authorization') || (init?.headers as Record<string, string>)?.[`Authorization`];
        
        if (authHeader === 'Bearer expired-token') {
          return {
            ok: false,
            status: 401,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              error: { code: 'UNAUTHORIZED', message: 'Token expired' },
            }),
          } as unknown as Response;
        }

        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            status: 'success',
            data: { organization: { id: 'org_1', name: 'Test Org' } },
          }),
        } as unknown as Response;
      }

      return {
        ok: false,
        status: 404,
        headers: new Headers(),
        json: async () => ({}),
      } as unknown as Response;
    });

    // Make 2 concurrent requests that initially have expired-token
    const [res1, res2] = await Promise.all([
      api.get('/orgs/me'),
      api.get('/orgs/me'),
    ]);

    expect(res1).toEqual({ organization: { id: 'org_1', name: 'Test Org' } });
    expect(res2).toEqual({ organization: { id: 'org_1', name: 'Test Org' } });

    // Single flight: /auth/refresh was only called ONCE for both concurrent requests
    expect(refreshCallCount).toBe(1);
    expect(useAuthStore.getState().accessToken).toBe('new-valid-token');
  });

  it('clears session if refresh fails on 401', async () => {
    useAuthStore.getState().setSession(
      'expired-token',
      { id: 'usr_1', email: 'test@example.com', fullName: 'Tester', status: 'active' },
      { id: 'org_1', name: 'Test Org', subdomain: 'testorg', status: 'active' }
    );

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const urlStr = url.toString();
      if (urlStr.includes('/auth/refresh')) {
        return {
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token revoked' } }),
        } as unknown as Response;
      }

      return {
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Token expired' } }),
      } as unknown as Response;
    });

    await expect(apiClient('/orgs/me')).rejects.toThrow(ApiError);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });
});
