import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('POST /api/v1/auth/register (Conflict & Race Condition Handling)', () => {
  let ctx: TestAppContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('returns 409 RESOURCE_CONFLICT and suggestions when subdomain is already taken', async () => {
    const timestamp = Date.now();
    const existingSubdomain = `taken${timestamp}`.slice(0, 20);

    // First user claims subdomain
    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        fullName: 'First Owner',
        email: `first_${timestamp}@example.com`,
        password: 'Password123!',
        organizationName: 'Taken Corp',
        subdomain: existingSubdomain,
        planCode: 'inventory',
      },
    });

    // Second user attempts same subdomain with different email
    const duplicateResponse = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        fullName: 'Second Owner',
        email: `second_${timestamp}@example.com`,
        password: 'Password123!',
        organizationName: 'Taken Corp',
        subdomain: existingSubdomain,
        planCode: 'inventory',
      },
    });

    expect(duplicateResponse.statusCode).toBe(409);
    const json = duplicateResponse.json();
    expect(json.error.code).toBe('SUBDOMAIN_TAKEN');
    expect(json.error.message).toContain('already taken');
    expect(json.error.details.suggestions).toBeDefined();
    expect(Array.isArray(json.error.details.suggestions)).toBe(true);
    expect(json.error.details.suggestions.length).toBeGreaterThan(0);
  });

  it('returns 409 DUPLICATE_RESOURCE when email address is already registered', async () => {
    const timestamp = Date.now();
    const existingEmail = `dup_${timestamp}@example.com`;

    // First registration
    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        fullName: 'First Owner',
        email: existingEmail,
        password: 'Password123!',
        organizationName: 'Org One',
        subdomain: `orgone${timestamp}`.slice(0, 20),
      },
    });

    // Second registration with same email but different subdomain
    const duplicateResponse = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        fullName: 'Duplicate Owner',
        email: existingEmail,
        password: 'Password123!',
        organizationName: 'Org Two',
        subdomain: `orgtwo${timestamp}`.slice(0, 20),
      },
    });

    expect(duplicateResponse.statusCode).toBe(409);
    const json = duplicateResponse.json();
    expect(json.error.code).toBe('DUPLICATE_RESOURCE');
    expect(json.error.message).toContain('email');
  });

  it('handles concurrent identical registration requests by allowing exactly one 201 and one 409', async () => {
    const timestamp = Date.now();
    const concurrentEmail = `race_${timestamp}@example.com`;
    const concurrentSubdomain = `race${timestamp}`.slice(0, 20);

    const payload = {
      fullName: 'Race Tester',
      email: concurrentEmail,
      password: 'Password123!',
      organizationName: 'Race Corp',
      subdomain: concurrentSubdomain,
    };

    const [res1, res2] = await Promise.all([
      ctx.app.inject({ method: 'POST', url: '/api/v1/auth/register', payload }),
      ctx.app.inject({ method: 'POST', url: '/api/v1/auth/register', payload }),
    ]);

    const statusCodes = [res1.statusCode, res2.statusCode].sort();
    expect(statusCodes).toEqual([201, 409]);
  });
});
