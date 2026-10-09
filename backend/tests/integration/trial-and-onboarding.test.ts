import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Start Free Trial & Organization Onboarding Integration Tests', () => {
  let ctx: TestAppContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('provisions Free Trial with Gym and Inventory, validates tri-factor uniqueness and unverified initial state', async () => {
    const timestamp = Date.now();
    const email = `trial_${timestamp}@fashben.com`;
    const phone = `+23480${String(timestamp).slice(-8)}`;
    const subdomain = `fashben${timestamp}`.slice(0, 20);

    const payload = {
      selectedApps: ['gym', 'inventory'],
      primaryApp: 'gym',
      organizationName: `Fashben Fitness ${timestamp}`,
      subdomain,
      fullName: 'Fash Ben',
      email,
      phone,
      password: 'StrongPassword123!',
      termsAccepted: true,
    };

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/trial',
      payload,
    });

    if (response.statusCode !== 201) {
      console.error('Trial Creation Error Response:', response.json());
    }

    expect(response.statusCode).toBe(201);
    const json = response.json();
    expect(json.status).toBe('success');
    expect(json.data.user.email).toBe(email);
    expect(json.data.user.phone).toBe(phone);
    expect(json.data.user.emailVerifiedAt).toBeNull(); // Must be unverified initially
    expect(json.data.organization.subdomain).toBe(subdomain);
    expect(json.data.organization.planCode).toBe('trial');
    expect(json.data.redirectUrl).toContain(`${subdomain}`);
    expect(json.data.redirectUrl).toContain('/orvio');

    // 1. Duplicate Subdomain Check
    const dupSubdomainResp = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/trial',
      payload: {
        ...payload,
        email: `other_${timestamp}@fashben.com`,
        phone: `+23481${String(timestamp).slice(-8)}`,
      },
    });
    expect(dupSubdomainResp.statusCode).toBe(409);
    expect(dupSubdomainResp.json().error.code).toBe('SUBDOMAIN_TAKEN');

    // 2. Duplicate Email Check
    const dupEmailResp = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/trial',
      payload: {
        ...payload,
        subdomain: `diff${timestamp}`.slice(0, 20),
        phone: `+23481${String(timestamp).slice(-8)}`,
      },
    });
    expect(dupEmailResp.statusCode).toBe(409);
    expect(dupEmailResp.json().error.code).toBe('DUPLICATE_EMAIL');

    // 3. Duplicate Phone Check
    const dupPhoneResp = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/trial',
      payload: {
        ...payload,
        email: `unique_${timestamp}@fashben.com`,
        subdomain: `diff2${timestamp}`.slice(0, 20),
      },
    });
    expect(dupPhoneResp.statusCode).toBe(409);
    expect(dupPhoneResp.json().error.code).toBe('DUPLICATE_PHONE');
  }, 60000);

  it(
    'runs through the 6-step organization onboarding flow and complete flow',
    async () => {
    const timestamp = Date.now();
    const email = `onboarding_${timestamp}@example.com`;
    const password = 'StrongPassword123!';
    const subdomain = `oborg${timestamp}`.slice(0, 20);

    // Register user first via standard register
    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        fullName: 'Onboarding Lead',
        email,
        password,
        phone: `+23470${String(timestamp).slice(-8)}`,
        organizationName: `Apex Supermarket ${timestamp}`,
        subdomain,
        termsAccepted: true,
      },
    });
    expect(regRes.statusCode).toBe(201);

    // Login to get access token
    // First simulate email verification in DB
    await ctx.prisma.user.update({
      where: { email },
      data: { email_verified_at: new Date() },
    });

    const loginRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);
    const token = loginRes.json().data.accessToken;

    // 1. GET /api/v1/onboarding/organization
    const getFlowRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/onboarding/organization',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getFlowRes.statusCode).toBe(200);
    expect(getFlowRes.json().data.catalog.length).toBeGreaterThan(0);

    // 2. PUT Step 1: organization_basics
    const step1Res = await ctx.app.inject({
      method: 'PUT',
      url: '/api/v1/onboarding/organization/steps/organization_basics',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        organizationName: `Apex Supermarket ${timestamp}`,
        businessType: 'Retail & Supermarket',
        description: 'Leading retail store in Lagos',
      },
    });
    expect(step1Res.statusCode).toBe(200);

    // 3. PUT Step 2: business_details
    const step2Res = await ctx.app.inject({
      method: 'PUT',
      url: '/api/v1/onboarding/organization/steps/business_details',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        country: 'NG',
        currency: 'NGN',
        timezone: 'Africa/Lagos',
        phone: '+2348099887766',
        businessEmail: 'contact@apexsupermarket.ng',
      },
    });
    expect(step2Res.statusCode).toBe(200);

    // 4. PUT Step 3: application_selection
    const step3Res = await ctx.app.inject({
      method: 'PUT',
      url: '/api/v1/onboarding/organization/steps/application_selection',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        selectedProductKeys: ['inventory', 'gym'],
        primaryProductKey: 'inventory',
      },
    });
    expect(step3Res.statusCode).toBe(200);

    // 5. PUT Step 4: primary_branch (Nigerian address)
    const step4Res = await ctx.app.inject({
      method: 'PUT',
      url: '/api/v1/onboarding/organization/steps/primary_branch',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Apex Supermarket Ikeja Flagship',
        type: 'store',
        address: {
          country: 'NG',
          state: 'Lagos',
          lga: 'Ikeja',
          area: 'Allen Avenue',
          streetAddress: '12 Allen Avenue',
        },
        phone: '+2348099887766',
      },
    });
    expect(step4Res.statusCode).toBe(200);

    // 6. PUT Step 5: team_invites (skipped)
    const step5Res = await ctx.app.inject({
      method: 'PUT',
      url: '/api/v1/onboarding/organization/steps/team_invites',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        skipped: true,
        invites: [],
      },
    });
    expect(step5Res.statusCode).toBe(200);

    // 7. POST complete
    const completeRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/organization/complete',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.json().data.success).toBe(true);
  }, 60000);
});

