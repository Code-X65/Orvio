import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Inventory Brand Management (Integration Tests)', { timeout: 60000 }, () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  function generateHeaders() {
    const randomIp = `10.0.${Math.floor(1 + Math.random() * 250)}.${Math.floor(1 + Math.random() * 250)}`;
    return {
      'x-forwarded-for': randomIp,
      'user-agent': 'BrandIntegrationTestAgent/1.0',
    };
  }

  async function registerAndSetupTenant(orgPrefix: string) {
    const timestamp = Date.now() + Math.floor(Math.random() * 10000);
    const email = `${orgPrefix}_${timestamp}@example.com`;
    const password = 'Password123!';
    const subdomain = `${orgPrefix}${timestamp.toString().slice(-6)}`;
    const headers = generateHeaders();

    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers,
      payload: {
        email,
        password,
        fullName: `${orgPrefix} Manager`,
        organizationName: `${orgPrefix} Store`,
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
    const token = verifyRes.json().data.accessToken as string;

    // Complete onboarding setup
    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/onboarding/setup',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        branchName: `${orgPrefix} Main Branch`,
        branchType: 'store',
        currency: 'USD',
        categories: ['Beverages', 'Snacks'],
      },
    });

    return { token };
  }

  it('creates, lists, updates, and soft-deletes a brand', async () => {
    const { token } = await registerAndSetupTenant('brandtest');

    // 1. Create a brand
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/brands',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Apple Inc',
        description: 'Consumer electronics manufacturer',
        websiteUrl: 'https://apple.com',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createdBrand = createRes.json().data.brand;
    expect(createdBrand.name).toBe('Apple Inc');
    expect(createdBrand.slug).toBe('apple-inc');

    // 2. Slug deduplication
    const dupRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/brands',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Apple Inc',
      },
    });
    expect(dupRes.statusCode).toBe(201);
    expect(dupRes.json().data.brand.slug).toBe('apple-inc-2');

    // 3. List brands
    const listRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/brands',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().data.brands.length).toBeGreaterThanOrEqual(2);

    // 4. Update brand
    const updateRes = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v1/inventory/brands/${createdBrand.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        description: 'Updated description',
        isActive: true,
      },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().data.brand.description).toBe('Updated description');

    // 5. Soft-delete brand
    const deleteRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/brands/${createdBrand.id}?reason=Archiving`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deleteRes.statusCode).toBe(200);

    // Verify it is excluded from active list
    const listAfterDelete = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/brands',
      headers: { authorization: `Bearer ${token}` },
    });
    const found = listAfterDelete.json().data.brands.find((b: any) => b.id === createdBrand.id);
    expect(found).toBeUndefined();

    // 6. Restore brand
    const restoreRes = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v1/inventory/brands/${createdBrand.id}/restore`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(restoreRes.statusCode).toBe(200);
    expect(restoreRes.json().data.brand.is_deleted).toBe(false);
  });
});
