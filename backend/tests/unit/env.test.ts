import { describe, expect, it } from 'vitest';

import { parseEnvironment } from '../../src/config/env.js';

describe('parseEnvironment', () => {
  it('rejects an invalid database URL', () => {
    expect(() => parseEnvironment({ DATABASE_URL: 'not-a-url', CORS_ORIGINS: 'http://localhost:5173', JWT_SECRET: 'test-secret-that-is-longer-than-32-characters', FRONTEND_APP_URL: 'http://localhost:5173', BREVO_API_KEY: 'test-key', BREVO_SENDER_EMAIL: 'no-reply@example.test' })).toThrow();
  });

  it('parses and trims configured CORS origins', () => {
    const env = parseEnvironment({
      DATABASE_URL: 'postgresql://orvio:orvio@localhost:5432/orvio',
      CORS_ORIGINS: 'http://localhost:5173, https://app.orvio.test ',
      JWT_SECRET: 'test-secret-that-is-longer-than-32-characters',
      FRONTEND_APP_URL: 'http://localhost:5173',
      BREVO_API_KEY: 'test-key',
      BREVO_SENDER_EMAIL: 'no-reply@example.test',
    });

    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'https://app.orvio.test']);
    expect(env.RATE_LIMIT_MAX).toBe(100);
    expect(env.AUDIT_LOG_RETENTION_DAYS).toBe(1825);
  });

  it('requires HTTPS URLs in production', () => {
    expect(() => parseEnvironment({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://orvio:orvio@localhost:5432/orvio',
      CORS_ORIGINS: 'http://localhost:5173',
      TRUST_PROXY_HOPS: '1',
      JWT_SECRET: 'test-secret-that-is-longer-than-32-characters',
      FRONTEND_APP_URL: 'http://localhost:5173',
      PUBLIC_API_URL: 'https://api.orvio.test',
      BREVO_API_KEY: 'test-key',
      BREVO_SENDER_EMAIL: 'no-reply@example.test',
    })).toThrow('must use HTTPS');
  });
});
