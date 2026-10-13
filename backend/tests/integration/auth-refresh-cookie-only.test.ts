import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { AuthService } from '../../src/modules/auth/service.js';
import { AppError } from '../../src/lib/errors.js';
import type { FastifyInstance } from 'fastify';

describe('Auth /refresh Cookie-Only Authentication (Integration)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  // 1. Valid cookie -> Returns new access token + rotates refresh cookie
  it('1. Valid cookie: Returns new access token and rotates refresh cookie', async () => {
    const refreshSpy = vi.spyOn(AuthService.prototype, 'refresh').mockResolvedValueOnce({
      accessToken: 'fresh_jwt_access_token_123',
      refreshToken: 'rotated_refresh_token_456',
      user: { id: 'usr_1', email: 'test@example.com' } as any,
      organization: { id: 'org_1', name: 'Test Org' } as any,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { refreshToken: 'valid_incoming_refresh_cookie_abc' },
    });

    expect(res.statusCode).toBe(200);
    expect(refreshSpy).toHaveBeenCalledWith('valid_incoming_refresh_cookie_abc');

    const json = res.json();
    expect(json.status).toBe('success');
    expect(json.data.accessToken).toBe('fresh_jwt_access_token_123');

    const rotatedCookie = res.cookies.find((c) => c.name === 'refreshToken');
    expect(rotatedCookie).toBeDefined();
    expect(rotatedCookie?.value).toBe('rotated_refresh_token_456');
    expect(rotatedCookie?.httpOnly).toBe(true);
  });

  // 2. Missing cookie -> Returns 401 MISSING_REFRESH_TOKEN
  it('2. Missing cookie: Returns 401 MISSING_REFRESH_TOKEN', async () => {
    const refreshSpy = vi.spyOn(AuthService.prototype, 'refresh');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
    });

    expect(res.statusCode).toBe(401);
    expect(refreshSpy).not.toHaveBeenCalled();

    const json = res.json();
    expect(json.status).toBe('error');
    expect(json.error.code).toBe('MISSING_REFRESH_TOKEN');
    expect(json.error.message).toBe('Refresh token not found in session cookie');
  });

  // 3. Invalid/expired cookie -> Returns 401 INVALID_REFRESH_TOKEN
  it('3. Invalid cookie: Returns 401 INVALID_REFRESH_TOKEN', async () => {
    const refreshSpy = vi
      .spyOn(AuthService.prototype, 'refresh')
      .mockRejectedValueOnce(new AppError('INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired', 401));

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { refreshToken: 'invalid_expired_token' },
    });

    expect(res.statusCode).toBe(401);
    expect(refreshSpy).toHaveBeenCalledWith('invalid_expired_token');

    const json = res.json();
    expect(json.status).toBe('error');
    expect(json.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  // 4. Body with refreshToken (no cookie) -> Returns 401 MISSING_REFRESH_TOKEN (body ignored)
  it('4. Body with refreshToken (no cookie): Returns 401 MISSING_REFRESH_TOKEN (body ignored)', async () => {
    const refreshSpy = vi.spyOn(AuthService.prototype, 'refresh');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'stolen_refresh_token_sent_in_body' },
    });

    expect(res.statusCode).toBe(401);
    expect(refreshSpy).not.toHaveBeenCalled();

    const json = res.json();
    expect(json.status).toBe('error');
    expect(json.error.code).toBe('MISSING_REFRESH_TOKEN');
    expect(json.error.message).toBe('Refresh token not found in session cookie');
  });

  // 5. Both cookie and body -> Uses cookie, ignores body
  it('5. Both cookie and body: Uses valid cookie and ignores body payload', async () => {
    const refreshSpy = vi.spyOn(AuthService.prototype, 'refresh').mockResolvedValueOnce({
      accessToken: 'valid_access_token_from_cookie',
      refreshToken: 'new_rotated_refresh_token',
      user: { id: 'usr_2' } as any,
      organization: { id: 'org_2' } as any,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { refreshToken: 'valid_cookie_token' },
      payload: { refreshToken: 'untrusted_body_token_that_must_be_ignored' },
    });

    expect(res.statusCode).toBe(200);
    // Crucial security check: refresh MUST be invoked with cookie value, NOT the body value
    expect(refreshSpy).toHaveBeenCalledWith('valid_cookie_token');
    expect(refreshSpy).not.toHaveBeenCalledWith('untrusted_body_token_that_must_be_ignored');

    const json = res.json();
    expect(json.status).toBe('success');
    expect(json.data.accessToken).toBe('valid_access_token_from_cookie');
  });
});
