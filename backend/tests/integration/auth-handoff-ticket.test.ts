import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';
import { defaultAppCache } from '../../src/infrastructure/cache/in-memory-cache.js';

describe('Auth Single-Use Handoff Ticket (RFC 9700 §2.1.3 Compliance)', () => {
  let ctx: TestAppContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('rejects unauthenticated requests to POST /auth/handoff-ticket with 401', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/handoff-ticket',
    });
    expect(res.statusCode).toBe(401);
  });

  it('generates a 30s single-use handoff ticket for authenticated users', async () => {
    const timestamp = Date.now();
    const email = `handoff_user_${timestamp}@example.com`;
    const password = 'Password123!';
    const subdomain = `handoff${timestamp.toString().slice(-6)}`;

    // 1. Register & verify user to get accessToken
    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password,
        fullName: 'Handoff User',
        organizationName: 'Handoff Org',
        subdomain,
        termsAccepted: true,
      },
    });

    const verifyEmailSent = ctx.emailSender.findVerificationEmail(email);
    const verifyRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: verifyEmailSent!.token },
    });
    const accessToken = verifyRes.json().data.accessToken;

    // 2. Request handoff ticket
    const ticketRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/handoff-ticket',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(ticketRes.statusCode).toBe(201);
    const ticketData = ticketRes.json().data;
    expect(ticketData.ticket).toBeDefined();
    expect(ticketData.ticket).toMatch(/^ht_/);
    expect(ticketData.expiresIn).toBe(30);

    // Verify ticket is stored in cache
    const cached = defaultAppCache.get(`handoff_ticket:${ticketData.ticket}`);
    expect(cached).toBeDefined();
    expect(cached?.userId).toBeDefined();
  });

  it('exchanges handoff ticket for new session credentials and sets HttpOnly cookie', async () => {
    const timestamp = Date.now();
    const email = `exchange_user_${timestamp}@example.com`;
    const password = 'Password123!';
    const subdomain = `exchange${timestamp.toString().slice(-6)}`;

    // 1. Register & verify user
    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password,
        fullName: 'Exchange User',
        organizationName: 'Exchange Org',
        subdomain,
        termsAccepted: true,
      },
    });

    const verifyEmailSent = ctx.emailSender.findVerificationEmail(email);
    const verifyRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: verifyEmailSent!.token },
    });
    const accessToken = verifyRes.json().data.accessToken;

    // 2. Request handoff ticket
    const ticketRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/handoff-ticket',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const ticket = ticketRes.json().data.ticket;

    // 3. Exchange ticket
    const exchangeRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/exchange-ticket',
      payload: { ticket },
    });

    expect(exchangeRes.statusCode).toBe(200);
    const exchangeData = exchangeRes.json().data;
    expect(exchangeData.accessToken).toBeDefined();
    expect(exchangeData.user.email).toBe(email);
    expect(exchangeData.organization.subdomain).toBe(subdomain);

    // Refresh token cookie is set and HttpOnly
    const cookie = exchangeRes.cookies.find((c) => c.name === 'refreshToken');
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);

    // 4. Single-use enforcement: Attempting to replay/exchange the same ticket fails
    const replayRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/exchange-ticket',
      payload: { ticket },
    });
    expect(replayRes.statusCode).toBe(401);
    expect(replayRes.json().error.code).toBe('INVALID_HANDOFF_TICKET');
  });

  it('rejects invalid or non-existent tickets with 401 INVALID_HANDOFF_TICKET', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/exchange-ticket',
      payload: { ticket: 'ht_nonexistent_random_ticket_123456789' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_HANDOFF_TICKET');
  });

  it('rejects malformed payloads with 400 VALIDATION_ERROR', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/exchange-ticket',
      payload: { ticket: 'short' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});
