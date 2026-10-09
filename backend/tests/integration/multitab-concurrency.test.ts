import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Multi-Tab Session & Concurrent Token Refresh (Enterprise Best Practice)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('allows 3 concurrent tabs to refresh tokens simultaneously within the grace period without invalidating the session', async () => {
    const timestamp = Date.now();
    const email = `multitab_${timestamp}@example.com`;
    const password = 'Password123!';
    const subdomain = `multitab${timestamp.toString().slice(-6)}`;

    // 1. Register & verify user
    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password,
        fullName: 'MultiTab User',
        organizationName: 'MultiTab Org',
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

    // 2. User logs in (Simulating Browser Session Creation)
    const loginRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);

    // Extract the shared session refresh cookie
    const cookies = loginRes.cookies;
    const refreshCookie = cookies.find((c) => c.name === 'refreshToken');
    expect(refreshCookie).toBeDefined();
    const cookieHeader = `refreshToken=${refreshCookie!.value}`;

    // 3. Simulate 3 concurrent browser tabs firing /refresh at the exact same millisecond
    const [tab1Res, tab2Res, tab3Res] = await Promise.all([
      ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: {
          cookie: cookieHeader,
          'user-agent': 'Browser/Tab-1',
        },
      }),
      ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: {
          cookie: cookieHeader,
          'user-agent': 'Browser/Tab-2',
        },
      }),
      ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: {
          cookie: cookieHeader,
          'user-agent': 'Browser/Tab-3',
        },
      }),
    ]);

    // All 3 tabs must receive 200 OK with valid access tokens!
    expect(tab1Res.statusCode).toBe(200);
    expect(tab2Res.statusCode).toBe(200);
    expect(tab3Res.statusCode).toBe(200);

    expect(tab1Res.json().data.accessToken).toBeDefined();
    expect(tab2Res.json().data.accessToken).toBeDefined();
    expect(tab3Res.json().data.accessToken).toBeDefined();

    // Verify all 3 tokens are valid to access protected endpoints
    const testProtected1 = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/orgs/me',
      headers: { authorization: `Bearer ${tab1Res.json().data.accessToken}` },
    });
    expect(testProtected1.statusCode).toBe(200);

    const testProtected2 = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/orgs/me',
      headers: { authorization: `Bearer ${tab2Res.json().data.accessToken}` },
    });
    expect(testProtected2.statusCode).toBe(200);

    const testProtected3 = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/orgs/me',
      headers: { authorization: `Bearer ${tab3Res.json().data.accessToken}` },
    });
    expect(testProtected3.statusCode).toBe(200);
  });
});
