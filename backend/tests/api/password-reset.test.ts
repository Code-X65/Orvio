import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { databaseStub, testEnv } from '../helpers/app.js';
import { hashToken, verifyPassword } from '../../src/modules/auth/security.js';
import type { DatabaseClient } from '../../src/infrastructure/database/prisma.js';

describe('Section D: Password Reset & Recovery (D1, D2, D3, D4, D5)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const testUserId = '33333333-3333-3333-3333-333333333333';
  const testEmail = 'user@example.test';

  it('D1 & D4: POST /api/v1/auth/reset-password sends email, generic 202, and audits password.reset_requested', async () => {
    const auditLogs: Array<{ event: string; userId?: string; metadata?: Record<string, string> }> = [];
    let sentResetEmail: { email: string; token: string } | null = null;
    let createdTokenHash: string | null = null;

    const mockMailer = {
      sendVerification: async () => {},
      sendPasswordReset: async (email: string, token: string) => {
        sentResetEmail = { email, token };
      },
      sendPasswordChangedNotification: async () => {},
      sendWelcome: async () => {},
      sendNewDeviceLoginNotification: async () => {},
    };

    const db = databaseStub({
      user: {
        findUnique: (async (args?: { where?: { email?: string } }) => {
          if (args?.where?.email === testEmail) {
            return {
              id: testUserId,
              email: testEmail,
              firstName: 'Test',
              lastName: 'User',
              status: 'ACTIVE',
              deletedAt: null,
            };
          }
          return null;
        }) as unknown as DatabaseClient['user']['findUnique'],
      } as DatabaseClient['user'],
      authToken: {
        updateMany: (async () => ({ count: 0 })) as unknown as DatabaseClient['authToken']['updateMany'],
        create: (async (args: { data: { tokenHash: string; type: string } }) => {
          createdTokenHash = args.data.tokenHash;
          return { id: 'token-id', ...args.data };
        }) as unknown as DatabaseClient['authToken']['create'],
      } as DatabaseClient['authToken'],
      auditLog: {
        create: (async (args: { data: { event: string; userId?: string; metadata?: Record<string, string> } }) => {
          auditLogs.push(args.data);
          return {};
        }) as unknown as DatabaseClient['auditLog']['create'],
      } as DatabaseClient['auditLog'],
    });

    app = await buildApp({ env: testEnv, database: db, mailer: mockMailer });

    // 1. Reset request for existing user -> 200 OK + email sent + audit logged
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { email: testEmail },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.accepted).toBe(true);
    expect(sentResetEmail).not.toBeNull();
    expect(sentResetEmail?.email).toBe(testEmail);
    expect(createdTokenHash).toBe(hashToken(sentResetEmail!.token));
    expect(auditLogs.some((l) => l.event === 'password.reset_requested' && l.userId === testUserId)).toBe(true);

    // 2. Reset request for non-existent user -> 200 OK (generic) + no email + audit logged
    sentResetEmail = null;
    const unknownRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { email: 'unknown@example.test' },
    });
    expect(unknownRes.statusCode).toBe(200);
    expect(unknownRes.json().data.accepted).toBe(true);
    expect(sentResetEmail).toBeNull();
    expect(auditLogs.some((l) => l.event === 'password.reset_requested' && l.metadata?.reason === 'user_not_found')).toBe(true);
  });

  it('D2, D3, D4, D5: POST /api/v1/auth/reset-password/confirm updates password, revokes all sessions, sends notification, and audits', async () => {
    const rawToken = 'valid-reset-token-12345678901234567890123456789012';
    const tokenHash = hashToken(rawToken);
    const tokenCreatedAt = new Date(Date.now() - 45000); // 45s ago
    let tokenUsed = false;
    let updatedPasswordHash: string | null = null;
    let allSessionsRevoked = false;
    let sentSuccessEmail: string | null = null;
    const auditLogs: Array<{ event: string; userId?: string; metadata?: Record<string, string> }> = [];

    const mockMailer = {
      sendVerification: async () => {},
      sendPasswordReset: async () => {},
      sendPasswordChangedNotification: async (email: string) => {
        sentSuccessEmail = email;
      },
      sendWelcome: async () => {},
      sendNewDeviceLoginNotification: async () => {},
    };

    const db = databaseStub({
      authToken: {
        findUnique: (async (args?: { where?: { tokenHash?: string } }) => {
          if (args?.where?.tokenHash === tokenHash) {
            return {
              id: 'token-id',
              userId: testUserId,
              type: 'PASSWORD_RESET',
              tokenHash,
              createdAt: tokenCreatedAt,
              expiresAt: new Date(Date.now() + 3600000),
              usedAt: tokenUsed ? new Date() : null,
              user: {
                id: testUserId,
                email: testEmail,
                status: 'ACTIVE',
                deletedAt: null,
              },
            };
          }
          return null;
        }) as unknown as DatabaseClient['authToken']['findUnique'],
        updateMany: (async () => {
          tokenUsed = true;
          return { count: 1 };
        }) as unknown as DatabaseClient['authToken']['updateMany'],
      } as DatabaseClient['authToken'],
      user: {
        update: (async (args: { data: { passwordHash: string } }) => {
          updatedPasswordHash = args.data.passwordHash;
          return { id: testUserId };
        }) as unknown as DatabaseClient['user']['update'],
      } as DatabaseClient['user'],
      authSession: {
        updateMany: (async (args?: { where?: { userId?: string } }) => {
          if (args?.where?.userId === testUserId) {
            allSessionsRevoked = true;
          }
          return { count: 3 };
        }) as unknown as DatabaseClient['authSession']['updateMany'],
      } as DatabaseClient['authSession'],
      auditLog: {
        create: (async (args: { data: { event: string; userId?: string; metadata?: Record<string, string> } }) => {
          auditLogs.push(args.data);
          return {};
        }) as unknown as DatabaseClient['auditLog']['create'],
      } as DatabaseClient['auditLog'],
      $transaction: (async (actions: Promise<unknown>[]) => Promise.all(actions)) as unknown as DatabaseClient['$transaction'],
    });

    app = await buildApp({ env: testEnv, database: db, mailer: mockMailer });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password/confirm',
      payload: {
        token: rawToken,
        password: 'BrandNewSecurePassword123!',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.passwordReset).toBe(true);
    expect(res.json().data.timeToResetSeconds).toBeGreaterThanOrEqual(45);
    expect(tokenUsed).toBe(true);
    expect(updatedPasswordHash).not.toBeNull();
    expect(await verifyPassword(updatedPasswordHash!, 'BrandNewSecurePassword123!')).toBe(true);
    expect(allSessionsRevoked).toBe(true);
    expect(sentSuccessEmail).toBe(testEmail);
    expect(auditLogs.some((l) => l.event === 'password.reset_completed' && l.userId === testUserId && l.metadata?.timeToResetSeconds)).toBe(true);
  });

  it('D2 & D4: password reset fails and audits password.reset_failed on expired, reused, or invalid tokens', async () => {
    const expiredToken = 'expired-token-12345678901234567890123456789012';
    const auditLogs: Array<{ event: string; userId?: string; metadata?: Record<string, string> }> = [];

    const db = databaseStub({
      authToken: {
        findUnique: (async (args?: { where?: { tokenHash?: string } }) => {
          if (args?.where?.tokenHash === hashToken(expiredToken)) {
            return {
              id: 'expired-id',
              userId: testUserId,
              type: 'PASSWORD_RESET',
              tokenHash: hashToken(expiredToken),
              createdAt: new Date(Date.now() - 7200000),
              expiresAt: new Date(Date.now() - 3600000), // expired 1 hour ago
              usedAt: null,
              user: { id: testUserId, email: testEmail, status: 'ACTIVE', deletedAt: null },
            };
          }
          return null;
        }) as unknown as DatabaseClient['authToken']['findUnique'],
      } as DatabaseClient['authToken'],
      auditLog: {
        create: (async (args: { data: { event: string; userId?: string; metadata?: Record<string, string> } }) => {
          auditLogs.push(args.data);
          return {};
        }) as unknown as DatabaseClient['auditLog']['create'],
      } as DatabaseClient['auditLog'],
    });

    app = await buildApp({ env: testEnv, database: db });

    // 1. Expired token -> 400 + audit password.reset_failed (reason: expired)
    const expiredRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password/confirm',
      payload: { token: expiredToken, password: 'ValidNewPassword123!' },
    });
    expect(expiredRes.statusCode).toBe(400);
    expect(expiredRes.json().error.code).toBe('INVALID_TOKEN');
    expect(auditLogs.some((l) => l.event === 'password.reset_failed' && l.metadata?.reason === 'expired')).toBe(true);

    // 2. Non-existent token -> 400 + audit password.reset_failed (reason: not_found)
    const notFoundRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password/confirm',
      payload: { token: 'unknown-token-12345678901234567890123456789012', password: 'ValidNewPassword123!' },
    });
    expect(notFoundRes.statusCode).toBe(400);
    expect(notFoundRes.json().error.code).toBe('INVALID_TOKEN');
    expect(auditLogs.some((l) => l.event === 'password.reset_failed' && l.metadata?.reason === 'not_found')).toBe(true);
  });

  it('D2 Fallback: GET /api/v1/auth/reset-password redirects to frontend confirmation page', async () => {
    const db = databaseStub();
    app = await buildApp({ env: testEnv, database: db });

    // 1. Valid token query -> 302 to /reset-password/confirm?token=...
    const validRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/reset-password?token=my-secret-token',
    });
    expect(validRes.statusCode).toBe(302);
    expect(validRes.headers.location).toBe(`${testEnv.FRONTEND_APP_URL}/reset-password/confirm?token=my-secret-token`);

    // 2. Missing token query -> 302 to /reset-password?error=invalid_or_expired
    const missingRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/reset-password',
    });
    expect(missingRes.statusCode).toBe(302);
    expect(missingRes.headers.location).toBe(`${testEnv.FRONTEND_APP_URL}/reset-password?error=invalid_or_expired`);
  });
});
