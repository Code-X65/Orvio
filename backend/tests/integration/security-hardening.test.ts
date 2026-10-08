import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Security Hardening & Token Lifecycle (Items A5–A11)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  function generateClientHeaders() {
    const randomIp = `192.168.${Math.floor(1 + Math.random() * 250)}.${Math.floor(1 + Math.random() * 250)}`;
    return {
      'x-forwarded-for': randomIp,
      'user-agent': 'SecurityTestAgent/1.0',
    };
  }

  it('A7: strictly enforces Terms of Service acceptance on registration', async () => {
    const timestamp = Date.now();
    const headers = generateClientHeaders();

    // 1. Missing termsAccepted fails
    const failMissing = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload: {
        email: `noterms_${timestamp}@example.com`,
        password: 'SecurePassword123#',
        fullName: 'No Terms User',
        organizationName: 'No Terms Org',
        subdomain: `noterms${timestamp.toString().slice(-5)}`,
      },
    });
    expect(failMissing.statusCode).toBe(400);
    expect(failMissing.json().error.code).toBe('VALIDATION_ERROR');

    // 2. termsAccepted: false fails
    const failFalse = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload: {
        email: `falseterms_${timestamp}@example.com`,
        password: 'SecurePassword123#',
        fullName: 'False Terms User',
        organizationName: 'False Terms Org',
        subdomain: `falseterms${timestamp.toString().slice(-5)}`,
        termsAccepted: false,
      },
    });
    expect(failFalse.statusCode).toBe(400);
    expect(failFalse.json().error.code).toBe('VALIDATION_ERROR');

    // 3. termsAccepted: true succeeds
    const okTerms = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload: {
        email: `okterms_${timestamp}@example.com`,
        password: 'SecurePassword123#',
        fullName: 'Valid Terms User',
        organizationName: 'Valid Terms Org',
        subdomain: `okterms${timestamp.toString().slice(-5)}`,
        termsAccepted: true,
      },
    });
    expect(okTerms.statusCode).toBe(201);
  }, 45000);

  it('A6: formats emailed verification and password reset links with URL hash fragments (#token=)', async () => {
    const timestamp = Date.now();
    const email = `fragment_${timestamp}@example.com`;
    const headers = generateClientHeaders();

    ctx.emailSender.clear();

    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload: {
        email,
        password: 'SecurePassword123#',
        fullName: 'Hash Fragment User',
        organizationName: 'Hash Fragment Org',
        subdomain: `hashfrag${timestamp.toString().slice(-5)}`,
        termsAccepted: true,
      },
    });
    expect(regRes.statusCode).toBe(201);

    const sentEmail = ctx.emailSender.sentEmails.find((e) => e.to.some((r) => r.email === email));
    expect(sentEmail).toBeDefined();
    // Link must use #token= to protect against Referrer header and access-log leakage
    expect(sentEmail!.html).toMatch(/\/verify-email#token=[a-zA-Z0-9_-]+/);
  }, 45000);

  it('Stale Token Invalidation: revokes older unconsumed tokens when a new verification token is issued', async () => {
    const timestamp = Date.now();
    const email = `stale_${timestamp}@example.com`;
    const headers = generateClientHeaders();

    // 1. Initial register
    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload: {
        email,
        password: 'SecurePassword123#',
        fullName: 'Stale Token User',
        organizationName: 'Stale Token Org',
        subdomain: `staleorg${timestamp.toString().slice(-5)}`,
        termsAccepted: true,
      },
    });
    expect(regRes.statusCode).toBe(201);

    const firstEmail = ctx.emailSender.sentEmails.find((e) => e.to.some((r) => r.email === email));
    expect(firstEmail).toBeDefined();
    const firstTokenMatch = firstEmail!.html.match(/token=([a-zA-Z0-9_-]+)/);
    expect(firstTokenMatch).not.toBeNull();
    const firstToken = firstTokenMatch![1];

    // 2. Clear emails and wait for cooldown or simulate resend via direct token issuance test
    // Let's verify that issuing a second token directly revokes the first one in the database
    const user = await ctx.prisma.user.findUnique({ where: { email } });
    expect(user).toBeDefined();

    // Directly test that active tokens for purpose 'email_verification' have the first one active before new issue
    const { issueVerificationToken } = await import('../../src/modules/auth/verification.js');
    const { rawToken: secondToken } = await issueVerificationToken(ctx.prisma, user!.id, 'email_verification', 24);

    // 3. Trying to consume the old/first token fails with INVALID_TOKEN or TOKEN_ALREADY_USED
    const tryFirst = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      headers,
      payload: { token: firstToken },
    });
    expect(tryFirst.statusCode).toBe(400);

    // 4. Consuming the latest/second token succeeds
    const trySecond = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      headers,
      payload: { token: secondToken },
    });
    expect(trySecond.statusCode).toBe(200);
  }, 45000);

  it('A5: issues dedicated magic_login purpose tokens and verifies via setupPasswordAndVerify', async () => {
    const timestamp = Date.now();
    const email = `magic_${timestamp}@example.com`;
    const headers = generateClientHeaders();

    // 1. Register unverified user
    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload: {
        email,
        password: 'SecurePassword123#',
        fullName: 'Magic User',
        organizationName: 'Magic Org',
        subdomain: `magicorg${timestamp.toString().slice(-5)}`,
        termsAccepted: true,
      },
    });

    const user = await ctx.prisma.user.findUnique({ where: { email } });
    expect(user).toBeDefined();

    // 2. Request magic login
    ctx.emailSender.clear();
    const magicReq = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-login',
      headers,
      payload: { email },
    });
    expect(magicReq.statusCode).toBe(200);

    // 3. Verify that the issued token in the database has purpose === 'magic_login'
    const magicTokenRecord = await ctx.prisma.verificationToken.findFirst({
      where: { user_id: user!.id, purpose: 'magic_login', consumed_at: null },
    });
    expect(magicTokenRecord).toBeDefined();
    expect(magicTokenRecord!.purpose).toBe('magic_login');

    const sentEmail = ctx.emailSender.sentEmails.find((e) => e.to.some((r) => r.email === email));
    expect(sentEmail).toBeDefined();
    const tokenMatch = sentEmail!.html.match(/token=([a-zA-Z0-9_-]+)/);
    expect(tokenMatch).not.toBeNull();
    const magicToken = tokenMatch![1];

    // 4. Setup password and verify with magic token succeeds
    const setupRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/setup-password-and-verify',
      headers,
      payload: {
        token: magicToken,
        password: 'PermanentPassword2026#',
        confirmPassword: 'PermanentPassword2026#',
      },
    });
    expect(setupRes.statusCode).toBe(200);
  }, 45000);

  it('A10: enforces Idempotency-Key on /register to prevent duplicate processing', async () => {
    const timestamp = Date.now();
    const email = `idemp_${timestamp}@example.com`;
    const subdomain = `idemorg${timestamp.toString().slice(-5)}`;
    const idempotencyKey = `idem-key-${timestamp}-${Math.random()}`;
    const headers = {
      ...generateClientHeaders(),
      'idempotency-key': idempotencyKey,
    };

    const payload = {
      email,
      password: 'SecurePassword123#',
      fullName: 'Idempotent User',
      organizationName: 'Idempotent Org',
      subdomain,
      termsAccepted: true,
    };

    // First request
    const firstRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload,
    });
    expect(firstRes.statusCode).toBe(201);

    // Second request with same idempotency key returns cached 201 response
    const secondRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload,
    });
    expect(secondRes.statusCode).toBe(201);
    expect(secondRes.json().data.userId).toBe(firstRes.json().data.userId);
  }, 45000);
});
