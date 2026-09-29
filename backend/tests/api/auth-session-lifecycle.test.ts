import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { buildApp } from '../../src/app.js';
import { databaseStub, testEnv } from '../helpers/app.js';
import { hashPassword, hashToken, issueAccessToken } from '../../src/modules/auth/security.js';
import type { DatabaseClient } from '../../src/infrastructure/database/prisma.js';

describe('auth session lifecycle and security hardening (C-1, C-2, C-3, C-4)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const testUserId = '11111111-1111-1111-1111-111111111111';
  const testSessionId = '22222222-2222-2222-2222-222222222222';
  const testFamilyId = '44444444-4444-4444-4444-444444444444';

  it('C-1: immediate access token invalidation when session is revoked', async () => {
    let sessionRevoked = false;
    const db = databaseStub({
      authSession: {
        findFirst: (async (args?: { where?: { id?: string } }) => {
          if (args?.where?.id === testSessionId && !sessionRevoked) {
            return {
              id: testSessionId,
              userId: testUserId,
              familyId: testFamilyId,
              rememberMe: true,
              expiresAt: new Date(Date.now() + 86400000),
              absoluteExpiresAt: new Date(Date.now() + 86400000),
              lastActivityAt: new Date(),
              revokedAt: null,
              user: { id: testUserId, status: 'ACTIVE', deletedAt: null },
            };
          }
          return null;
        }) as unknown as DatabaseClient['authSession']['findFirst'],
      } as DatabaseClient['authSession'],
      user: {
        findUnique: (async () => ({
          id: testUserId,
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          phone: null,
          emailVerifiedAt: new Date(),
          phoneVerifiedAt: null,
          passwordSetAt: new Date(),
          onboardingCompletedAt: new Date(),
          status: 'ACTIVE',
          deletedAt: null,
        })) as unknown as DatabaseClient['user']['findUnique'],
      } as DatabaseClient['user'],
      userOnboarding: { findUnique: (async () => null) as unknown as DatabaseClient['userOnboarding']['findUnique'] } as DatabaseClient['userOnboarding'],
    });

    app = await buildApp({ env: testEnv, database: db });
    const accessToken = await issueAccessToken({ sub: testUserId, sid: testSessionId }, testEnv.JWT_SECRET);

    // Active session -> request succeeds
    const activeRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(activeRes.statusCode).toBe(200);

    // Revoke session -> subsequent request with same access token is rejected
    sessionRevoked = true;
    const revokedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(revokedRes.statusCode).toBe(401);
    expect(revokedRes.json().error.code).toBe('SESSION_EXPIRED');
  });

  it('C-2: refresh token rotation with multi-tab grace window and reuse detection', async () => {
    const rawOldToken = 'old-opaque-token-12345678901234567890123456789012';
    const oldHash = hashToken(rawOldToken);
    const newHash = hashToken('new-rotated-token-12345678901234567890123456789012');
    const sessionState = {
      id: testSessionId,
      userId: testUserId,
      familyId: testFamilyId,
      tokenHash: newHash,
      parentTokenHash: oldHash,
      rotatedAt: new Date(Date.now() - 5000), // 5 seconds ago (within 30s grace window)
      expiresAt: new Date(Date.now() + 86400000),
      absoluteExpiresAt: new Date(Date.now() + 86400000),
      lastActivityAt: new Date(),
      lastUsedAt: new Date(),
      rememberMe: true,
      revokedAt: null,
      user: { id: testUserId, email: 'user@example.test', firstName: 'A', lastName: 'B', phone: null, status: 'ACTIVE', deletedAt: null, emailVerifiedAt: new Date(), phoneVerifiedAt: null, passwordSetAt: new Date(), onboardingCompletedAt: null },
    };

    let familyRevoked = false;

    const db = databaseStub({
      authSession: {
        findFirst: (async () => sessionState) as unknown as DatabaseClient['authSession']['findFirst'],
        updateMany: (async (args?: { where?: { familyId?: string } }) => {
          if (args?.where?.familyId) {
            familyRevoked = true;
          }
          return { count: 1 };
        }) as unknown as DatabaseClient['authSession']['updateMany'],
      } as DatabaseClient['authSession'],
      userOnboarding: { findUnique: (async () => null) as unknown as DatabaseClient['userOnboarding']['findUnique'] } as DatabaseClient['userOnboarding'],
      auditLog: { create: (async () => ({})) as unknown as DatabaseClient['auditLog']['create'] } as DatabaseClient['auditLog'],
    });

    app = await buildApp({ env: testEnv, database: db });

    // Multi-tab grace hit (replaying parentTokenHash within 30s) -> 200 OK
    const graceRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { orvio_refresh: rawOldToken },
    });
    expect(graceRes.statusCode).toBe(200);
    expect(familyRevoked).toBe(false);

    // Replay outside grace window (>30s) -> 401 SESSION_REVOKED and entire family revoked
    sessionState.rotatedAt = new Date(Date.now() - 40000); // 40 seconds ago
    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { orvio_refresh: rawOldToken },
    });
    expect(replayRes.statusCode).toBe(401);
    expect(replayRes.json().error.code).toBe('SESSION_REVOKED');
    expect(familyRevoked).toBe(true);
  });

  it('C-3: idle timeout enforcement in authenticateRequest', async () => {
    let revoked = false;
    const db = databaseStub({
      authSession: {
        findFirst: (async () => ({
          id: testSessionId,
          userId: testUserId,
          familyId: testFamilyId,
          rememberMe: false, // transient session (30m idle timeout)
          expiresAt: new Date(Date.now() + 3600000),
          absoluteExpiresAt: new Date(Date.now() + 3600000),
          lastActivityAt: new Date(Date.now() - 35 * 60 * 1000), // 35m inactive
          revokedAt: null,
          user: { id: testUserId, status: 'ACTIVE', deletedAt: null },
        })) as unknown as DatabaseClient['authSession']['findFirst'],
        update: (async () => {
          revoked = true;
          return {};
        }) as unknown as DatabaseClient['authSession']['update'],
      } as DatabaseClient['authSession'],
    });

    app = await buildApp({ env: testEnv, database: db });
    const accessToken = await issueAccessToken({ sub: testUserId, sid: testSessionId }, testEnv.JWT_SECRET);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('SESSION_EXPIRED');
    expect(revoked).toBe(true);
  });

  it('C-4: change-password requires the current password and can revoke all other sessions', async () => {
    const originalHash = await hashPassword('OriginalPassword123!');
    let otherSessionsRevoked = false;
    let passwordUpdated = false;

    const db = databaseStub({
      authSession: {
        findFirst: (async () => ({
          id: testSessionId,
          userId: testUserId,
          familyId: testFamilyId,
          rememberMe: true,
          expiresAt: new Date(Date.now() + 86400000),
          absoluteExpiresAt: new Date(Date.now() + 86400000),
          lastActivityAt: new Date(),
          revokedAt: null,
          user: { id: testUserId, status: 'ACTIVE', deletedAt: null },
        })) as unknown as DatabaseClient['authSession']['findFirst'],
        updateMany: (async (args?: { where?: { id?: { not?: string } } }) => {
          if (args?.where?.id?.not === testSessionId) {
            otherSessionsRevoked = true;
          }
          return { count: 2 };
        }) as unknown as DatabaseClient['authSession']['updateMany'],
      } as DatabaseClient['authSession'],
      user: {
        findUnique: (async () => ({ id: testUserId, status: 'ACTIVE', deletedAt: null })) as unknown as DatabaseClient['user']['findUnique'],
        findUniqueOrThrow: (async () => ({
          id: testUserId,
          email: 'user@example.test',
          firstName: 'Test',
          lastName: 'User',
          passwordHash: originalHash,
          status: 'ACTIVE',
          deletedAt: null,
        })) as unknown as DatabaseClient['user']['findUniqueOrThrow'],
        update: (async () => {
          passwordUpdated = true;
          return {
            id: testUserId,
            email: 'user@example.test',
            firstName: 'Test',
            lastName: 'User',
            phone: null,
            emailVerifiedAt: new Date(),
            phoneVerifiedAt: null,
            passwordSetAt: new Date(),
            onboardingCompletedAt: new Date(),
            status: 'ACTIVE',
            deletedAt: null,
          };
        }) as unknown as DatabaseClient['user']['update'],
      } as DatabaseClient['user'],
      userOnboarding: { findUnique: (async () => null) as unknown as DatabaseClient['userOnboarding']['findUnique'] } as DatabaseClient['userOnboarding'],
      auditLog: { create: (async () => ({})) as unknown as DatabaseClient['auditLog']['create'] } as DatabaseClient['auditLog'],
    });

    app = await buildApp({ env: testEnv, database: db });
    const accessToken = await issueAccessToken({ sub: testUserId, sid: testSessionId }, testEnv.JWT_SECRET);

    // Attempting password change without current password -> 401
    const failRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewStrongPassword123!',
        confirmNewPassword: 'NewStrongPassword123!',
      },
    });
    expect(failRes.statusCode).toBe(401);
    expect(failRes.json().error.code).toBe('INVALID_CREDENTIALS');

    // Attempting with correct current password -> 200 OK + other sessions revoked
    const successRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        currentPassword: 'OriginalPassword123!',
        newPassword: 'NewStrongPassword123!',
        confirmNewPassword: 'NewStrongPassword123!',
        revokeOtherSessions: true,
      },
    });
    expect(successRes.statusCode).toBe(200);
    expect(successRes.json().data).toEqual({ passwordChanged: true, revokedOtherSessions: true });
    expect(passwordUpdated).toBe(true);
    expect(otherSessionsRevoked).toBe(true);
  });

  it('L-5: auto-upgrades legacy password hashes on login', async () => {
    // Generate a legacy hash with lower memoryCost to trigger needsPasswordRehash
    const legacyHash = await argon2.hash('UserPassword123!', {
      type: argon2.argon2id,
      memoryCost: 4096,
      timeCost: 2,
      parallelism: 1,
    });
    let upgradedHash: string | undefined;

    const db = databaseStub({
      user: {
        findUnique: (async () => ({
          id: testUserId,
          email: 'user@example.test',
          firstName: 'Jane',
          lastName: 'Doe',
          passwordHash: legacyHash,
          status: 'ACTIVE',
          deletedAt: null,
          emailVerifiedAt: new Date(),
          phoneVerifiedAt: null,
          passwordSetAt: new Date(),
          onboardingCompletedAt: new Date(),
        })) as unknown as DatabaseClient['user']['findUnique'],
        update: (async (args?: { data?: { passwordHash?: string } }) => {
          upgradedHash = args?.data?.passwordHash;
          return {};
        }) as unknown as DatabaseClient['user']['update'],
      } as DatabaseClient['user'],
      authSession: {
        findFirst: (async () => null) as unknown as DatabaseClient['authSession']['findFirst'],
        create: (async () => ({
          id: testSessionId,
          userId: testUserId,
          familyId: testFamilyId,
          tokenHash: 'hash',
          expiresAt: new Date(Date.now() + 86400000),
          absoluteExpiresAt: new Date(Date.now() + 86400000),
          lastActivityAt: new Date(),
          revokedAt: null,
        })) as unknown as DatabaseClient['authSession']['create'],
      } as DatabaseClient['authSession'],
      userOnboarding: { findUnique: (async () => null) as unknown as DatabaseClient['userOnboarding']['findUnique'] } as DatabaseClient['userOnboarding'],
      auditLog: { create: (async () => ({})) as unknown as DatabaseClient['auditLog']['create'] } as DatabaseClient['auditLog'],
    });

    app = await buildApp({ env: testEnv, database: db, mailer: { sendVerification: async () => {}, sendPasswordReset: async () => {}, sendWelcome: async () => {}, sendNewDeviceLoginNotification: async () => {} } });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'user@example.test',
        password: 'UserPassword123!',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(upgradedHash).toBeDefined();
    expect(upgradedHash).not.toBe(legacyHash);
  });

  it('C-5 & C-4: user.login audit logging, failure reasons, and new device email notification', async () => {
    const password = 'CorrectPassword123!';
    const passwordHash = await hashPassword(password);
    const auditLogs: Array<{ event: string; userId?: string; metadata?: Record<string, string> }> = [];
    let sentNewDeviceAlert: { email: string; details: Record<string, unknown> } | null = null;

    const mockMailer = {
      sendVerification: async () => {},
      sendPasswordReset: async () => {},
      sendWelcome: async () => {},
      sendNewDeviceLoginNotification: async (email: string, details: Record<string, unknown>) => {
        sentNewDeviceAlert = { email, details };
      },
    };

    const db = databaseStub({
      user: {
        findUnique: (async (args?: { where?: { email?: string } }) => {
          if (args?.where?.email === 'active@example.test') {
            return {
              id: testUserId,
              email: 'active@example.test',
              firstName: 'Alice',
              lastName: 'Smith',
              passwordHash,
              status: 'ACTIVE',
              deletedAt: null,
              emailVerifiedAt: new Date(),
              phoneVerifiedAt: null,
              passwordSetAt: new Date(),
              onboardingCompletedAt: new Date(),
            };
          }
          if (args?.where?.email === 'pending@example.test') {
            return {
              id: 'pending-user-id',
              email: 'pending@example.test',
              firstName: 'Bob',
              lastName: 'Jones',
              passwordHash,
              status: 'PENDING',
              deletedAt: null,
            };
          }
          return null;
        }) as unknown as DatabaseClient['user']['findUnique'],
        update: (async () => ({})) as unknown as DatabaseClient['user']['update'],
      } as DatabaseClient['user'],
      authSession: {
        findFirst: (async () => null) as unknown as DatabaseClient['authSession']['findFirst'], // no previous session = new device
        create: (async () => ({
          id: testSessionId,
          userId: testUserId,
          familyId: testFamilyId,
          tokenHash: 'token-hash',
          expiresAt: new Date(Date.now() + 86400000),
          absoluteExpiresAt: new Date(Date.now() + 86400000),
          lastActivityAt: new Date(),
          revokedAt: null,
        })) as unknown as DatabaseClient['authSession']['create'],
      } as DatabaseClient['authSession'],
      userOnboarding: { findUnique: (async () => null) as unknown as DatabaseClient['userOnboarding']['findUnique'] } as DatabaseClient['userOnboarding'],
      auditLog: {
        create: (async (args: { data: { event: string; userId?: string; metadata?: Record<string, string> } }) => {
          auditLogs.push(args.data);
          return {};
        }) as unknown as DatabaseClient['auditLog']['create'],
      } as DatabaseClient['auditLog'],
    });

    app = await buildApp({ env: testEnv, database: db, mailer: mockMailer });

    // 1. Unknown user -> generic 401 + user.login audit (user_not_found)
    const unknownRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'unknown@example.test', password: 'AnyPassword123!' },
    });
    expect(unknownRes.statusCode).toBe(401);
    expect(unknownRes.json().error.message).toBe('Email or password is incorrect.');
    expect(auditLogs.some((l) => l.event === 'user.login' && l.metadata?.failure_reason === 'user_not_found')).toBe(true);

    // 2. Pending email verification user -> generic 401 + user.login audit (email_not_verified)
    const pendingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'pending@example.test', password: 'CorrectPassword123!' },
    });
    expect(pendingRes.statusCode).toBe(401);
    expect(pendingRes.json().error.message).toBe('Email or password is incorrect.');
    expect(auditLogs.some((l) => l.event === 'user.login' && l.metadata?.failure_reason === 'email_not_verified')).toBe(true);

    // 3. Active user with wrong password -> generic 401 + user.login audit (invalid_password)
    const wrongPassRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'active@example.test', password: 'WrongPassword123!' },
    });
    expect(wrongPassRes.statusCode).toBe(401);
    expect(wrongPassRes.json().error.message).toBe('Email or password is incorrect.');
    expect(auditLogs.some((l) => l.event === 'user.login' && l.metadata?.failure_reason === 'invalid_password')).toBe(true);

    // 4. Active user with correct password -> 200 OK + user.login audit (success: true) + new device alert sent
    const successRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'active@example.test', password: 'CorrectPassword123!', rememberMe: true },
      headers: { 'user-agent': 'Vitest Browser' },
    });
    expect(successRes.statusCode).toBe(200);
    expect(successRes.json().data.accessToken).toBeDefined();
    expect(auditLogs.some((l) => l.event === 'user.login' && l.metadata?.success === 'true' && l.metadata?.isNewDevice === 'true')).toBe(true);
    expect(sentNewDeviceAlert).not.toBeNull();
    expect(sentNewDeviceAlert?.email).toBe('active@example.test');
  });

  it('C-5: user.logout and session revocation audit logging', async () => {
    const auditLogs: Array<{ event: string; userId?: string; metadata?: Record<string, string> }> = [];
    let revokedSessionId: string | null = null;

    const db = databaseStub({
      authSession: {
        findFirst: (async (args?: { where?: { id?: string } }) => {
          if (args?.where?.id === testSessionId) {
            return {
              id: testSessionId,
              userId: testUserId,
              familyId: testFamilyId,
              rememberMe: true,
              expiresAt: new Date(Date.now() + 86400000),
              absoluteExpiresAt: new Date(Date.now() + 86400000),
              lastActivityAt: new Date(),
              revokedAt: null,
              user: { id: testUserId, status: 'ACTIVE', deletedAt: null },
            };
          }
          if (args?.where?.id === 'other-session-id') {
            return {
              id: 'other-session-id',
              userId: testUserId,
              familyId: 'other-family-id',
              tokenHash: 'other-hash',
              revokedAt: null,
              expiresAt: new Date(Date.now() + 86400000),
              absoluteExpiresAt: new Date(Date.now() + 86400000),
              lastActivityAt: new Date(),
              rememberMe: true,
            };
          }
          return null;
        }) as unknown as DatabaseClient['authSession']['findFirst'],
        findMany: (async () => [
          {
            id: testSessionId,
            userId: testUserId,
            familyId: testFamilyId,
            createdAt: new Date(),
            lastUsedAt: new Date(),
            expiresAt: new Date(Date.now() + 86400000),
            ip: '127.0.0.1',
            userAgent: 'Vitest',
          },
          {
            id: 'other-session-id',
            userId: testUserId,
            familyId: 'other-family-id',
            createdAt: new Date(),
            lastUsedAt: new Date(),
            expiresAt: new Date(Date.now() + 86400000),
            ip: '192.168.1.1',
            userAgent: 'Mobile',
          },
        ]) as unknown as DatabaseClient['authSession']['findMany'],
        update: (async (args: { where: { id: string } }) => {
          revokedSessionId = args.where.id;
          return {};
        }) as unknown as DatabaseClient['authSession']['update'],
        updateMany: (async (args?: { where?: { id?: string | { not?: string }; userId?: string } }) => {
          if (typeof args?.where?.id === 'string') {
            revokedSessionId = args.where.id;
          }
          return { count: 1 };
        }) as unknown as DatabaseClient['authSession']['updateMany'],
      } as DatabaseClient['authSession'],
      user: {
        findUnique: (async () => ({
          id: testUserId,
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          phone: null,
          emailVerifiedAt: new Date(),
          phoneVerifiedAt: null,
          passwordSetAt: new Date(),
          onboardingCompletedAt: new Date(),
          status: 'ACTIVE',
          deletedAt: null,
        })) as unknown as DatabaseClient['user']['findUnique'],
      } as DatabaseClient['user'],
      userOnboarding: { findUnique: (async () => null) as unknown as DatabaseClient['userOnboarding']['findUnique'] } as DatabaseClient['userOnboarding'],
      auditLog: {
        create: (async (args: { data: { event: string; userId?: string; metadata?: Record<string, string> } }) => {
          auditLogs.push(args.data);
          return {};
        }) as unknown as DatabaseClient['auditLog']['create'],
      } as DatabaseClient['auditLog'],
    });

    app = await buildApp({ env: testEnv, database: db });
    const accessToken = await issueAccessToken({ sub: testUserId, sid: testSessionId }, testEnv.JWT_SECRET);

    // 1. List active sessions
    const sessionsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/sessions',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(sessionsRes.statusCode).toBe(200);
    expect(sessionsRes.json().data.length).toBe(2);
    expect(sessionsRes.json().data[0].current).toBe(true);
    expect(sessionsRes.json().data[1].current).toBe(false);

    // 2. Revoke other specific session -> session.revoked audit log
    const revokeRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/sessions/other-session-id',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(revokeRes.statusCode).toBe(200);
    expect(revokedSessionId).toBe('other-session-id');
    expect(auditLogs.some((l) => l.event === 'session.revoked' && l.metadata?.sessionId === 'other-session-id')).toBe(true);

    // 3. Revoke all other sessions -> session.revoked audit log
    const revokeOthersRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sessions/revoke-others',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(revokeOthersRes.statusCode).toBe(200);
    expect(auditLogs.some((l) => l.event === 'session.revoked' && l.metadata?.reason === 'manual_revoke_others')).toBe(true);

    // 4. Logout -> user.logout audit log
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(logoutRes.statusCode).toBe(200);
    expect(auditLogs.some((l) => l.event === 'user.logout' && l.metadata?.method === 'manual')).toBe(true);
    expect(auditLogs.some((l) => l.event === 'session.revoked' && l.metadata?.reason === 'logout')).toBe(true);
  });
});
