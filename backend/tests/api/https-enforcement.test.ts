import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../src/app.js';
import { databaseStub, testEnv } from '../helpers/app.js';

describe('production HTTPS enforcement', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('rejects insecure requests and accepts HTTPS forwarded by the trusted proxy', async () => {
    app = await buildApp({
      env: {
        ...testEnv,
        NODE_ENV: 'production',
        TRUST_PROXY_HOPS: 1,
        COOKIE_SECURE: true,
        FRONTEND_APP_URL: 'https://app.orvio.test',
        PUBLIC_API_URL: 'https://api.orvio.test',
        CORS_ORIGINS: ['https://app.orvio.test'],
      },
      database: databaseStub(),
    });

    const insecure = await app.inject({ method: 'GET', url: '/health' });
    expect(insecure.statusCode).toBe(400);
    expect(insecure.json().error.code).toBe('HTTPS_REQUIRED');

    const secure = await app.inject({ method: 'GET', url: '/health', headers: { 'x-forwarded-proto': 'https' } });
    expect(secure.statusCode).toBe(200);
  });
});
