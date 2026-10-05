import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Rate Limiting on /api/v1/auth/register', () => {
  let ctx: TestAppContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('enforces rate limits on registration endpoint after exceeding quota', async () => {
    const responses: number[] = [];

    // Make 6 attempts from same IP (limit is 5/hour)
    for (let i = 0; i < 6; i++) {
      const timestamp = Date.now() + i;
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          fullName: 'Spam Tester',
          email: `spam_${i}_${timestamp}@example.com`,
          password: 'Password123!',
          organizationName: `Spam Org ${i}`,
          subdomain: `spam${i}${timestamp}`.slice(0, 20),
        },
      });
      responses.push(res.statusCode);
    }

    // After 5 allowed requests, the 6th must return 429 Too Many Requests
    expect(responses[responses.length - 1]).toBe(429);
  }, 30000);
});
