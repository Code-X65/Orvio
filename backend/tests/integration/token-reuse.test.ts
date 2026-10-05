import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Refresh Token Theft & Reuse Detection (Integration)', () => {
  let ctx: TestAppContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('detects refresh token reuse and revokes the entire token family', async () => {
    const timestamp = Date.now();
    const email = `reuse_tester_${timestamp}@example.com`;
    const password = 'Password123!';
    const subdomain = `reuseorg${timestamp.toString().slice(-6)}`;

    // 1. Register & activate user
    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password,
        fullName: 'Reuse Tester',
        organizationName: 'Reuse Org',
        subdomain,
      },
    });
    expect(regRes.statusCode).toBe(201);

    const verifyEmailSent = ctx.emailSender.findVerificationEmail(email);
    const verifyRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: verifyEmailSent!.token },
    });
    expect(verifyRes.statusCode).toBe(200);

    const tokenA = verifyRes.cookies.find((c) => c.name === 'refreshToken')?.value || '';
    expect(tokenA).toBeTruthy();

    // 2. Legitimate refresh: Token A -> Token B
    const refresh1Res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: tokenA },
    });
    expect(refresh1Res.statusCode).toBe(200);

    const tokenB = refresh1Res.cookies.find((c) => c.name === 'refreshToken')?.value || '';
    expect(tokenB).toBeTruthy();
    expect(tokenB).not.toBe(tokenA);

    // 3. Attacker presents old Token A again (Reuse Attack)
    const reuseAttemptRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: tokenA },
    });
    expect(reuseAttemptRes.statusCode).toBe(401);
    expect(reuseAttemptRes.json().error.code).toBe('INVALID_REFRESH_TOKEN');

    // 4. Token B (and all family tokens) should now be invalidated
    const victimAttemptRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: tokenB },
    });
    expect(victimAttemptRes.statusCode).toBe(401);
  }, 35000);
});
