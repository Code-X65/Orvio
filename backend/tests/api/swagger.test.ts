import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

const app = buildApp();

afterAll(async () => {
  await app.close();
});

describe('Swagger Documentation Endpoints', () => {
  it('serves Swagger UI at /docs', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/docs/',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('swagger');
  });

  it('serves OpenAPI specification JSON with all routes and schemas at /docs/json', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/docs/json',
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.openapi).toBeDefined();
    expect(json.info.title).toBe('Orvio Hub API');
    expect(json.paths['/api/v1/auth/register']).toBeDefined();
    expect(json.paths['/api/v1/auth/verify-email']).toBeDefined();
    expect(json.paths['/api/v1/auth/verify-email/resend']).toBeDefined();
    expect(json.paths['/api/v1/auth/login']).toBeDefined();
    expect(json.paths['/api/v1/auth/refresh']).toBeDefined();
    expect(json.paths['/api/v1/orgs/check-subdomain']).toBeDefined();
    expect(json.paths['/api/v1/orgs/me']).toBeDefined();
  });
});
