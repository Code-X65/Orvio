import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Inventory Category Management (Integration Tests)', () => {
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
      'user-agent': 'CategoryIntegrationTestAgent/1.0',
    };
  }

  async function registerAndVerifyTenant(orgPrefix: string) {
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
        organizationName: `${orgPrefix} Org`,
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

    return {
      token: verifyRes.json().data.accessToken as string,
      org: verifyRes.json().data.organization,
      user: verifyRes.json().data.user,
    };
  }

  it('auto-seeds default categories upon onboarding setup completion', async () => {
    const tenant = await registerAndVerifyTenant('catseed');

    // Complete setup with businessType = retail_supermarket
    const setupRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/onboarding/setup',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: {
        businessType: 'retail_supermarket',
        businessDescription: 'Supermarket and grocery store',
        branchName: 'Main Store',
        branchCode: 'STR01',
        useOrgEmail: true,
        useOrgPhone: true,
        address: {
          country: 'Nigeria',
          state: 'Lagos',
          city: 'Ikeja',
          streetAddress: '10 Allen Avenue',
        },
        currency: 'NGN',
      },
    });
    expect(setupRes.statusCode).toBe(201);

    // Fetch categories tree
    const listRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    expect(listRes.statusCode).toBe(200);

    const categories = listRes.json().data.categories;
    expect(categories.length).toBeGreaterThanOrEqual(7);
    const names = categories.map((c: { name: string }) => c.name);
    expect(names).toContain('Groceries');
    expect(names).toContain('Beverages');
    expect(names).toContain('Household Supplies');
  });

  it('creates categories with auto-slug and suffix deduplication', async () => {
    const tenant = await registerAndVerifyTenant('catslug');

    // Create first category
    const createRes1 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: {
        name: 'Organic Fruits & Veggies',
        description: 'Fresh farm produce',
      },
    });
    expect(createRes1.statusCode).toBe(201);
    const cat1 = createRes1.json().data.category;
    expect(cat1.slug).toBe('organic-fruits-veggies');

    // Create duplicate name in same org
    const createRes2 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: {
        name: 'Organic Fruits & Veggies',
        description: 'Another batch',
      },
    });
    expect(createRes2.statusCode).toBe(201);
    const cat2 = createRes2.json().data.category;
    expect(cat2.slug).toBe('organic-fruits-veggies-2');
  });

  it('creates hierarchical child categories and retrieves full tree', async () => {
    const tenant = await registerAndVerifyTenant('catnest');

    // Create Root
    const rootRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: { name: 'Electronics' },
    });
    expect(rootRes.statusCode).toBe(201);
    const rootId = rootRes.json().data.category.id;

    // Create Child
    const childRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: {
        name: 'Smartphones',
        parentId: rootId,
      },
    });
    expect(childRes.statusCode).toBe(201);
    const childId = childRes.json().data.category.id;

    // Create Grandchild
    const grandChildRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: {
        name: 'Accessories & Cases',
        parentId: childId,
      },
    });
    expect(grandChildRes.statusCode).toBe(201);

    // Get Tree
    const treeRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    expect(treeRes.statusCode).toBe(200);
    const tree = treeRes.json().data.categories;
    const root = tree.find((c: { id: string }) => c.id === rootId);
    expect(root).toBeDefined();
    expect(root.children).toHaveLength(1);
    expect(root.children[0].id).toBe(childId);
    expect(root.children[0].children).toHaveLength(1);
    expect(root.children[0].children[0].name).toBe('Accessories & Cases');

    // Get single category by ID
    const singleRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/categories/${childId}`,
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    expect(singleRes.statusCode).toBe(200);
    const singleData = singleRes.json().data.category;
    expect(singleData.children_count).toBe(1);
    expect(singleData.full_path).toBe('Electronics > Smartphones');
  });

  it('prevents self-reference and circular hierarchy', async () => {
    const tenant = await registerAndVerifyTenant('catcirc');

    // Create Parent and Child
    const parentRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: { name: 'Hardware' },
    });
    const parentId = parentRes.json().data.category.id;

    const childRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: { name: 'Tools', parentId },
    });
    const childId = childRes.json().data.category.id;

    // Self-reference test
    const selfRefRes = await ctx.app.inject({
      method: 'PUT',
      url: `/api/v1/inventory/categories/${parentId}`,
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: { parentId },
    });
    expect(selfRefRes.statusCode).toBe(400);
    expect(selfRefRes.json().error.code).toBe('INVALID_CATEGORY_HIERARCHY');

    // Circular reference test: set parentId of parent to childId
    const circRes = await ctx.app.inject({
      method: 'PUT',
      url: `/api/v1/inventory/categories/${parentId}`,
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: { parentId: childId },
    });
    expect(circRes.statusCode).toBe(400);
    expect(circRes.json().error.code).toBe('INVALID_CATEGORY_HIERARCHY');
  });

  it('keeps slug stable when category name is updated', async () => {
    const tenant = await registerAndVerifyTenant('catupd');

    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: { name: 'Apparel & Outfits' },
    });
    const cat = createRes.json().data.category;
    const initialSlug = cat.slug;
    expect(initialSlug).toBe('apparel-outfits');

    const updateRes = await ctx.app.inject({
      method: 'PUT',
      url: `/api/v1/inventory/categories/${cat.id}`,
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: {
        name: 'Luxury Apparel & Clothing',
        description: 'Updated description',
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updatedCat = updateRes.json().data.category;
    expect(updatedCat.name).toBe('Luxury Apparel & Clothing');
    expect(updatedCat.slug).toBe(initialSlug); // Stable slug
    expect(updatedCat.description).toBe('Updated description');
  });

  it('blocks deletion of a category that has children, then succeeds when child is removed', async () => {
    const tenant = await registerAndVerifyTenant('catdel');

    const parentRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: { name: 'Footwear' },
    });
    const parentId = parentRes.json().data.category.id;

    const childRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: { name: 'Sneakers', parentId },
    });
    const childId = childRes.json().data.category.id;

    // Attempt deleting parent while child exists
    const blockedDelete = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/categories/${parentId}`,
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    expect(blockedDelete.statusCode).toBe(400);
    expect(blockedDelete.json().error.code).toBe('CANNOT_DELETE_PARENT_CATEGORY');

    // Delete child first
    const deleteChild = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/categories/${childId}`,
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    expect(deleteChild.statusCode).toBe(200);

    // Delete parent now succeeds
    const deleteParent = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/categories/${parentId}`,
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    expect(deleteParent.statusCode).toBe(200);
  });

  it('reorders sibling categories and toggles active status', async () => {
    const tenant = await registerAndVerifyTenant('catreorder');

    const c1 = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/inventory/categories',
        headers: { authorization: `Bearer ${tenant.token}` },
        payload: { name: 'Item A' },
      })
    ).json().data.category.id;

    const c2 = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/inventory/categories',
        headers: { authorization: `Bearer ${tenant.token}` },
        payload: { name: 'Item B' },
      })
    ).json().data.category.id;

    const c3 = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/inventory/categories',
        headers: { authorization: `Bearer ${tenant.token}` },
        payload: { name: 'Item C' },
      })
    ).json().data.category.id;

    // Reorder: C, A, B
    const reorderRes = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/v1/inventory/categories/reorder',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: {
        categoryIds: [c3, c1, c2],
      },
    });
    expect(reorderRes.statusCode).toBe(200);

    const treeRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    const order = treeRes.json().data.categories.map((c: { id: string }) => c.id);
    expect(order).toEqual([c3, c1, c2]);

    // Toggle status of c1 to inactive
    const toggleRes = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v1/inventory/categories/${c1}/toggle-status`,
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    expect(toggleRes.statusCode).toBe(200);
    expect(toggleRes.json().data.category.is_active).toBe(false);

    // Default GET activeOnly=true should hide c1
    const activeTreeRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    const activeIds = activeTreeRes.json().data.categories.map((c: { id: string }) => c.id);
    expect(activeIds).toContain(c3);
    expect(activeIds).toContain(c2);
    expect(activeIds).not.toContain(c1);
  });

  it('enforces tenant organization isolation', async () => {
    const tenantA = await registerAndVerifyTenant('tenantA');
    const tenantB = await registerAndVerifyTenant('tenantB');

    // Create category in Tenant A
    const catA = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/inventory/categories',
        headers: { authorization: `Bearer ${tenantA.token}` },
        payload: { name: 'Tenant A Secret Category' },
      })
    ).json().data.category;

    // Tenant B tries to get Tenant A's category -> 404
    const resB = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/categories/${catA.id}`,
      headers: { authorization: `Bearer ${tenantB.token}` },
    });
    expect(resB.statusCode).toBe(404);

    // Tenant B's category tree does not contain Tenant A's category
    const treeB = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenantB.token}` },
    });
    const bCatNames = treeB.json().data.categories.map((c: { name: string }) => c.name);
    expect(bCatNames).not.toContain('Tenant A Secret Category');
  });

  it('seeds default categories on demand via POST /seed', async () => {
    const tenant = await registerAndVerifyTenant('catondemand');

    const seedRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories/seed',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: { businessType: 'fashion_boutique' },
    });
    expect(seedRes.statusCode).toBe(201);
    expect(seedRes.json().data.count).toBeGreaterThanOrEqual(5);

    const treeRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    const names = treeRes.json().data.categories.map((c: { name: string }) => c.name);
    expect(names).toContain("Women's Clothing");
    expect(names).toContain("Men's Clothing");
    expect(names).toContain('Footwear');
  });
});
