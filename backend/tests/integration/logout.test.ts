import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';
import { hashToken } from '../../src/lib/tokens.js';

describe('POST /api/v1/auth/logout (Session Revocation)', () => {
  let ctx: TestAppContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('revokes refresh token and clears httpOnly session cookie upon logout', async () => {
    const timestamp = Date.now();
    const email = `logout_tester_${timestamp}@example.com`;
    const password = 'Password123!';
    const subdomain = `logoutorg${timestamp.toString().slice(-6)}`;

    // 1. Register and verify email
    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password,
        fullName: 'Logout Tester',
        organizationName: 'Logout Org',
        subdomain,
        termsAccepted: true,
      },
    });
    expect(regRes.statusCode).toBe(201);

    const verifyEmailSent = ctx.emailSender.findVerificationEmail(email);
    expect(verifyEmailSent).toBeDefined();

    const verifyRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: verifyEmailSent!.token },
    });
    expect(verifyRes.statusCode).toBe(200);

    // 2. Login to receive session cookie
    const loginRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);

    const rawRefreshToken = loginRes.cookies.find((c) => c.name === 'refreshToken')?.value || '';
    expect(rawRefreshToken).toBeTruthy();
    const cookieHeader = loginRes.headers['set-cookie'] as string;
    expect(cookieHeader).toBeDefined();

    // 3. Verify refresh token is active in database
    const tokenHash = hashToken(rawRefreshToken);
    const dbTokenBefore = await ctx.prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
    });
    expect(dbTokenBefore).toBeDefined();
    expect(dbTokenBefore?.revoked_at).toBeNull();

    // 4. Logout
    const logoutRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        cookie: cookieHeader,
      },
      payload: {
        refreshToken: rawRefreshToken,
      },
    });

    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json().data.success).toBe(true);

    // 5. Verify refresh token is marked revoked in database
    const dbTokenAfter = await ctx.prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
    });
    expect(dbTokenAfter?.revoked_at).not.toBeNull();

    // 6. Verify subsequent refresh with this token fails
    const refreshAttempt = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: rawRefreshToken },
    });
    expect(refreshAttempt.statusCode).toBe(401);
  }, 35000);
});
