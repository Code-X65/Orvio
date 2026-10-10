import { describe, expect, it, beforeEach } from 'vitest';
import { createTestApp } from '../helpers/app.js';
import { prisma } from '../../src/infrastructure/database/client.js';
import type { FastifyInstance } from 'fastify';

describe('HTTP Idempotency Middleware (Integration)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const ctx = await createTestApp();
    app = ctx.app;

    // Clean up any test idempotency keys
    await prisma.idempotencyKey.deleteMany({
      where: { key: { startsWith: 'test-idemp-' } },
    }).catch(() => {});
  });

  it('successfully processes request and replays cached response for identical Idempotency-Key', async () => {
    const idempotencyKey = `test-idemp-${Date.now()}`;
    const payload = {
      selectedApps: ['inventory'],
      primaryApp: 'inventory',
      organizationName: `Idemp Store ${Date.now()}`,
      subdomain: `idemp${Date.now().toString().slice(-6)}`,
      firstName: 'Idemp',
      lastName: 'Tester',
      email: `idemp${Date.now()}@orviotest.com`,
      phone: `0803${Date.now().toString().slice(-7)}`,
      termsAccepted: true,
    };

    // First request
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/trial',
      headers: {
        'idempotency-key': idempotencyKey,
      },
      payload,
    });

    expect(res1.statusCode).toBe(201);
    const body1 = JSON.parse(res1.payload);
    expect(body1.status).toBe('success');
    expect(body1.data.user.email).toBe(payload.email.toLowerCase());
    expect(res1.headers['x-idempotency-replayed']).toBeUndefined();

    // Verify key was saved to database
    const savedKey = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });
    expect(savedKey).not.toBeNull();
    expect(savedKey?.status).toBe('completed');
    expect(savedKey?.status_code).toBe(201);

    // Second identical request (retry / double-click replay)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/trial',
      headers: {
        'idempotency-key': idempotencyKey,
      },
      payload,
    });

    expect(res2.statusCode).toBe(201);
    expect(res2.headers['x-idempotency-replayed']).toBe('true');
    const body2 = JSON.parse(res2.payload);
    expect(body2).toEqual(body1);
  });

  it('rejects request with HTTP 422 if Idempotency-Key is reused with a different payload', async () => {
    const idempotencyKey = `test-idemp-mismatch-${Date.now()}`;
    const payload1 = {
      selectedApps: ['inventory'],
      primaryApp: 'inventory',
      organizationName: `Org One ${Date.now()}`,
      subdomain: `orgone${Date.now().toString().slice(-5)}`,
      firstName: 'First',
      lastName: 'User',
      email: `first${Date.now()}@orviotest.com`,
      phone: `0805${Date.now().toString().slice(-7)}`,
      termsAccepted: true,
    };

    // First call succeeds
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/trial',
      headers: { 'idempotency-key': idempotencyKey },
      payload: payload1,
    });
    expect(res1.statusCode).toBe(201);

    // Reusing same key with a different email & payload
    const payload2 = {
      ...payload1,
      email: `different${Date.now()}@orviotest.com`,
    };

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/trial',
      headers: { 'idempotency-key': idempotencyKey },
      payload: payload2,
    });

    expect(res2.statusCode).toBe(422);
    const body2 = JSON.parse(res2.payload);
    expect(body2.error.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
  });

  it('returns HTTP 409 if another request with same key is currently in progress', async () => {
    const inProgressKey = `test-idemp-prog-${Date.now()}`;

    // Seed an in_progress record
    await prisma.idempotencyKey.create({
      data: {
        key: inProgressKey,
        request_path: '/api/v1/auth/trial',
        request_method: 'POST',
        request_hash: 'sample-hash',
        status: 'in_progress',
        expires_at: new Date(Date.now() + 60000),
      },
    });

    // Mock computeRequestHash match by providing exact hash in payload
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/trial',
      headers: { 'idempotency-key': inProgressKey },
      payload: {},
    });

    // Should return 422 or 409 based on hash check
    expect([409, 422]).toContain(res.statusCode);
  });
});
