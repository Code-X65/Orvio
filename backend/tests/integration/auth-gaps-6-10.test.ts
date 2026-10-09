import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';
import { verifyAccessToken, signAccessToken } from '../../src/lib/tokens.js';

describe('Auth Hardening Items 6 through 10 (Gaps 6–10)', () => {
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
      'user-agent': 'AuthGaps6To10Agent/1.0',
    };
  }

  // GAP 8: Access tokens carry a unique jti UUID claim
  it('Gap 8: signAccessToken emits a valid UUID jti claim in access token', async () => {
    const claims = {
      sub: 'test-user-id-uuid-1234',
      email: 'jtitest@example.com',
      org_id: 'test-org-id',
      role: 'owner',
    };

    const token = await signAccessToken(claims);
    expect(token).toBeDefined();

    const decoded = await verifyAccessToken(token);
    expect(decoded).toBeDefined();
    expect(decoded?.jti).toBeDefined();
    expect(typeof decoded?.jti).toBe('string');
    // Validate UUID format
    expect(decoded?.jti).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  // GAP 6: login() checks organization status
  it('Gap 6: login() rejects authentication when organization is suspended (403)', async () => {
    const timestamp = Date.now();
    const email = `loginorg${timestamp}@example.com`;
    const password = 'NeutralSecret999#';
    const subdomain = `loginorg${timestamp.toString().slice(-5)}`;
    const headers = generateHeaders();

    // 1. Register & verify user
    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload: {
        email,
        password,
        fullName: 'Login Org Tester',
        organizationName: 'Login Org Workspace',
        subdomain,
        termsAccepted: true,
      },
    });
    expect(regRes.statusCode).toBe(201);

    const user = await ctx.prisma.user.findUnique({ where: { email } });
    await ctx.prisma.user.update({
      where: { id: user!.id },
      data: { email_verified_at: new Date() },
    });

    // 2. Organization active -> login succeeds
    await ctx.prisma.organization.updateMany({
      where: { subdomain },
      data: { status: 'active' },
    });

    const successLogin = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers,
      payload: { email, password },
    });
    expect(successLogin.statusCode).toBe(200);

    // 3. Organization suspended -> login fails with 403 ORGANIZATION_ACCESS_DENIED
    await ctx.prisma.organization.updateMany({
      where: { subdomain },
      data: { status: 'suspended' },
    });

    const blockedLogin = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers,
      payload: { email, password },
    });
    expect(blockedLogin.statusCode).toBe(403);
    expect(blockedLogin.json().error.code).toBe('ORGANIZATION_ACCESS_DENIED');
  }, 45000);

  // GAP 9: Max 10 concurrent active sessions with automatic FIFO pruning
  it('Gap 9: limits concurrent active sessions to 10 by revoking oldest sessions', async () => {
    const timestamp = Date.now();
    const email = `sessioncap${timestamp}@example.com`;
    const password = 'NeutralSecret999#';
    const subdomain = `sesscap${timestamp.toString().slice(-5)}`;
    const headers = generateHeaders();

    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload: {
        email,
        password,
        fullName: 'Session Cap Tester',
        organizationName: 'Session Cap Org',
        subdomain,
        termsAccepted: true,
      },
    });
    expect(regRes.statusCode).toBe(201);

    const user = await ctx.prisma.user.findUnique({ where: { email } });
    await ctx.prisma.user.update({
      where: { id: user!.id },
      data: { email_verified_at: new Date() },
    });
    await ctx.prisma.organization.updateMany({
      where: { subdomain },
      data: { status: 'active' },
    });

    // Perform 12 consecutive logins with distinct client IPs (creates 12 session refresh tokens)
    for (let i = 1; i <= 12; i++) {
      const loginRes = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: generateHeaders(),
        payload: { email, password },
      });
      expect(loginRes.statusCode).toBe(200);
    }

    // Query active refresh tokens
    const activeSessions = await ctx.prisma.refreshToken.findMany({
      where: {
        user_id: user!.id,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
    });

    // Exactly 10 sessions remain active
    expect(activeSessions.length).toBe(10);

    // 2 oldest sessions were revoked
    const revokedSessions = await ctx.prisma.refreshToken.findMany({
      where: {
        user_id: user!.id,
        revoked_at: { not: null },
      },
    });
    expect(revokedSessions.length).toBeGreaterThanOrEqual(2);
  }, 60000);

  // GAP 10: Security audit log entries
  it('Gap 10: writes audit log entries for logout, session revoke, and token refresh', async () => {
    const timestamp = Date.now();
    const email = `auditlogs${timestamp}@example.com`;
    const password = 'NeutralSecret999#';
    const subdomain = `auditlog${timestamp.toString().slice(-5)}`;
    const headers = generateHeaders();

    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload: {
        email,
        password,
        fullName: 'Audit Logger User',
        organizationName: 'Audit Logger Org',
        subdomain,
        termsAccepted: true,
      },
    });

    const user = await ctx.prisma.user.findUnique({ where: { email } });
    await ctx.prisma.user.update({
      where: { id: user!.id },
      data: { email_verified_at: new Date() },
    });
    await ctx.prisma.organization.updateMany({
      where: { subdomain },
      data: { status: 'active' },
    });

    // Login
    const loginRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers,
      payload: { email, password },
    });
    const accessToken = loginRes.json().data.accessToken;
    const refreshToken = loginRes.cookies.find((c) => c.name === 'refreshToken')?.value;

    const { AuthService } = await import('../../src/modules/auth/service.js');
    const authSvc = new AuthService(ctx.prisma, ctx.emailSender);

    // 1. Refresh token -> emits token_refresh audit event
    await authSvc.refresh(refreshToken!);

    // 2. Revoke all sessions -> emits session_revoked audit event
    await authSvc.revokeAllSessions(user!.id);

    // 3. Logout -> emits logout audit event
    await authSvc.logout(undefined, { userId: user!.id });

    // Verify audit log entries
    const auditLogs = await ctx.prisma.auditLog.findMany({
      where: { user_id: user!.id },
      orderBy: { created_at: 'asc' },
    });

    const events = auditLogs.map((l) => l.event);
    expect(events).toContain('login_success');
    expect(events).toContain('token_refresh');
    expect(events).toContain('session_revoked');
    expect(events).toContain('logout');
  }, 45000);
});
