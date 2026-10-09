import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';
import { purgeExpiredAuthData } from '../../src/modules/auth/cleanup.js';
import { AuthService } from '../../src/modules/auth/service.js';
import { hashPassword } from '../../src/lib/password.js';
import { hashToken } from '../../src/lib/tokens.js';

describe('Auth Hardening Part 3 (Cookie Scoping, Data Purge, Polish)', () => {
  let ctx: TestAppContext;
  let authService: AuthService;

  beforeAll(async () => {
    ctx = await createTestApp();
    authService = new AuthService(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  function generateHeaders() {
    const randomIp = `10.0.${Math.floor(1 + Math.random() * 250)}.${Math.floor(1 + Math.random() * 250)}`;
    return {
      'x-forwarded-for': randomIp,
      'user-agent': 'AuthHardeningPart3Agent/1.0',
    };
  }

  // 1. Cookie Path scoping
  it('Item 11: Refresh token cookie is strictly scoped to Path=/api/v1/auth', async () => {
    const timestamp = Date.now();
    const email = `cookiepath${timestamp}@example.com`;
    const password = 'NeutralSecret999#';
    const subdomain = `cookie${timestamp.toString().slice(-5)}`;
    const headers = generateHeaders();

    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload: {
        email,
        password,
        fullName: 'Cookie Path Tester',
        organizationName: 'Cookie Path Org',
        subdomain,
        termsAccepted: true,
      },
    });
    expect(regRes.statusCode).toBe(201);

    const user = await ctx.prisma.user.findUnique({
      where: { email },
      include: { memberships: true },
    });
    const passwordHash = await hashPassword(password);
    await ctx.prisma.user.update({
      where: { id: user!.id },
      data: {
        email_verified_at: new Date(),
        password_hash: passwordHash,
      },
    });

    for (const m of user!.memberships) {
      await ctx.prisma.organization.update({
        where: { id: m.org_id },
        data: { status: 'active' },
      });
    }

    const loginRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: generateHeaders(),
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    const setCookie = loginRes.headers['set-cookie'];
    expect(setCookie).toBeDefined();

    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie as string);
    expect(cookieStr).toContain('refreshToken=');
    expect(cookieStr.toLowerCase()).toContain('path=/api/v1/auth');
    expect(cookieStr.toLowerCase()).toContain('httponly');
    expect(cookieStr.toLowerCase()).toContain('samesite=lax');
  });

  // 2. Data Cleanup / Purge
  it('Item 13: purgeExpiredAuthData deletes expired verification and refresh tokens', async () => {
    const timestamp = Date.now();
    const email = `purgeuser${timestamp}@example.com`;
    const user = await ctx.prisma.user.create({
      data: {
        email,
        password_hash: 'dummyhash',
        full_name: 'Purge Tester',
      },
    });

    // Create an expired verification token
    await ctx.prisma.verificationToken.create({
      data: {
        token_hash: hashToken(`expired_raw_${timestamp}`),
        user_id: user.id,
        purpose: 'email_verification',
        expires_at: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      },
    });

    // Create an active verification token
    await ctx.prisma.verificationToken.create({
      data: {
        token_hash: hashToken(`active_raw_${timestamp}`),
        user_id: user.id,
        purpose: 'email_verification',
        expires_at: new Date(Date.now() + 1000 * 60 * 60), // 1 hour future
      },
    });

    // Create an expired revoked refresh token
    await ctx.prisma.refreshToken.create({
      data: {
        token_hash: `revoked_hash_${timestamp}`,
        jti: crypto.randomUUID(),
        user_id: user.id,
        family_id: `fam_${timestamp}`,
        session_id: `sess_${timestamp}`,
        revoked_at: new Date(Date.now() - 1000 * 60 * 30),
        expires_at: new Date(Date.now() - 1000 * 60 * 10),
      },
    });

    // Create an active unrevoked refresh token
    await ctx.prisma.refreshToken.create({
      data: {
        token_hash: `active_hash_${timestamp}`,
        jti: crypto.randomUUID(),
        user_id: user.id,
        family_id: `fam_act_${timestamp}`,
        session_id: `sess_act_${timestamp}`,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
    });

    const result = await purgeExpiredAuthData(ctx.prisma);
    expect(result.deletedVerificationTokens).toBeGreaterThanOrEqual(1);
    expect(result.deletedRefreshTokens).toBeGreaterThanOrEqual(1);

    // Verify active tokens remain untouched
    const activeVerif = await ctx.prisma.verificationToken.findUnique({
      where: { token_hash: hashToken(`active_raw_${timestamp}`) },
    });
    expect(activeVerif).not.toBeNull();

    const activeRefresh = await ctx.prisma.refreshToken.findUnique({
      where: { token_hash: `active_hash_${timestamp}` },
    });
    expect(activeRefresh).not.toBeNull();
  });

  // 3. Phone Verification Fast-Path
  it('Polish: verifyPhoneOtp returns success immediately if phone is already verified', async () => {
    const timestamp = Date.now();
    const email = `phoneuser${timestamp}@example.com`;
    const user = await ctx.prisma.user.create({
      data: {
        email,
        password_hash: 'dummyhash',
        full_name: 'Phone User',
        phone: '+15551234567',
        phone_verified_at: new Date(),
      },
    });

    const res = await authService.verifyPhoneOtp(user.id, '999999');
    expect(res).toEqual({ success: true, message: 'Phone number is already verified.' });
  });

  // 4. Export User Data Active Sessions
  it('Polish: exportUserData includes active sessions', async () => {
    const timestamp = Date.now();
    const email = `exportuser${timestamp}@example.com`;
    const user = await ctx.prisma.user.create({
      data: {
        email,
        password_hash: 'dummyhash',
        full_name: 'Export User',
      },
    });

    await ctx.prisma.refreshToken.create({
      data: {
        token_hash: `export_hash_${timestamp}`,
        jti: crypto.randomUUID(),
        user_id: user.id,
        family_id: `fam_exp_${timestamp}`,
        session_id: `sess_exp_${timestamp}`,
        user_agent: 'ExportTestAgent/1.0',
        created_ip: '10.0.0.1',
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
    });

    const exportData = await authService.exportUserData(user.id);
    expect(exportData).toBeDefined();
    expect(exportData.user.email).toBe(email);
    expect(Array.isArray(exportData.activeSessions)).toBe(true);
    expect(exportData.activeSessions.length).toBe(1);
    expect(exportData.activeSessions[0].userAgent).toBe('ExportTestAgent/1.0');
  });

  // 5. Delete Account Inactivates Memberships
  it('Polish: deleteAccount marks organization memberships as suspended', async () => {
    const timestamp = Date.now();
    const email = `deluser${timestamp}@example.com`;
    const password = 'NeutralSecret999#';
    const subdomain = `del${timestamp.toString().slice(-5)}`;
    const headers = generateHeaders();

    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload: {
        email,
        password,
        fullName: 'Delete Tester',
        organizationName: 'Delete Org',
        subdomain,
        termsAccepted: true,
      },
    });

    const user = await ctx.prisma.user.findUnique({
      where: { email },
      include: { memberships: true },
    });
    expect(user).not.toBeNull();
    expect(user!.memberships.length).toBeGreaterThan(0);

    const passwordHash = await hashPassword(password);
    await ctx.prisma.user.update({
      where: { id: user!.id },
      data: { password_hash: passwordHash },
    });

    await authService.deleteAccount(user!.id, { password, confirmationText: 'DELETE' });

    const updatedMemberships = await ctx.prisma.membership.findMany({
      where: { user_id: user!.id },
    });
    for (const m of updatedMemberships) {
      expect(m.status).toBe('suspended');
    }
  });
});
