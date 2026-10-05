import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('GET /api/v1/orgs/check-subdomain (Availability & Reserved Keywords)', () => {
  let ctx: TestAppContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('returns available: true for unique valid subdomain', async () => {
    const timestamp = Date.now();
    const uniqueSubdomain = `valid${timestamp}`.slice(0, 20);

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/orgs/check-subdomain?subdomain=${uniqueSubdomain}`,
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('success');
    expect(json.data.available).toBe(true);
    expect(json.data.subdomain).toBe(uniqueSubdomain);
  });

  it('returns available: false and RESERVED for platform keywords', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/orgs/check-subdomain?subdomain=admin',
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.data.available).toBe(false);
    expect(json.data.reason).toBe('RESERVED');
  });

  it('returns available: false and ALREADY_TAKEN with suggestions for claimed subdomain', async () => {
    const timestamp = Date.now();
    const taken = `takenorg${timestamp}`.slice(0, 20);

    await ctx.prisma.organization.create({
      data: {
        name: 'Claimed Org',
        subdomain: taken,
        status: 'active',
      },
    });

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/orgs/check-subdomain?subdomain=${taken}`,
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.data.available).toBe(false);
    expect(json.data.reason).toBe('ALREADY_TAKEN');
    expect(Array.isArray(json.data.suggestions)).toBe(true);
    expect(json.data.suggestions.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/orgs/public/:subdomain returns exists: true for existing organization and exists: false for unregistered', async () => {
    const timestamp = Date.now();
    const existingSub = `exists${timestamp}`.slice(0, 20);

    await ctx.prisma.organization.create({
      data: {
        name: 'Existing Fitness Hub',
        subdomain: existingSub,
        status: 'active',
      },
    });

    // 1. Existing subdomain
    const resFound = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/orgs/public/${existingSub}`,
    });
    expect(resFound.statusCode).toBe(200);
    const jsonFound = resFound.json();
    expect(jsonFound.data.exists).toBe(true);
    expect(jsonFound.data.name).toBe('Existing Fitness Hub');
    expect(jsonFound.data.subdomain).toBe(existingSub);

    // 2. Unregistered / missing subdomain
    const resMissing = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/orgs/public/unregistered-nonexistent-subdomain`,
    });
    expect(resMissing.statusCode).toBe(200);
    const jsonMissing = resMissing.json();
    expect(jsonMissing.data.exists).toBe(false);
  });
});
