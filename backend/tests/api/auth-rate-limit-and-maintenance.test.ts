import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { databaseStub, testEnv } from '../helpers/app.js';
import { hashPassword } from '../../src/modules/auth/security.js';
import type { DatabaseClient } from '../../src/infrastructure/database/prisma.js';
import { cleanupExpiredAuthData, startAuthMaintenanceScheduler } from '../../src/modules/auth/maintenance.js';

describe('auth rate limiting (H-1) and maintenance cleanup (M-4)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const testUserId = '11111111-1111-1111-1111-111111111111';

  it('H-1: enforces rate limiting on login when maximum attempts are reached', async () => {
    const buckets = new Map<string, number>();

    const db = databaseStub({
      rateLimitBucket: {
        upsert: (async (args: { where: { action_subjectHash_windowStart: { action: string; subjectHash: string } } }) => {
          const key = `${args.where.action_subjectHash_windowStart.action}:${args.where.action_subjectHash_windowStart.subjectHash}`;
          const current = (buckets.get(key) ?? 0) + 1;
          buckets.set(key, current);
          return { count: current };
        }) as unknown as DatabaseClient['rateLimitBucket']['upsert'],
      } as DatabaseClient['rateLimitBucket'],
      user: {
        findUnique: (async () => ({
          id: testUserId,
          email: 'rate-limited@example.test',
          firstName: 'Jane',
          lastName: 'Doe',
          passwordHash: await hashPassword('CorrectPassword123!'),
          status: 'ACTIVE',
          deletedAt: null,
          emailVerifiedAt: new Date(),
          phoneVerifiedAt: null,
          passwordSetAt: new Date(),
          onboardingCompletedAt: new Date(),
        })) as unknown as DatabaseClient['user']['findUnique'],
      } as DatabaseClient['user'],
      auditLog: { create: (async () => ({})) as unknown as DatabaseClient['auditLog']['create'] } as DatabaseClient['auditLog'],
      authSession: {
        create: (async () => ({
          id: 'session-id',
          userId: testUserId,
          tokenHash: 'hash',
          expiresAt: new Date(),
        })) as unknown as DatabaseClient['authSession']['create'],
      } as DatabaseClient['authSession'],
      userOnboarding: { findUnique: (async () => null) as unknown as DatabaseClient['userOnboarding']['findUnique'] } as DatabaseClient['userOnboarding'],
    });

    const envWithTightRateLimit = {
      ...testEnv,
      AUTH_RATE_LIMIT_LOGIN_MAX: 3,
      AUTH_RATE_LIMIT_LOGIN_WINDOW_MS: 900_000,
    };

    app = await buildApp({ env: envWithTightRateLimit, database: db });

    // 3 attempts within limits
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'rate-limited@example.test',
          password: 'WrongPassword123!',
        },
      });
      expect(res.statusCode).toBe(401);
    }

    // 4th attempt should be blocked by rate limiter
    const blockedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'rate-limited@example.test',
        password: 'CorrectPassword123!',
      },
    });

    expect(blockedRes.statusCode).toBe(429);
    const body = blockedRes.json();
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(blockedRes.headers['retry-after']).toBeDefined();
  }, 15_000);

  it('requires the shared strong-password policy for registration and reset completion', async () => {
    app = await buildApp({ env: testEnv, database: databaseStub() });

    const registration = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Jane', lastName: 'Doe', email: 'jane@example.test',
        password: 'Short1!', passwordConfirmation: 'Short1!',
        acceptTerms: true, acceptPrivacy: true,
      },
    });
    const reset = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password/confirm',
      payload: { token: 'a'.repeat(32), password: 'Short1!' },
    });

    expect(registration.statusCode).toBe(400);
    expect(reset.statusCode).toBe(400);
  });

  it('M-4: cleanupExpiredAuthData purges expired sessions, stale buckets, and old audit logs', async () => {
    let deletedSessionsWhere: unknown = null;
    let deletedBucketsWhere: unknown = null;
    let purgeRetentionDays: unknown = null;

    const db = databaseStub({
      authSession: {
        deleteMany: (async (args: { where: unknown }) => {
          deletedSessionsWhere = args.where;
          return { count: 12 };
        }) as unknown as DatabaseClient['authSession']['deleteMany'],
      } as DatabaseClient['authSession'],
      rateLimitBucket: {
        deleteMany: (async (args: { where: unknown }) => {
          deletedBucketsWhere = args.where;
          return { count: 85 };
        }) as unknown as DatabaseClient['rateLimitBucket']['deleteMany'],
      } as DatabaseClient['rateLimitBucket'],
      $queryRawUnsafe: (async (_query: string, retentionDays: number) => {
        purgeRetentionDays = retentionDays;
        return [{ deleted_count: 144 }];
      }) as DatabaseClient['$queryRawUnsafe'],
    });

    const result = await cleanupExpiredAuthData(db, {
      sessionRetentionDays: 14,
      auditRetentionDays: 1825,
    });

    expect(result.deletedSessions).toBe(12);
    expect(result.deletedRateLimitBuckets).toBe(85);
    expect(result.deletedAuditLogs).toBe(144);
    expect(deletedSessionsWhere).toBeDefined();
    expect(deletedBucketsWhere).toBeDefined();
    expect(purgeRetentionDays).toBe(1825);
  });

  it('M-4: startAuthMaintenanceScheduler initializes and stops cleanly', () => {
    const db = databaseStub();
    const scheduler = startAuthMaintenanceScheduler(db, {
      intervalMs: 10_000,
    });
    expect(typeof scheduler.stop).toBe('function');
    scheduler.stop();
  });
});
