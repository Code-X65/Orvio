import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../src/app.js';
import { databaseStub, testEnv } from '../helpers/app.js';

describe('test-only E2E delivery capture', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('is absent outside E2E mode and requires the configured run secret in E2E mode', async () => {
    app = await buildApp({ env: testEnv, database: databaseStub() });
    expect((await app.inject({ method: 'GET', url: '/api/v1/test/delivery' })).statusCode).toBe(404);
    await app.close();

    app = await buildApp({
      env: { ...testEnv, E2E_TEST_MODE: true, E2E_CAPTURE_SECRET: 'e2e-capture-secret-that-is-longer-than-32-characters' },
      database: databaseStub(),
    });
    expect((await app.inject({ method: 'GET', url: '/api/v1/test/delivery' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/v1/test/delivery', headers: { 'x-e2e-capture-secret': 'e2e-capture-secret-that-is-longer-than-32-characters' } })).statusCode).toBe(404);
  });
});
