import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Inventory Onboarding & Branch Setup (Integration Tests)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it(
    'checks onboarding status, saves draft progress, and completes branch setup with business type and branch code',
    async () => {
    const timestamp = Date.now();
    const email = `inv_owner_${timestamp}@example.com`;
    const password = 'Password123!';
    const subdomain = `invorg${timestamp.toString().slice(-6)}`;

    // 1. Register owner & verify
    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password,
        fullName: 'Inventory Lead',
        organizationName: 'Inv Apex Retail',
        subdomain,
        termsAccepted: true,
      },
    });
    expect(regRes.statusCode).toBe(201);

    const emailSent = ctx.emailSender.findVerificationEmail(email);
    expect(emailSent).toBeDefined();

    const verifyRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: emailSent!.token },
    });
    expect(verifyRes.statusCode).toBe(200);

    const ownerToken = verifyRes.json().data.accessToken;

    // 2. Initial status check should show completed: false
    const initialStatusRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/onboarding/status',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(initialStatusRes.statusCode).toBe(200);
    const initialData = initialStatusRes.json().data;
    expect(initialData.completed).toBe(false);
    expect(initialData.status).toBe('pending');
    expect(initialData.organization.subdomain).toBe(subdomain);

    // 3. Save draft progress (e.g. at step 2)
    const draftRes = await ctx.app.inject({
      method: 'PUT',
      url: '/api/v1/inventory/onboarding/draft',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        currentStep: 2,
        stepData: {
          businessType: 'retail_supermarket',
          branchName: 'Apex Ikeja Hub',
          branchCode: 'HQ',
        },
      },
    });
    expect(draftRes.statusCode).toBe(200);

    // Verify draft is returned on status check
    const draftStatusRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/onboarding/status',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(draftStatusRes.statusCode).toBe(200);
    const draftStatusData = draftStatusRes.json().data;
    expect(draftStatusData.stepData).toMatchObject({
      currentStep: 2,
      businessType: 'retail_supermarket',
      branchCode: 'HQ',
    });

    // 4. Complete Setup
    const setupRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/onboarding/setup',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        businessType: 'retail_supermarket',
        branchName: 'Ikeja Flagship Store',
        branchCode: 'HQ',
        useOrgEmail: true,
        useOrgPhone: true,
        address: {
          country: 'Nigeria',
          state: 'Lagos',
          city: 'Ikeja',
          lga: 'Ikeja',
          area: 'Allen Avenue',
          streetAddress: '15 Allen Avenue',
        },
        currency: 'NGN',
      },
    });

    expect(setupRes.statusCode).toBe(201);
    const setupData = setupRes.json().data;
    expect(setupData.success).toBe(true);
    expect(setupData.branch.name).toBe('Ikeja Flagship Store');
    expect(setupData.branch.code).toBe('HQ');
    expect(setupData.onboarding.status).toBe('completed');

    // 5. Subsequent status check returns completed: true with branch details
    const finalStatusRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/onboarding/status',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(finalStatusRes.statusCode).toBe(200);
    const finalData = finalStatusRes.json().data;
    expect(finalData.completed).toBe(true);
    expect(finalData.status).toBe('completed');
    expect(finalData.branch.name).toBe('Ikeja Flagship Store');
    expect(finalData.branch.code).toBe('HQ');
  }, 60000);
});
