import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('User Lifecycle & Security Review (C1–C4)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  function generateRandomPhone() {
    return `080${Math.floor(10000000 + Math.random() * 90000000)}`;
  }

  function generateClientHeaders() {
    const randomIp = `192.168.${Math.floor(1 + Math.random() * 250)}.${Math.floor(1 + Math.random() * 250)}`;
    return {
      'x-forwarded-for': randomIp,
      'user-agent': 'TestAgent/1.0',
    };
  }

  async function registerAndLoginUser(suffix: string) {
    const timestamp = Date.now();
    const cleanSuffix = suffix.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const email = `user_${cleanSuffix}_${timestamp}_${Math.floor(Math.random() * 1000)}@example.com`;
    const password = 'Password123!';
    const subdomain = `org${cleanSuffix}${Math.floor(10000 + Math.random() * 90000)}`;
    const headers = generateClientHeaders();

    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload: {
        email,
        password,
        fullName: `User ${suffix}`,
        organizationName: `Org ${suffix}`,
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
      headers,
      payload: { token: emailSent!.token },
    });
    expect(verifyRes.statusCode).toBe(200);

    const loginRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers,
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);
    const token = loginRes.json().data.accessToken;

    return { email, password, token, user: loginRes.json().data.user, headers };
  }

  it('C1: updates user profile and normalizes phone number', async () => {
    const { token, headers } = await registerAndLoginUser('profile');
    const phone = generateRandomPhone();

    const updateRes = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/profile',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload: {
        fullName: 'Jane Updated Doe',
        phone,
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const body = updateRes.json().data;
    expect(body.fullName).toBe('Jane Updated Doe');
    expect(body.phone).toBe(`+234${phone.slice(1)}`);
  }, 90000);

  it('C1: rejects duplicate phone number belonging to another user', async () => {
    const userA = await registerAndLoginUser('phonea');
    const userB = await registerAndLoginUser('phoneb');
    const sharedPhone = generateRandomPhone();

    // User A sets phone
    const resA = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/profile',
      headers: { ...userA.headers, authorization: `Bearer ${userA.token}` },
      payload: { phone: sharedPhone },
    });
    expect(resA.statusCode).toBe(200);

    // User B tries to set same phone
    const resB = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/profile',
      headers: { ...userB.headers, authorization: `Bearer ${userB.token}` },
      payload: { phone: sharedPhone },
    });
    expect(resB.statusCode).toBe(409);
    expect(resB.json().error.code).toBe('DUPLICATE_PHONE');
  }, 90000);

  it('C2: performs full email change flow with password confirmation and token consumption', async () => {
    const { token, password, headers } = await registerAndLoginUser('emchange');
    const newEmail = `new_email_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;

    // 1. Request email change with wrong password fails
    const failReq = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-email',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload: {
        newEmail,
        password: 'WrongPassword!',
      },
    });
    expect(failReq.statusCode).toBe(401);

    // 2. Request email change with correct password succeeds
    const okReq = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-email',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload: {
        newEmail,
        password,
      },
    });
    expect(okReq.statusCode).toBe(200);

    // 3. Find email change token from email sender
    const sentEmail = ctx.emailSender.sentEmails.find((e) => e.to.some((rec) => rec.email === newEmail));
    expect(sentEmail).toBeDefined();

    const tokenMatch = sentEmail!.html.match(/token=([a-f0-9]+)/);
    expect(tokenMatch).not.toBeNull();
    const rawToken = tokenMatch![1];

    // 4. Confirm email change
    const confirmRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-email/confirm',
      headers,
      payload: { token: rawToken },
    });
    expect(confirmRes.statusCode).toBe(200);

    // 5. Login with new email succeeds
    const newLogin = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers,
      payload: { email: newEmail, password },
    });
    expect(newLogin.statusCode).toBe(200);
  }, 90000);

  it('C2: sends and verifies 6-digit phone OTP', async () => {
    const { token, headers } = await registerAndLoginUser('phoneotp');
    const phone = generateRandomPhone();

    // 1. Request OTP
    const reqOtp = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/phone/verify/request',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload: { phone },
    });
    expect(reqOtp.statusCode).toBe(200);

    // In non-production or test email fallback, check OTP
    const devOtp = reqOtp.json().data.devOtp;
    expect(devOtp).toBeDefined();
    expect(devOtp).toMatch(/^\d{6}$/);

    // 2. Confirm OTP with wrong code fails
    const failConfirm = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/phone/verify/confirm',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload: { otp: '000000' },
    });
    expect(failConfirm.statusCode).toBe(400);

    // 3. Confirm OTP with valid code succeeds
    const okConfirm = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/phone/verify/confirm',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload: { otp: devOtp },
    });
    expect(okConfirm.statusCode).toBe(200);

    // Check profile
    const meRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { ...headers, authorization: `Bearer ${token}` },
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().data.user.phoneVerifiedAt).toBeDefined();
  }, 90000);

  it('C3: exports user personal data in compliance with GDPR', async () => {
    const { token, email, headers } = await registerAndLoginUser('gdprexport');

    const exportRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me/export',
      headers: { ...headers, authorization: `Bearer ${token}` },
    });

    expect(exportRes.statusCode).toBe(200);
    const data = exportRes.json().data;
    expect(data.exportDate).toBeDefined();
    expect(data.user.email).toBe(email);
    expect(Array.isArray(data.organizations)).toBe(true);
    expect(data.organizations.length).toBeGreaterThan(0);
    expect(Array.isArray(data.recentSecurityEvents)).toBe(true);
  }, 90000);

  it('C3: soft deletes user account with password verification and revokes sessions', async () => {
    const { token, password, headers } = await registerAndLoginUser('gdprdel');

    // 1. Delete account with invalid password fails
    const failDel = await ctx.app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/account',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload: { password: 'WrongPassword!', reason: 'Testing' },
    });
    expect(failDel.statusCode).toBe(401);

    // 2. Delete account with valid password succeeds
    const okDel = await ctx.app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/account',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload: { password, reason: 'Closing business' },
    });
    expect(okDel.statusCode).toBe(200);

    // 3. Prior access token is immediately revoked
    const tryMe = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { ...headers, authorization: `Bearer ${token}` },
    });
    expect(tryMe.statusCode).toBe(401);
  }, 90000);

  it('C4: queries paginated audit logs for authenticated user', async () => {
    const { token, headers } = await registerAndLoginUser('audit');

    // Perform an action that logs an audit entry
    await ctx.app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/profile',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload: { fullName: 'Audit Log Test Name' },
    });

    const logsRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/auth/audit-logs?page=1&limit=10',
      headers: { ...headers, authorization: `Bearer ${token}` },
    });

    expect(logsRes.statusCode).toBe(200);
    const body = logsRes.json().data;
    expect(body.logs).toBeDefined();
    expect(body.logs.length).toBeGreaterThan(0);
    expect(body.pagination.total).toBeGreaterThan(0);
    expect(body.logs.some((l: any) => l.event === 'profile_update')).toBe(true);
  }, 90000);
});
