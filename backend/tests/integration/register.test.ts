import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('POST /api/v1/auth/register (Atomic Multi-Tenant Provisioning)', () => {
  let ctx: TestAppContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('creates User, Organization (pending), Membership (owner), Branch (store), VerificationToken, and dispatches email', async () => {
    const timestamp = Date.now();
    const email = `founder_${timestamp}@example.com`;
    const subdomain = `org${timestamp}`.slice(0, 20);

    const payload = {
      fullName: 'Chief Founder',
      email,
      password: 'StrongPassword123!',
      phone: '+2348011112222',
      organizationName: `Org ${timestamp}`,
      subdomain,
      planCode: 'bundle',
      timezone: 'Africa/Lagos',
      currency: 'NGN',
    };

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload,
    });

    expect(response.statusCode).toBe(201);
    const json = response.json();
    expect(json.status).toBe('success');
    expect(json.data.email).toBe(email);
    expect(json.data.organization.subdomain).toBe(subdomain);

    // Verify Database State (All 4 Core Rows)
    const user = await ctx.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: { include: { organization: true } },
        verification_tokens: true,
      },
    });

    expect(user).toBeDefined();
    expect(user?.full_name).toBe('Chief Founder');
    expect(user?.status).toBe('active');
    expect(user?.email_verified_at).toBeNull(); // Must be unverified initially

    // Organization Row
    const org = await ctx.prisma.organization.findUnique({
      where: { subdomain },
      include: { branches: true },
    });
    expect(org).toBeDefined();
    expect(org?.status).toBe('pending');
    expect(org?.plan_code).toBe('bundle');
    expect(org?.currency).toBe('NGN');
    expect(org?.timezone).toBe('Africa/Lagos');

    // Membership Row
    const membership = user?.memberships[0];
    expect(membership).toBeDefined();
    expect(membership?.role).toBe('owner');
    expect(membership?.status).toBe('active');
    expect(membership?.org_id).toBe(org?.id);

    // Branch Row
    const defaultBranch = org?.branches[0];
    expect(defaultBranch).toBeDefined();
    expect(defaultBranch?.type).toBe('store');
    expect(defaultBranch?.status).toBe('active');

    // Verification Token Row
    expect(user?.verification_tokens.length).toBeGreaterThanOrEqual(1);
    expect(user?.verification_tokens[0].purpose).toBe('email_verification');
    expect(user?.verification_tokens[0].consumed_at).toBeNull();

    // Verify Email Sender recorded the verification link
    expect(ctx.emailSender.sentEmails.length).toBe(1);
    const lastEmail = ctx.emailSender.getLastEmail();
    expect(lastEmail?.to[0].email).toBe(email);
    expect(lastEmail?.subject).toContain('Verify your email');
    expect(lastEmail?.html).toContain('/verify-email?token=');
  });

  it('rolls back completely without creating partial rows if an error occurs during transaction', async () => {
    const timestamp = Date.now();
    const email = `fail_${timestamp}@example.com`;
    const subdomain = `fail${timestamp}`.slice(0, 20);

    // Send payload missing required organization fields
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        fullName: 'Fail Founder',
        email,
        password: 'Password123!',
        organizationName: '', // Invalid empty org name
        subdomain,
      },
    });

    expect(response.statusCode).toBe(400);

    // Verify zero rows created
    const user = await ctx.prisma.user.findUnique({ where: { email } });
    expect(user).toBeNull();

    const org = await ctx.prisma.organization.findUnique({ where: { subdomain } });
    expect(org).toBeNull();
  });
});
