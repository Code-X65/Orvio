import type { AppEnv } from '../../src/config/env.js';
import type { DatabaseClient } from '../../src/infrastructure/database/prisma.js';

export const testEnv: AppEnv = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 3000,
  DATABASE_URL: 'postgresql://orvio:orvio@localhost:5432/orvio?schema=public',
  CORS_ORIGINS: ['http://localhost:5173'],
  RATE_LIMIT_MAX: 100,
  RATE_LIMIT_WINDOW_MS: 60_000,
  TRUST_PROXY_HOPS: 0,
  LOG_LEVEL: 'silent',
  JWT_SECRET: 'test-secret-that-is-longer-than-32-characters',
  FRONTEND_APP_URL: 'http://localhost:5173',
  BREVO_API_KEY: 'test-brevo-key',
  BREVO_SENDER_EMAIL: 'no-reply@example.test',
  BREVO_SENDER_NAME: 'Orvio Test',
  PUBLIC_API_URL: 'http://localhost:3000',
  ORVIO_ROOT_DOMAIN: 'orvio.test',
  FACEBOOK_GRAPH_API_URL: 'https://graph.facebook.com',
  TERMII_BASE_URL: 'https://api.ng.termii.com',
};

export function databaseStub(overrides: Partial<DatabaseClient> = {}): DatabaseClient {
  return {
    $queryRawUnsafe: async () => ({ value: 1 }),
    $disconnect: async () => undefined,
    rateLimitBucket: {
      upsert: async () => ({ count: 1 }),
      deleteMany: async () => ({ count: 0 }),
    },
    organizationMembership: {
      findMany: async () => [{ organizationId: '11111111-1111-4111-8111-111111111111', organization: { id: '11111111-1111-4111-8111-111111111111', name: 'Test organization', slug: 'test-org', defaultApp: 'INVENTORY', entitlements: [{ app: 'INVENTORY', enabled: true, expiresAt: null }] } }],
    },
    ...overrides,
  } as unknown as DatabaseClient;
}
