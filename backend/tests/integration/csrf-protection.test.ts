import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { AuthService } from '../../src/modules/auth/service.js';
import type { FastifyInstance } from 'fastify';

describe('CSRF & Subdomain Tenant Isolation (Integration)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it('1. Rejects request with 403 CSRF_ORIGIN_INVALID when cross-origin attacker Origin is provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        origin: 'https://evil-attacker.com',
      },
      cookies: {
        refreshToken: 'valid_refresh_token',
      },
    });

    expect(res.statusCode).toBe(403);
    const json = res.json();
    expect(json.status).toBe('error');
    expect(json.error.code).toBe('CSRF_ORIGIN_INVALID');
  });

  it('2. Rejects request with 403 CSRF_TOKEN_MISSING when csrfToken cookie exists but X-CSRF-Token header is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: {
        refreshToken: 'valid_refresh_token',
        csrfToken: 'secret_csrf_cookie_val_1234567890123456',
      },
    });

    expect(res.statusCode).toBe(403);
    const json = res.json();
    expect(json.status).toBe('error');
    expect(json.error.code).toBe('CSRF_TOKEN_MISSING');
  });

  it('3. Rejects request with 403 CSRF_TOKEN_MISMATCH when X-CSRF-Token does not match csrfToken cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        'x-csrf-token': 'attacker_wrong_token_1234567890123456',
      },
      cookies: {
        refreshToken: 'valid_refresh_token',
        csrfToken: 'legitimate_csrf_token_1234567890123456',
      },
    });

    expect(res.statusCode).toBe(403);
    const json = res.json();
    expect(json.status).toBe('error');
    expect(json.error.code).toBe('CSRF_TOKEN_MISMATCH');
  });

  it('4. Accepts request and rotates CSRF token when valid X-CSRF-Token header matches cookie', async () => {
    const csrfVal = 'legitimate_csrf_token_1234567890123456';
    vi.spyOn(AuthService.prototype, 'refresh').mockResolvedValueOnce({
      accessToken: 'new_token_123',
      refreshToken: 'new_refresh_456',
      user: { id: 'usr_1', email: 'test@example.com' } as any,
      organization: { id: 'org_1', subdomain: 'acme', name: 'Acme' } as any,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        'x-csrf-token': csrfVal,
      },
      cookies: {
        refreshToken: 'valid_refresh_token',
        csrfToken: csrfVal,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('success');
    expect(json.data.accessToken).toBe('new_token_123');

    const newCsrfCookie = res.cookies.find((c) => c.name === 'csrfToken');
    expect(newCsrfCookie).toBeDefined();
    expect(newCsrfCookie?.value).not.toBe(csrfVal); // Rotated
  });

  it('5. Rejects request with 403 CROSS_TENANT_SESSION_REJECTED when x-tenant-subdomain does not match org subdomain', async () => {
    const csrfVal = 'legitimate_csrf_token_1234567890123456';
    vi.spyOn(AuthService.prototype, 'refresh').mockResolvedValueOnce({
      accessToken: 'new_token_123',
      refreshToken: 'new_refresh_456',
      user: { id: 'usr_1', email: 'test@example.com' } as any,
      organization: { id: 'org_1', subdomain: 'tenant-a', name: 'Tenant A' } as any,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        'x-csrf-token': csrfVal,
        'x-tenant-subdomain': 'tenant-b', // Cross-tenant attempt!
      },
      cookies: {
        refreshToken: 'valid_refresh_token',
        csrfToken: csrfVal,
      },
    });

    expect(res.statusCode).toBe(403);
    const json = res.json();
    expect(json.status).toBe('error');
    expect(json.error.code).toBe('CROSS_TENANT_SESSION_REJECTED');
  });
});
