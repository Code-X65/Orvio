import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

const app = buildApp();

afterAll(async () => {
  await app.close();
});

describe('Organization & Auth API', () => {
  describe('GET /api/v1/orgs/check-subdomain and /api/v1/organizations/check-subdomain', () => {
    it('returns available: false and reason: RESERVED for reserved names', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/orgs/check-subdomain?subdomain=admin',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.status).toBe('success');
      expect(json.data.available).toBe(false);
      expect(json.data.reason).toBe('RESERVED');
      expect(json.data.suggestions).toBeDefined();
    });

    it('checks reserved subdomain on canonical /api/v1/orgs endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/orgs/check-subdomain?subdomain=app',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.available).toBe(false);
    });

    it('returns available: false and reason: TOO_SHORT for < 3 characters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/orgs/check-subdomain?subdomain=ab',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.status).toBe('success');
      expect(json.data.available).toBe(false);
      expect(json.data.reason).toBe('TOO_SHORT');
    });

    it('returns available: true for a unique random subdomain', async () => {
      const randomSubdomain = `testsub${Math.floor(100000 + Math.random() * 900000)}`;
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/orgs/check-subdomain?subdomain=${randomSubdomain}`,
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.status).toBe('success');
      expect(json.data.available).toBe(true);
      expect(json.data.subdomain).toBe(randomSubdomain);
    });
  });

  describe('POST /api/v1/auth/register validation', () => {
    it('rejects registration with missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'invalid-email',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.status).toBe('error');
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects registration with weak password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'valid@example.com',
          password: 'weak',
          fullName: 'Test User',
          organizationName: 'Test Org',
          subdomain: 'testorg123',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.status).toBe('error');
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
