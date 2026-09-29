import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createDatabaseClient } from '../../src/infrastructure/database/prisma.js';
import { testEnv } from '../helpers/app.js';

const runContainerTests = process.env.RUN_TESTCONTAINERS === 'true';

describe.skipIf(!runContainerTests)('PostgreSQL readiness', () => {
  let container: { getConnectionUri(): string; stop(): Promise<void> };

  beforeAll(async () => {
    const { PostgreSqlContainer } = await import('testcontainers');
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
  });

  afterAll(async () => {
    await container?.stop();
  });

  it('uses a real PostgreSQL connection for readiness', async () => {
    const database = createDatabaseClient(container.getConnectionUri());
    const app = await buildApp({ env: { ...testEnv, DATABASE_URL: container.getConnectionUri() }, database });

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    await app.close();
  });
});
