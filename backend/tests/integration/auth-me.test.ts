import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('GET /api/v1/auth/me (User Profile & Hydration)', () => {
  let ctx: TestAppContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns full user, active organization, and memberships when authenticated', async () => {
    const timestamp = Date.now();
    const email = `me_tester_${timestamp}@example.com`;
    const password = 'Password123!';
    const subdomain = `meorg${timestamp.toString().slice(-6)}`;

    // 1. Register & activate
    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password,
        fullName: 'Profile Tester',
        organizationName: 'Profile Org',
        subdomain,
      },
    });

    const verifyEmailSent = ctx.emailSender.findVerificationEmail(email);
    const verifyRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: verifyEmailSent!.token },
    });

    const accessToken = verifyRes.json().data.accessToken;

    // 2. Fetch profile via /auth/me
    const meRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(meRes.statusCode).toBe(200);
    const data = meRes.json().data;
    expect(data.user.email).toBe(email);
    expect(data.user.fullName).toBe('Profile Tester');
    expect(data.organization.subdomain).toBe(subdomain);
    expect(data.organization.status).toBe('active');
    expect(data.memberships.length).toBeGreaterThan(0);
    expect(data.memberships[0].role).toBe('owner');
  }, 30000);
});
