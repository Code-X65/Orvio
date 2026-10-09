import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Critical & High-Severity Auth Gaps (Gaps 1–5)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  function generateHeaders() {
    const randomIp = `10.0.${Math.floor(1 + Math.random() * 250)}.${Math.floor(1 + Math.random() * 250)}`;
    return {
      'x-forwarded-for': randomIp,
      'user-agent': 'AuthGapsTestAgent/1.0',
    };
  }

  // GAP 4: startTrial enforces ToS and blocks disposable emails
  it('Gap 4: startTrial strictly enforces termsAccepted: true and blocks disposable emails', async () => {
    const timestamp = Date.now();
    const headers = generateHeaders();

    // 1. Missing termsAccepted fails
    const failMissingTerms = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/trial',
      headers,
      payload: {
        selectedApps: ['inventory'],
        primaryApp: 'inventory',
        fullName: 'Trial Tester',
        organizationName: 'Trial Org',
        subdomain: `trialnoterms${timestamp.toString().slice(-5)}`,
        email: `valid_${timestamp}@example.com`,
        phone: `+23480${String(timestamp).slice(-8)}`,
      },
    });
    expect(failMissingTerms.statusCode).toBe(400);
    expect(failMissingTerms.json().error.code).toBe('VALIDATION_ERROR');

    // 2. Disposable email fails
    const failDisposable = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/trial',
      headers,
      payload: {
        selectedApps: ['inventory'],
        primaryApp: 'inventory',
        fullName: 'Disposable Tester',
        organizationName: 'Disposable Org',
        subdomain: `trialdisp${timestamp.toString().slice(-5)}`,
        email: `disposable_${timestamp}@mailinator.com`,
        phone: `+23480${String(timestamp).slice(-8)}`,
        termsAccepted: true,
      },
    });
    expect(failDisposable.statusCode).toBe(400);
    expect(failDisposable.json().error.message).toContain('Disposable');

    // 3. Valid payload succeeds
    const successTrial = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/trial',
      headers,
      payload: {
        selectedApps: ['inventory'],
        primaryApp: 'inventory',
        fullName: 'Valid Trial Tester',
        organizationName: 'Valid Trial Org',
        subdomain: `trialok${timestamp.toString().slice(-5)}`,
        email: `validtrial_${timestamp}@example.com`,
        phone: `+23480${String(timestamp).slice(-8)}`,
        termsAccepted: true,
      },
    });
    expect(successTrial.statusCode).toBe(201);
  }, 45000);

  // GAP 2: resetPassword sets email_verified_at and allows login
  it('Gap 2: resetPassword sets email_verified_at and enables subsequent login', async () => {
    const timestamp = Date.now();
    const email = `unverified_${timestamp}@example.com`;
    const initialPassword = 'InitialPassword123#';
    const newPassword = 'NewSecurePassword123#';
    const headers = generateHeaders();

    // Register user (initially unverified)
    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload: {
        email,
        password: initialPassword,
        fullName: 'Reset Verif Tester',
        organizationName: 'Reset Verif Org',
        subdomain: `resetverif${timestamp.toString().slice(-5)}`,
        termsAccepted: true,
      },
    });
    expect(regRes.statusCode).toBe(201);

    const userBefore = await ctx.prisma.user.findUnique({ where: { email } });
    expect(userBefore?.email_verified_at).toBeNull();

    // Request password reset
    const forgotRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      headers,
      payload: { email },
    });
    expect(forgotRes.statusCode).toBe(200);

    // Retrieve the generated password_reset token
    const tokenRecord = await ctx.prisma.verificationToken.findFirst({
      where: { user_id: userBefore!.id, purpose: 'password_reset' },
    });
    expect(tokenRecord).toBeDefined();

    // Simulate resetPassword call using the authService directly or helper
    const { AuthService } = await import('../../src/modules/auth/service.js');
    const authSvc = new AuthService(ctx.prisma, ctx.emailSender);
    const { issueVerificationToken } = await import('../../src/modules/auth/verification.js');
    const { rawToken } = await issueVerificationToken(ctx.prisma, userBefore!.id, 'password_reset', 1);

    const resetResult = await authSvc.resetPassword(rawToken, newPassword);
    expect(resetResult.success).toBe(true);

    // Verify email_verified_at is now set
    const userAfter = await ctx.prisma.user.findUnique({ where: { email } });
    expect(userAfter?.email_verified_at).not.toBeNull();

    // Verify the organization is activated so login succeeds
    await ctx.prisma.organization.updateMany({
      where: { subdomain: `resetverif${timestamp.toString().slice(-5)}` },
      data: { status: 'active' },
    });

    // Login must now succeed with new password
    const loginRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers,
      payload: {
        email,
        password: newPassword,
      },
    });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.json().data.accessToken).toBeDefined();
  }, 45000);

  // GAP 1: refresh() checks user and organization status
  it('Gap 1: refresh() rejects suspended users (401) and suspended organizations (403)', async () => {
    const timestamp = Date.now();
    const email = `statustest${timestamp}@example.com`;
    const password = 'ComplexSecret999#';
    const subdomain = `statustest${timestamp.toString().slice(-5)}`;
    const headers = generateHeaders();

    // 1. Register, activate & login
    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload: {
        email,
        password,
        fullName: 'Status Check User',
        organizationName: 'Status Check Org',
        subdomain,
        termsAccepted: true,
      },
    });
    expect(regRes.statusCode).toBe(201);

    const user = await ctx.prisma.user.findUnique({ where: { email } });
    expect(user).toBeDefined();
    await ctx.prisma.user.update({
      where: { id: user!.id },
      data: { email_verified_at: new Date() },
    });
    await ctx.prisma.organization.updateMany({
      where: { subdomain },
      data: { status: 'active' },
    });

    const loginRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers,
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);
    const refreshToken = loginRes.cookies.find((c) => c.name === 'refreshToken')?.value;
    expect(refreshToken).toBeDefined();

    const { AuthService } = await import('../../src/modules/auth/service.js');
    const authSvc = new AuthService(ctx.prisma, ctx.emailSender);

    // 2. Suspend organization -> refresh should throw 403 ORGANIZATION_ACCESS_DENIED
    await ctx.prisma.organization.updateMany({
      where: { subdomain },
      data: { status: 'suspended' },
    });

    await expect(authSvc.refresh(refreshToken!)).rejects.toMatchObject({
      code: 'ORGANIZATION_ACCESS_DENIED',
      statusCode: 403,
    });

    // 3. Reactivate org, but suspend user -> refresh should throw 401 UNAUTHORIZED
    await ctx.prisma.organization.updateMany({
      where: { subdomain },
      data: { status: 'active' },
    });
    await ctx.prisma.user.update({
      where: { id: user!.id },
      data: { status: 'suspended' },
    });

    await expect(authSvc.refresh(refreshToken!)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  }, 45000);

  // GAP 5: requireAuth blocks requests from suspended workspaces
  it('Gap 5: requireAuth blocks access when organization is suspended (403)', async () => {
    const timestamp = Date.now();
    const email = `authtest${timestamp}@example.com`;
    const password = 'ComplexSecret999#';
    const subdomain = `authtest${timestamp.toString().slice(-5)}`;
    const headers = generateHeaders();

    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload: {
        email,
        password,
        fullName: 'Auth Middleware User',
        organizationName: 'Auth Middleware Org',
        subdomain,
        termsAccepted: true,
      },
    });
    expect(regRes.statusCode).toBe(201);

    const user = await ctx.prisma.user.findUnique({ where: { email } });
    expect(user).toBeDefined();
    await ctx.prisma.user.update({
      where: { id: user!.id },
      data: { email_verified_at: new Date() },
    });
    await ctx.prisma.organization.updateMany({
      where: { subdomain },
      data: { status: 'active' },
    });

    const loginRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers,
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);
    const accessToken = loginRes.json().data.accessToken;

    // Active org -> /api/v1/auth/me succeeds
    const meRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { ...headers, authorization: `Bearer ${accessToken}` },
    });
    expect(meRes.statusCode).toBe(200);

    // Suspend org -> /api/v1/auth/me fails with 403 ORGANIZATION_ACCESS_DENIED
    await ctx.prisma.organization.updateMany({
      where: { subdomain },
      data: { status: 'suspended' },
    });

    const suspendedMeRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { ...headers, authorization: `Bearer ${accessToken}` },
    });
    expect(suspendedMeRes.statusCode).toBe(403);
    expect(suspendedMeRes.json().error.code).toBe('ORGANIZATION_ACCESS_DENIED');
  }, 45000);

  // GAP 3: phone OTP attempt tracking and lockout
  it('Gap 3: verifyPhoneOtp locks out after 5 failed attempts with 429', async () => {
    const timestamp = Date.now();
    const email = `otptest${timestamp}@example.com`;
    const headers = generateHeaders();

    const { AuthService } = await import('../../src/modules/auth/service.js');
    const authSvc = new AuthService(ctx.prisma, ctx.emailSender);
    const { hashPassword } = await import('../../src/lib/password.js');
    const password_hash = await hashPassword('OtpDummyPassword123#');

    const user = await ctx.prisma.user.create({
      data: {
        email,
        password_hash,
        full_name: 'OTP Lockout Tester',
        status: 'active',
        phone: `+23480${String(timestamp).slice(-8)}`,
      },
    });

    // Request phone OTP (creates 6-digit code in verificationToken)
    await authSvc.requestPhoneOtp(user.id, { phone: user.phone! });

    // Try 4 incorrect OTP attempts
    for (let i = 1; i <= 4; i++) {
      await expect(
        authSvc.verifyPhoneOtp(user.id, { otp: '000000' })
      ).rejects.toMatchObject({
        code: 'INVALID_TOKEN',
        statusCode: 400,
      });
    }

    // 5th incorrect attempt -> must throw 429 RATE_LIMIT_EXCEEDED and consume token
    await expect(
      authSvc.verifyPhoneOtp(user.id, { otp: '000000' })
    ).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    });

    // Verify token is marked consumed
    const consumedToken = await ctx.prisma.verificationToken.findFirst({
      where: { user_id: user.id, purpose: 'phone_verification' },
    });
    expect(consumedToken?.consumed_at).not.toBeNull();
  }, 45000);
});
