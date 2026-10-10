import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Inventory Category Management (Integration Tests)', { timeout: 60000 }, () => {
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

  it('checks category usage, blocks deletion when products exist, and reassigns products upon deletion', async () => {
    const tenant = await registerAndVerifyTenant('catusage');

    // Create Category A and Category B
    const catARes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: { name: 'Dairy & Milk' },
    });
    expect(catARes.statusCode).toBe(201);
    const catAId = catARes.json().data.category.id;

    const catBRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: { name: 'General Groceries' },
    });
    expect(catBRes.statusCode).toBe(201);
    const catBId = catBRes.json().data.category.id;

    // Create 2 products assigned to Category A
    const prd1 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: {
        name: 'Whole Milk 1L',
        costPrice: 500,
        sellingPrice: 800,
        categoryId: catAId,
      },
    });
    expect(prd1.statusCode).toBe(201);

    const prd2 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: {
        name: 'Cheddar Cheese 250g',
        costPrice: 1200,
        sellingPrice: 1800,
        categoryId: catAId,
      },
    });
    expect(prd2.statusCode).toBe(201);

    // 1. Check GET /usage
    const usageRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/categories/${catAId}/usage`,
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    expect(usageRes.statusCode).toBe(200);
    const usage = usageRes.json().data.usage;
    expect(usage.productCount).toBe(2);
    expect(usage.childCount).toBe(0);

    // 2. Attempt deletion without reassignment — must be blocked with CATEGORY_HAS_PRODUCTS
    const blockedDelete = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/categories/${catAId}`,
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    expect(blockedDelete.statusCode).toBe(400);
    expect(blockedDelete.json().error.code).toBe('CATEGORY_HAS_PRODUCTS');

    // 3. Delete with reassignment to Category B
    const reassignDelete = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/categories/${catAId}?reassignToCategoryId=${catBId}`,
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    expect(reassignDelete.statusCode).toBe(200);
    expect(reassignDelete.json().data.success).toBe(true);
    expect(reassignDelete.json().data.reassignedProductCount).toBe(2);

    // 4. Verify products were moved to Category B
    const prd1Check = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products/${prd1.json().data.product.id}`,
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    expect(prd1Check.statusCode).toBe(200);
    expect(prd1Check.json().data.product.category_id).toBe(catBId);

    const prd2Check = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products/${prd2.json().data.product.id}`,
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    expect(prd2Check.statusCode).toBe(200);
    expect(prd2Check.json().data.product.category_id).toBe(catBId);

    // 5. Verify Category A is soft-deleted and not in categories tree
    const treeAfter = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    const afterCategoryIds = treeAfter.json().data.categories.map((c: { id: string }) => c.id);
    expect(afterCategoryIds).not.toContain(catAId);
    expect(afterCategoryIds).toContain(catBId);
  });

  it('calculates direct and roll-up product counts in category tree and filters products including subcategories', async () => {
    const tenant = await registerAndVerifyTenant('catrollup');

    // 1. Create parent category and child subcategory
    const parentRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: { name: 'Parent Tech' },
    });
    expect(parentRes.statusCode).toBe(201);
    const parentId = parentRes.json().data.category.id;

    const childRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: { name: 'Child Laptops', parentId },
    });
    expect(childRes.statusCode).toBe(201);
    const childId = childRes.json().data.category.id;

    // 2. Create 1 product in Parent Tech, and 2 products in Child Laptops
    const prdParent = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: {
        name: 'Tech Gadget',
        sku: 'TECH-GADGET-01',
        costPrice: 50,
        sellingPrice: 100,
        categoryId: parentId,
      },
    });
    expect(prdParent.statusCode).toBe(201);

    const prdChild1 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: {
        name: 'Pro Laptop',
        sku: 'LAPTOP-PRO-01',
        costPrice: 800,
        sellingPrice: 1200,
        categoryId: childId,
      },
    });
    expect(prdChild1.statusCode).toBe(201);

    const prdChild2 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${tenant.token}` },
      payload: {
        name: 'Air Laptop',
        sku: 'LAPTOP-AIR-02',
        costPrice: 600,
        sellingPrice: 950,
        categoryId: childId,
      },
    });
    expect(prdChild2.statusCode).toBe(201);

    // 3. Fetch category tree: verify product_count and direct_product_count
    const treeRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    expect(treeRes.statusCode).toBe(200);

    const parentNode = treeRes.json().data.categories.find((c: { id: string }) => c.id === parentId);
    expect(parentNode).toBeDefined();
    // Parent should have 1 direct product, but 3 total roll-up products (1 direct + 2 in child)
    expect(parentNode.direct_product_count).toBe(1);
    expect(parentNode.product_count).toBe(3);

    const childNode = parentNode.children.find((c: { id: string }) => c.id === childId);
    expect(childNode).toBeDefined();
    expect(childNode.direct_product_count).toBe(2);
    expect(childNode.product_count).toBe(2);

    // 4. Query products filtering by parentId: must return all 3 products (including subcategory)
    const parentFilterRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products?categoryId=${parentId}`,
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    expect(parentFilterRes.statusCode).toBe(200);
    const parentFilterProducts = parentFilterRes.json().data.products;
    expect(parentFilterProducts.length).toBe(3);
    const productNames = parentFilterProducts.map((p: { name: string }) => p.name);
    expect(productNames).toContain('Tech Gadget');
    expect(productNames).toContain('Pro Laptop');
    expect(productNames).toContain('Air Laptop');

    // 5. Query products filtering by childId: returns only child products (2)
    const childFilterRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products?categoryId=${childId}`,
      headers: { authorization: `Bearer ${tenant.token}` },
    });
    expect(childFilterRes.statusCode).toBe(200);
    expect(childFilterRes.json().data.products.length).toBe(2);
  });
});
