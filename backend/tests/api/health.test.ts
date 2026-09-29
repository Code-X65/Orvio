import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';
import { databaseStub, testEnv } from '../helpers/app.js';

describe('health routes', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('reports liveness and propagates a request ID', async () => {
    app = await buildApp({ env: testEnv, database: databaseStub() });
    const response = await app.inject({ method: 'GET', url: '/health', headers: { 'x-request-id': 'health-test' } });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('health-test');
    expect(response.json()).toEqual({ data: { status: 'ok' }, meta: { requestId: 'health-test' } });
  });

  it('reports readiness when PostgreSQL is available', async () => {
    app = await buildApp({ env: testEnv, database: databaseStub() });
    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('ready');
  });

  it('normalizes a database readiness failure', async () => {
    app = await buildApp({
      env: testEnv,
      database: databaseStub({ $queryRawUnsafe: async () => Promise.reject(new Error('connection refused')) }),
    });
    const response = await app.inject({ method: 'GET', url: '/ready', headers: { 'x-request-id': 'ready-test' } });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: {
        code: 'DEPENDENCY_FAILURE',
        message: 'Database is unavailable.',
        details: null,
        requestId: 'ready-test',
      },
    });
  });

  it('only emits CORS headers for an allowlisted origin', async () => {
    app = await buildApp({ env: testEnv, database: databaseStub() });
    const allowed = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://localhost:5173' } });
    const denied = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://untrusted.example' } });

    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('normalizes unmatched routes', async () => {
    app = await buildApp({ env: testEnv, database: databaseStub() });
    const response = await app.inject({ method: 'GET', url: '/missing', headers: { 'x-request-id': 'missing-test' } });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'RESOURCE_NOT_FOUND', message: 'The requested resource was not found.', details: null, requestId: 'missing-test' },
    });
  });

  it('does not expose the removed workspace onboarding endpoint', async () => {
    app = await buildApp({ env: testEnv, database: databaseStub() });
    const response = await app.inject({ method: 'POST', url: '/api/v1/onboarding/workspace' });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('RESOURCE_NOT_FOUND');
  });
});
