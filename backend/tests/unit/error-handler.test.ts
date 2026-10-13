import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { errorHandler } from '../../src/middleware/error-handler.js';

describe('errorHandler Middleware', () => {
  it('catches Prisma P2024 connection pool timeout and returns 503 DATABASE_UNAVAILABLE', async () => {
    const app = Fastify();
    app.setErrorHandler(errorHandler);

    app.get('/test-pool-timeout', async () => {
      const err = new Error(
        'Invalid `db.user.findUnique()` invocation in /home/kali/Documents/Orvio/backend/src/middleware/auth.ts:40:30 Timed out fetching a new connection from the connection pool. (Current connection pool timeout: 30, connection limit: 5)'
      ) as any;
      err.code = 'P2024';
      err.name = 'PrismaClientKnownRequestError';
      throw err;
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-pool-timeout',
    });

    expect(res.statusCode).toBe(503);
    const json = JSON.parse(res.payload);
    expect(json.status).toBe('error');
    expect(json.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(json.error.message).toBe('Database service is temporarily unavailable. Please try again shortly.');
    // Must NOT leak file paths or raw invocation in user-facing message
    expect(json.error.message).not.toContain('/home/kali');
    expect(json.error.message).not.toContain('findUnique');
  });

  it('catches Prisma P1001 database unreachable error and returns 503 DATABASE_UNAVAILABLE', async () => {
    const app = Fastify();
    app.setErrorHandler(errorHandler);

    app.get('/test-db-unreachable', async () => {
      const err = new Error("Can't reach database server at localhost:5432") as any;
      err.code = 'P1001';
      err.name = 'PrismaClientInitializationError';
      throw err;
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-db-unreachable',
    });

    expect(res.statusCode).toBe(503);
    const json = JSON.parse(res.payload);
    expect(json.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(json.error.message).toBe('Database service is temporarily unavailable. Please try again shortly.');
  });

  it('sanitizes internal stack traces and file paths from unhandled 500 errors', async () => {
    const app = Fastify();
    app.setErrorHandler(errorHandler);

    app.get('/test-raw-stack-trace', async () => {
      const err = new Error(
        'Crash in /home/kali/Documents/Orvio/backend/src/modules/secret.ts:15:2\n    at internalFunction (/home/kali/Orvio/node_modules/foo.js)'
      );
      throw err;
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-raw-stack-trace',
    });

    expect(res.statusCode).toBe(500);
    const json = JSON.parse(res.payload);
    expect(json.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(json.error.message).toBe('An unexpected server error occurred. Please try again later.');
    expect(json.error.message).not.toContain('/home/kali');
    expect(json.error.message).not.toContain('\n');
  });
});
