import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../src/app.js';
import { databaseStub, testEnv } from '../helpers/app.js';

describe('OpenAPI documentation', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('exposes the generated specification for documented infrastructure endpoints', async () => {
    app = await buildApp({ env: testEnv, database: databaseStub() });
    const response = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(response.statusCode).toBe(200);
    const specification = response.json();
    expect(specification.info.title).toBe('Orvio API');
    expect(specification.paths['/health'].get.summary).toBe('Check service liveness');
    expect(specification.paths['/ready'].get.responses['503']).toBeDefined();
    expect(specification.paths['/api/v1/auth/login'].post.summary).toBe('Sign in with email and password');
    expect(specification.paths['/api/v1/auth/change-password'].post.summary).toBe('Change an existing local password');
    expect(specification.paths['/api/v1/auth/change-password'].post.security).toEqual([{ bearerAuth: [] }]);
    expect(specification.paths['/api/v1/auth/register'].post.requestBody.content['application/json'].schema.properties.password.minLength).toBe(12);
    expect(specification.paths['/api/v1/auth/reset-password/confirm'].post.requestBody.content['application/json'].schema.properties.password.minLength).toBe(12);
    expect(specification.paths['/api/v1/auth/oauth/{provider}/callback'].get.responses['302']).toBeDefined();
    expect(specification.paths['/api/v1/onboarding/workspace']).toBeUndefined();
    expect(specification.paths['/api/v1/onboarding/survey/status'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(specification.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });
});
