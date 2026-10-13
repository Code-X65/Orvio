import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Inventory Catalog & Multi-Branch Import (Integration Tests)', { timeout: 120000 }, () => {
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
      'user-agent': 'CatalogIntegrationTestAgent/1.0',
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
    const setupRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/onboarding/setup',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        businessType: 'retail_supermarket',
        businessDescription: 'Retail Supermarket Hub',
        branchName: `${orgPrefix} Main Branch`,
        branchCode: 'HQ',
        useOrgEmail: true,
        useOrgPhone: true,
        address: {
          country: 'Nigeria',
          state: 'Lagos',
          city: 'Ikeja',
          streetAddress: '15 Commercial Way',
        },
        currency: 'USD',
      },
    });
    expect(setupRes.statusCode).toBe(201);

    const branchesRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/branches',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(branchesRes.statusCode).toBe(200);
    const branch1Id = branchesRes.json().data.branches[0].id;

    return { token, branch1Id };
  }

  it('assigns product, imports catalog between branches, and logs audit', async () => {
    const { token, branch1Id } = await registerAndSetupTenant('catalogtest');

    // 1. Create a brand
    const brandRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/brands',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Nike' },
    });
    const brandId = brandRes.json().data.brand.id;

    // 2. Create a product in Branch 1 with brand
    const prodRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Air Jordan 1',
        brandId,
        costPrice: 80,
        sellingPrice: 150,
        initialStock: 25,
        branchId: branch1Id,
        trackQuantity: true,
      },
    });
    expect(prodRes.statusCode).toBe(201);
    const productId = prodRes.json().data.product.id;

    // 3. Create a second branch
    const b2Res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/branches',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Branch Two',
        type: 'warehouse',
      },
    });
    expect(b2Res.statusCode).toBe(201);
    const branch2Id = b2Res.json().data.branch.id;

    // 4. Verify Branch 2 currently has 0 products
    const b2CatalogBefore = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/catalog/branches/${branch2Id}/products`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(b2CatalogBefore.statusCode).toBe(200);
    expect(b2CatalogBefore.json().data.items.length).toBe(0);

    // 5. Import catalog from Branch 1 to Branch 2 with copyStock = true
    const importRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/catalog/branches/${branch2Id}/import`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        sourceBranchId: branch1Id,
        productIds: [productId],
        copyStock: true,
        notes: 'Initial seed from main branch',
      },
    });
    expect(importRes.statusCode).toBe(201);
    expect(importRes.json().data.importedCount).toBe(1);

    // 6. Verify product is now in Branch 2 catalog with stock
    const b2CatalogAfter = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/catalog/branches/${branch2Id}/products`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(b2CatalogAfter.statusCode).toBe(200);
    expect(b2CatalogAfter.json().data.items.length).toBe(1);
    const importedItem = b2CatalogAfter.json().data.items[0];
    expect(importedItem.product.id).toBe(productId);
    expect(importedItem.quantity_on_hand).toBe(25);
    expect(importedItem.source_branch_name).toContain('Main Branch');

    // 7. Remove product from Branch 2 catalog (soft-exclude)
    const removeRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/catalog/branches/${branch2Id}/products/${productId}?reason=Temporarily%20unavailable`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(removeRes.statusCode).toBe(200);

    // Verify it is excluded from default branch catalog list
    const b2CatalogAfterRemove = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/catalog/branches/${branch2Id}/products`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(b2CatalogAfterRemove.json().data.items.length).toBe(0);

    // 8. Verify import audit log history
    const auditRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/catalog/imports',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(auditRes.statusCode).toBe(200);
    expect(auditRes.json().data.imports.length).toBeGreaterThanOrEqual(1);
  });

  it('imports product as unassigned when importTaxonomy is false', async () => {
    const { token, branch1Id } = await registerAndSetupTenant('unassigntest');

    // Create Category & Brand in Branch 1
    const catRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Source Gourmet Coffee', branchId: branch1Id },
    });
    expect(catRes.statusCode).toBe(201);
    const catId = catRes.json().data.category.id;

    const brandRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/brands',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Source Roasters', branchId: branch1Id },
    });
    expect(brandRes.statusCode).toBe(201);
    const brandId = brandRes.json().data.brand.id;

    // Create product in Branch 1
    const prodRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Dark Roast Blend',
        categoryId: catId,
        brandId,
        costPrice: 10,
        sellingPrice: 20,
        branchId: branch1Id,
      },
    });
    expect(prodRes.statusCode).toBe(201);
    const prodId = prodRes.json().data.product.id;

    // Create Branch 2
    const b2Res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/branches',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Branch Kiosk', type: 'store' },
    });
    const branch2Id = b2Res.json().data.branch.id;

    // Import with importTaxonomy = false
    const importRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/catalog/branches/${branch2Id}/import`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        sourceBranchId: branch1Id,
        productIds: [prodId],
        importTaxonomy: false,
      },
    });
    expect(importRes.statusCode).toBe(201);

    // Verify product in Branch 2 has null category & brand
    const catalogRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/catalog/branches/${branch2Id}/products`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(catalogRes.statusCode).toBe(200);
    const item = catalogRes.json().data.items[0];
    expect(item.product.id).toBe(prodId);
    expect(item.product.category_id).toBeNull();
    expect(item.product.brand_id).toBeNull();

    // Verify NO categories or brands were created in Branch 2
    const b2CatsRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/categories?branchId=${branch2Id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(b2CatsRes.json().data.categories.length).toBe(0);
  });

  it('reconciles entire nested category tree without duplicating existing root nodes', async () => {
    const { token, branch1Id } = await registerAndSetupTenant('treereconcile');

    // 1. In Branch 1: create 3-level tree: Electronics > Audio > Headphones
    const rootRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Electronics', branchId: branch1Id },
    });
    const rootId = rootRes.json().data.category.id;

    const midRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Audio', parentId: rootId, branchId: branch1Id },
    });
    const midId = midRes.json().data.category.id;

    const leafRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Headphones', parentId: midId, branchId: branch1Id },
    });
    const leafId = leafRes.json().data.category.id;

    // Create product under leaf in Branch 1
    const prodRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Noise Cancelling Headphones',
        categoryId: leafId,
        costPrice: 150,
        sellingPrice: 300,
        branchId: branch1Id,
      },
    });
    const prodId = prodRes.json().data.product.id;

    // 2. Create Branch 2
    const b2Res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/branches',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Branch West', type: 'store' },
    });
    const branch2Id = b2Res.json().data.branch.id;

    // 3. Pre-create 'Electronics' in Branch 2 to test that existing root is matched & reused!
    const b2RootRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Electronics', branchId: branch2Id },
    });
    const b2ExistingRootId = b2RootRes.json().data.category.id;

    // 4. Test preview endpoint first
    const previewRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/catalog/branches/${branch2Id}/import-preview`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        sourceBranchId: branch1Id,
        productIds: [prodId],
      },
    });
    expect(previewRes.statusCode).toBe(200);
    const preview = previewRes.json().data;
    expect(preview.matchedCategories.length).toBe(1);
    expect(preview.matchedCategories[0].name).toBe('Electronics');
    expect(preview.newCategories.length).toBe(2);
    expect(preview.newCategories.map((c: { name: string }) => c.name)).toContain('Audio');
    expect(preview.newCategories.map((c: { name: string }) => c.name)).toContain('Headphones');

    // 5. Execute import with importTaxonomy = true
    const importRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/catalog/branches/${branch2Id}/import`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        sourceBranchId: branch1Id,
        productIds: [prodId],
        importTaxonomy: true,
      },
    });
    expect(importRes.statusCode).toBe(201);

    // 6. Inspect Branch 2 categories: should have exactly 1 root ('Electronics'), which has 'Audio', which has 'Headphones'
    const b2TreeRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/categories?branchId=${branch2Id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const b2Tree = b2TreeRes.json().data.categories;
    expect(b2Tree.length).toBe(1);
    expect(b2Tree[0].id).toBe(b2ExistingRootId); // Reused, NOT duplicated!
    expect(b2Tree[0].children.length).toBe(1);
    expect(b2Tree[0].children[0].name).toBe('Audio');
    expect(b2Tree[0].children[0].children.length).toBe(1);
    expect(b2Tree[0].children[0].children[0].name).toBe('Headphones');

    // 7. Inspect imported product in Branch 2 catalog: points to Branch 2's Headphones category
    const b2CatProdRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/catalog/branches/${branch2Id}/products`,
      headers: { authorization: `Bearer ${token}` },
    });
    const importedItem = b2CatProdRes.json().data.items[0];
    expect(importedItem.product.category_id).toBe(b2Tree[0].children[0].children[0].id);
    expect(importedItem.product.category_name).toBe('Headphones');

    // 8. Verify ETag header and conditional 304 Not Modified response
    expect(b2CatProdRes.headers.etag).toBeDefined();
    const etag = b2CatProdRes.headers.etag as string;
    expect(etag).toMatch(/^W\/"/);

    const conditionalRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/catalog/branches/${branch2Id}/products`,
      headers: {
        authorization: `Bearer ${token}`,
        'if-none-match': etag,
      },
    });
    expect(conditionalRes.statusCode).toBe(304);
    expect(conditionalRes.body).toBe('');
  });
});
