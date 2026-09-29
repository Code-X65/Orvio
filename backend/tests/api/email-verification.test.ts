import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { databaseStub, testEnv } from '../helpers/app.js';
import { hashToken } from '../../src/modules/auth/security.js';
import type { DatabaseClient } from '../../src/infrastructure/database/prisma.js';
import type { AuthMailSender } from '../../src/modules/auth/mail.js';

describe('Section B: Email Verification (B1, B2, B3, B4)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const testUserId = '11111111-1111-1111-1111-111111111111';
  const testSessionId = '22222222-2222-2222-2222-222222222222';
  const rawToken = 'a'.repeat(64);
  const tokenHash = hashToken(rawToken);

  it('B1, B2, B3: confirms email with valid token, sends welcome email, and audits email.verified', async () => {
    const auditLogs: Array<{ event: string; metadata?: Record<string, string> }> = [];
    let welcomeEmailSent = false;
    let userActivated = false;

    const mockMailer: AuthMailSender = {
      sendVerification: async () => undefined,
      sendPasswordReset: async () => undefined,
      sendPasswordChangedNotification: async () => undefined,
      sendWelcome: async (email, firstName) => {
        if (email === 'user@example.com' && firstName === 'John') {
          welcomeEmailSent = true;
        }
      },
    };

    const db = databaseStub({
      authToken: {
        findUnique: (async (args: { where: { tokenHash: string } }) => {
          if (args.where.tokenHash === tokenHash) {
            return {
              id: 'token-1',
              tokenHash,
              type: 'EMAIL_VERIFICATION',
              userId: testUserId,
              expiresAt: new Date(Date.now() + 3600000),
              usedAt: null,
              user: {
                id: testUserId,
                email: 'user@example.com',
                firstName: 'John',
                lastName: 'Doe',
                phone: null,
                createdAt: new Date(Date.now() - 120000), // 2 mins ago
                status: 'PENDING',
                deletedAt: null,
                emailVerifiedAt: null,
                phoneVerifiedAt: null,
                passwordSetAt: new Date(),
                onboardingCompletedAt: null,
              },
            };
          }
          return null;
        }) as unknown as DatabaseClient['authToken']['findUnique'],
        updateMany: (async () => ({ count: 1 })) as unknown as DatabaseClient['authToken']['updateMany'],
      } as DatabaseClient['authToken'],
      user: {
        update: (async () => {
          userActivated = true;
          return { id: testUserId, status: 'ACTIVE' };
        }) as unknown as DatabaseClient['user']['update'],
        findUniqueOrThrow: (async () => ({
          id: testUserId,
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: null,
          createdAt: new Date(Date.now() - 120000),
          status: 'ACTIVE',
          deletedAt: null,
          emailVerifiedAt: new Date(),
          phoneVerifiedAt: null,
          passwordSetAt: new Date(),
          onboardingCompletedAt: null,
        })) as unknown as DatabaseClient['user']['findUniqueOrThrow'],
      } as DatabaseClient['user'],
      userOnboarding: {
        upsert: (async () => ({
          userId: testUserId,
          stage: 'PHONE_VERIFICATION',
        })) as unknown as DatabaseClient['userOnboarding']['upsert'],
        findUnique: (async () => ({
          userId: testUserId,
          stage: 'PHONE_VERIFICATION',
        })) as unknown as DatabaseClient['userOnboarding']['findUnique'],
      } as DatabaseClient['userOnboarding'],
      authSession: {
        create: (async () => ({
          id: testSessionId,
          userId: testUserId,
        })) as unknown as DatabaseClient['authSession']['create'],
      } as DatabaseClient['authSession'],
      $transaction: (async (actions: Promise<unknown>[]) => Promise.all(actions)) as unknown as DatabaseClient['$transaction'],
      auditLog: {
        create: (async (args: { data: { event: string; metadata?: Record<string, string> } }) => {
          auditLogs.push(args.data);
          return { id: 'audit-1' };
        }) as unknown as DatabaseClient['auditLog']['create'],
      } as DatabaseClient['auditLog'],
    });

    app = await buildApp({ env: testEnv, database: db, mailer: mockMailer });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email/confirm',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: rawToken }),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.user.emailVerified).toBe(true);
    expect(body.data.timeToVerifySeconds).toBeGreaterThanOrEqual(100);
    expect(userActivated).toBe(true);
    expect(welcomeEmailSent).toBe(true);

    const verifiedAudit = auditLogs.find((a) => a.event === 'email.verified');
    expect(verifiedAudit).toBeDefined();
    expect(verifiedAudit?.metadata?.email).toBe('user@example.com');
  });

  it('B1, B3: fails with 400 and audits email.verification_failed on expired token', async () => {
    const auditLogs: Array<{ event: string; metadata?: Record<string, string> }> = [];

    const db = databaseStub({
      authToken: {
        findUnique: (async () => ({
          id: 'token-1',
          tokenHash,
          type: 'EMAIL_VERIFICATION',
          userId: testUserId,
          expiresAt: new Date(Date.now() - 60000), // Expired 1 min ago
          usedAt: null,
        })) as unknown as DatabaseClient['authToken']['findUnique'],
      } as DatabaseClient['authToken'],
      auditLog: {
        create: (async (args: { data: { event: string; metadata?: Record<string, string> } }) => {
          auditLogs.push(args.data);
          return { id: 'audit-1' };
        }) as unknown as DatabaseClient['auditLog']['create'],
      } as DatabaseClient['auditLog'],
    });

    app = await buildApp({ env: testEnv, database: db });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email/confirm',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: rawToken }),
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_TOKEN');
    expect(body.error.message).toContain('expired');

    const failedAudit = auditLogs.find((a) => a.event === 'email.verification_failed');
    expect(failedAudit).toBeDefined();
    expect(failedAudit?.metadata?.reason).toBe('expired');
  });

  it('B1: fallback GET /api/v1/auth/verify-email redirects to frontend on valid or invalid tokens', async () => {
    const db = databaseStub({
      authToken: {
        findUnique: (async (args: { where: { tokenHash: string } }) => {
          if (args.where.tokenHash === tokenHash) {
            return {
              id: 'token-1',
              tokenHash,
              type: 'EMAIL_VERIFICATION',
              userId: testUserId,
              expiresAt: new Date(Date.now() + 3600000),
              usedAt: null,
              user: {
                id: testUserId,
                email: 'user@example.com',
                firstName: 'John',
                createdAt: new Date(),
                status: 'PENDING',
              },
            };
          }
          return null;
        }) as unknown as DatabaseClient['authToken']['findUnique'],
        updateMany: (async () => ({ count: 1 })) as unknown as DatabaseClient['authToken']['updateMany'],
      } as DatabaseClient['authToken'],
      user: {
        update: (async () => ({ id: testUserId, status: 'ACTIVE' })) as unknown as DatabaseClient['user']['update'],
        findUniqueOrThrow: (async () => ({
          id: testUserId,
          email: 'user@example.com',
          firstName: 'John',
          status: 'ACTIVE',
        })) as unknown as DatabaseClient['user']['findUniqueOrThrow'],
      } as DatabaseClient['user'],
      userOnboarding: { upsert: (async () => ({})) as unknown as DatabaseClient['userOnboarding']['upsert'] } as DatabaseClient['userOnboarding'],
      authSession: { create: (async () => ({ id: testSessionId })) as unknown as DatabaseClient['authSession']['create'] } as DatabaseClient['authSession'],
      $transaction: (async (actions: Promise<unknown>[]) => Promise.all(actions)) as unknown as DatabaseClient['$transaction'],
      auditLog: { create: (async () => ({ id: '1' })) as unknown as DatabaseClient['auditLog']['create'] } as DatabaseClient['auditLog'],
    });

    app = await buildApp({ env: testEnv, database: db });

    // Valid token -> redirect to /app?verified=1 with cookie
    const validRes = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/verify-email?token=${rawToken}`,
    });
    expect(validRes.statusCode).toBe(302);
    expect(validRes.headers.location).toContain('/app?verified=1');
    expect(validRes.headers['set-cookie']).toBeDefined();

    // Invalid token -> redirect to /verify-email?error=invalid_or_expired
    const invalidRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/verify-email?token=invalid-token',
    });
    expect(invalidRes.statusCode).toBe(302);
    expect(invalidRes.headers.location).toContain('/verify-email?error=invalid_or_expired');
  });

  it('B1, B3: resend verification link triggers email and audits email.verification_sent', async () => {
    const auditLogs: Array<{ event: string; metadata?: Record<string, string> }> = [];
    let emailSent = false;

    const mockMailer: AuthMailSender = {
      sendVerification: async (email) => {
        if (email === 'pending@example.com') emailSent = true;
      },
      sendPasswordReset: async () => undefined,
      sendPasswordChangedNotification: async () => undefined,
      sendWelcome: async () => undefined,
    };

    const db = databaseStub({
      user: {
        findUnique: (async (args: { where: { email?: string } }) => {
          if (args.where.email === 'pending@example.com') {
            return {
              id: testUserId,
              email: 'pending@example.com',
              status: 'PENDING',
              deletedAt: null,
            };
          }
          return null;
        }) as unknown as DatabaseClient['user']['findUnique'],
      } as DatabaseClient['user'],
      authToken: {
        updateMany: (async () => ({ count: 1 })) as unknown as DatabaseClient['authToken']['updateMany'],
        create: (async () => ({ id: 'token-new' })) as unknown as DatabaseClient['authToken']['create'],
      } as DatabaseClient['authToken'],
      auditLog: {
        create: (async (args: { data: { event: string; metadata?: Record<string, string> } }) => {
          auditLogs.push(args.data);
          return { id: 'audit-1' };
        }) as unknown as DatabaseClient['auditLog']['create'],
      } as DatabaseClient['auditLog'],
    });

    app = await buildApp({ env: testEnv, database: db, mailer: mockMailer });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email/resend',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'pending@example.com' }),
    });

    expect(response.statusCode).toBe(200);
    expect(emailSent).toBe(true);

    const resentAudit = auditLogs.find((a) => a.event === 'email.verification_sent');
    expect(resentAudit).toBeDefined();
    expect(resentAudit?.metadata?.email).toBe('pending@example.com');
  });
});
