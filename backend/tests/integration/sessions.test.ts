import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Active Sessions & Immediate JWT Revocation Management', () => {
  let ctx: TestAppContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('lists active sessions and allows revoking individual or all other sessions', async () => {
    const timestamp = Date.now();
    const email = `session_user_${timestamp}@example.com`;
    const password = 'Password123!';
    const subdomain = `sessionorg${timestamp.toString().slice(-6)}`;

    // 1. Register & verify user
    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password,
        fullName: 'Session User',
        organizationName: 'Session Org',
        subdomain,
        termsAccepted: true,
      },
    });
    expect(regRes.statusCode).toBe(201);

    const emailSent = ctx.emailSender.findVerificationEmail(email);
    expect(emailSent).toBeDefined();

    const verifyRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: emailSent!.token },
    });
    expect(verifyRes.statusCode).toBe(200);

    // 2. Login Session 1 (Device A)
    const login1 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'user-agent': 'Device-A/Chrome' },
      payload: { email, password },
    });
    expect(login1.statusCode).toBe(200);
    const token1 = login1.json().data.accessToken;

    // 3. Login Session 2 (Device B)
    const login2 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'user-agent': 'Device-B/Safari' },
      payload: { email, password },
    });
    expect(login2.statusCode).toBe(200);
    const token2 = login2.json().data.accessToken;

    // 4. List sessions via Device 2
    const listRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/auth/sessions',
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(listRes.statusCode).toBe(200);
    const sessions = listRes.json().data.sessions;
    expect(sessions.length).toBeGreaterThanOrEqual(2);

    const currentSession = sessions.find((s: any) => s.isCurrent);
    expect(currentSession).toBeDefined();
    const otherSession = sessions.find((s: any) => !s.isCurrent);
    expect(otherSession).toBeDefined();

    // 5. Revoke Device 1's session using its ID
    const revokeRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/auth/sessions/${otherSession.id}`,
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(revokeRes.statusCode).toBe(200);

    // 6. Access token for Device 1 should now be IMMEDIATELY rejected (0-second wait)
    const protectedAttemptDevice1 = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(protectedAttemptDevice1.statusCode).toBe(401);
    expect(protectedAttemptDevice1.json().error.code).toBe('UNAUTHORIZED');

    // 7. Device 2 access token remains valid
    const protectedAttemptDevice2 = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(protectedAttemptDevice2.statusCode).toBe(200);

    // 8. Logout on Device 2 immediately invalidates Device 2's access token
    const logoutRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(logoutRes.statusCode).toBe(200);

    const afterLogoutAttempt = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(afterLogoutAttempt.statusCode).toBe(401);
  }, 45000);
});
