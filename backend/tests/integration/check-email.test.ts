import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('GET & POST /api/v1/auth/check-email (Email Availability)', () => {
  let ctx: TestAppContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('returns available: true for unregistered email', async () => {
    const email = `unique_${Date.now()}@example.com`;
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/auth/check-email?email=${encodeURIComponent(email)}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.available).toBe(true);
  });

  it('returns available: false for registered email (case-insensitive)', async () => {
    const timestamp = Date.now();
    const email = `taken_${timestamp}@example.com`;
    const subdomain = `takenorg${timestamp.toString().slice(-6)}`;

    // Register account
    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'Password123!',
        fullName: 'Taken User',
        organizationName: 'Taken Org',
        subdomain,
      },
    });

    // Check availability with uppercase variant
    const checkRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/check-email',
      payload: {
        email: email.toUpperCase(),
      },
    });

    expect(checkRes.statusCode).toBe(200);
    expect(checkRes.json().data.available).toBe(false);
  });
});
