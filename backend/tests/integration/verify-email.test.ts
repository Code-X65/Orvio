import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('POST /api/v1/auth/verify-email and resend verification', () => {
  let ctx: TestAppContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('activates pending organization, marks user email verified, and dispatches welcome email', async () => {
    const timestamp = Date.now();
    const email = `verify_${timestamp}@example.com`;
    const subdomain = `vorg${timestamp}`.slice(0, 20);

    // 1. Register User & Org
    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        fullName: 'Pending Founder',
        email,
        password: 'Password123!',
        organizationName: `Verify Org ${timestamp}`,
        subdomain,
      },
    });

    // 2. Extract verification token from intercepted email
    const verificationEmail = ctx.emailSender.getLastEmail();
    expect(verificationEmail).toBeDefined();
    const match = verificationEmail?.html.match(/token=([a-f0-9]+)/);
    expect(match).toBeDefined();
    const token = match![1];

    ctx.emailSender.clear();

    // 3. Verify Email
    const verifyRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyJson = verifyRes.json();
    expect(verifyJson.data.accessToken).toBeDefined();
    expect(verifyJson.data.user.email).toBe(email);
    expect(verifyJson.data.organization.status).toBe('active');

    // 4. Verify Database State
    const user = await ctx.prisma.user.findUnique({ where: { email } });
    expect(user?.email_verified_at).not.toBeNull();

    const org = await ctx.prisma.organization.findUnique({ where: { subdomain } });
    expect(org?.status).toBe('active');

    // 5. Verify Welcome Email was dispatched
    expect(ctx.emailSender.sentEmails.length).toBe(1);
    const welcomeEmail = ctx.emailSender.getLastEmail();
    expect(welcomeEmail?.to[0].email).toBe(email);
    expect(welcomeEmail?.subject).toContain('Welcome to Orvio Hub');
    expect(welcomeEmail?.html).toContain(`${subdomain}.`);
  });

  it('rejects reused or invalid verification tokens with 400 error', async () => {
    const invalidToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: invalidToken },
    });

    expect(response.statusCode).toBe(400);
    const json = response.json();
    expect(json.error.code).toBe('INVALID_TOKEN');
  });

  it('enforces 60-second cooldown on resend verification requests', async () => {
    const timestamp = Date.now();
    const email = `cooldown_${timestamp}@example.com`;
    const subdomain = `cool${timestamp}`.slice(0, 20);

    // 1. Register
    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        fullName: 'Cooldown Tester',
        email,
        password: 'Password123!',
        organizationName: 'Cooldown Org',
        subdomain,
      },
    });

    // 2. Immediate resend within 60s cooldown -> 429
    const resendRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email/resend',
      payload: { email },
    });

    expect(resendRes.statusCode).toBe(429);
    const json = resendRes.json();
    expect(json.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(json.error.message).toContain('Please wait');
  });
});
