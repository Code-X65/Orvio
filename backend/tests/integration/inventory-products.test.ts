import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Inventory Product Management (Integration Tests)', { timeout: 120000 }, () => {
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
      'user-agent': 'ProductIntegrationTestAgent/1.0',
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

    // Complete inventory onboarding setup
    const setupRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/onboarding/setup',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        businessType: 'retail_supermarket',
        businessDescription: 'Retail Supermarket Hub',
        branchName: 'Main Store',
        branchCode: 'HQ',
        useOrgEmail: true,
        useOrgPhone: true,
        address: {
          country: 'Nigeria',
          state: 'Lagos',
          city: 'Ikeja',
          streetAddress: '15 Commercial Way',
        },
        currency: 'NGN',
      },
    });
    expect(setupRes.statusCode).toBe(201);

    return { token, subdomain };
  }

  it('creates product with auto-generated SKU and initial stock level', async () => {
    const { token } = await registerAndSetupTenant('prdauto');

    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Organic Whole Milk',
        description: '1 Liter pasteurized dairy milk',
        costPrice: 850,
        sellingPrice: 1200,
        unitOfMeasure: 'liter',
        trackQuantity: true,
        lowStockThreshold: 10,
        initialStock: 45,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const product = createRes.json().data.product;

    expect(product.id).toBeDefined();
    expect(product.sku).toMatch(/^OWM-\d{3}$/);
    expect(product.name).toBe('Organic Whole Milk');
    expect(product.unit_of_measure).toBe('liter');

    // Fetch product details to verify StockLevel
    const detailRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products/${product.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json().data.product;
    expect(detail.total_stock).toBe(45);
    expect(detail.available_stock).toBe(45);
    expect(detail.stock_levels).toHaveLength(1);
    expect(detail.stock_levels[0].branch_name).toBe('Main Store');
  });

  it('enforces SKU and Barcode uniqueness per organization', async () => {
    const { token } = await registerAndSetupTenant('prduq');

    // Create first product with explicit SKU and Barcode
    const res1 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Basmati Rice 5kg',
        sku: 'RICE-BAS-5KG',
        barcode: '890103001234',
        costPrice: 4000,
        sellingPrice: 5500,
      },
    });
    expect(res1.statusCode).toBe(201);

    // Duplicate SKU attempt
    const resDuplicateSku = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Basmati Rice Premium',
        sku: 'RICE-BAS-5KG',
        costPrice: 4200,
        sellingPrice: 6000,
      },
    });
    expect(resDuplicateSku.statusCode).toBe(409);
    expect(resDuplicateSku.json().error.code).toBe('PRODUCT_SKU_DUPLICATE');

    // Duplicate Barcode attempt
    const resDuplicateBarcode = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Jasmine Rice 5kg',
        sku: 'RICE-JAS-5KG',
        barcode: '890103001234',
        costPrice: 4500,
        sellingPrice: 6200,
      },
    });
    expect(resDuplicateBarcode.statusCode).toBe(409);
    expect(resDuplicateBarcode.json().error.code).toBe('PRODUCT_BARCODE_DUPLICATE');
  });

  it('lists products with pagination, search, category, and low stock filters', async () => {
    const { token } = await registerAndSetupTenant('prdfilter');

    // Create Category
    const catRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Bakery & Bread' },
    });
    const categoryId = catRes.json().data.category.id;

    // Create 3 products
    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Artisan Sourdough Loaf',
        sku: 'BREAD-SOUR-01',
        categoryId,
        costPrice: 300,
        sellingPrice: 700,
        lowStockThreshold: 15,
        initialStock: 5, // low stock!
      },
    });

    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Whole Wheat Sandwich Bread',
        sku: 'BREAD-WHT-02',
        categoryId,
        costPrice: 250,
        sellingPrice: 500,
        lowStockThreshold: 10,
        initialStock: 50, // healthy stock
      },
    });

    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Chocolate Chip Cookies Pack',
        sku: 'SNK-CHOC-01',
        costPrice: 400,
        sellingPrice: 900,
        lowStockThreshold: 5,
        initialStock: 20,
      },
    });

    // 1. Filter by category
    const listByCat = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products?categoryId=${categoryId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listByCat.statusCode).toBe(200);
    const catProducts = listByCat.json().data.products;
    expect(catProducts).toHaveLength(2);
    expect(catProducts.map((p: any) => p.sku)).toContain('BREAD-SOUR-01');

    // 2. Filter by lowStock
    const listLowStock = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/products?lowStock=true',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listLowStock.statusCode).toBe(200);
    const lowStockProducts = listLowStock.json().data.products;
    expect(lowStockProducts).toHaveLength(1);
    expect(lowStockProducts[0].sku).toBe('BREAD-SOUR-01');

    // 3. Search query
    const listSearch = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/products?search=Cookies',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listSearch.statusCode).toBe(200);
    const searchProducts = listSearch.json().data.products;
    expect(searchProducts).toHaveLength(1);
    expect(searchProducts[0].name).toContain('Chocolate Chip Cookies');
  });

  it('updates product and enforces strict soft-delete', async () => {
    const { token } = await registerAndSetupTenant('prdupd');

    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Stainless Steel Flask 500ml',
        sku: 'FLASK-500ML',
        costPrice: 2000,
        sellingPrice: 3500,
      },
    });
    const productId = createRes.json().data.product.id;

    // PATCH update
    const patchRes = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v1/inventory/products/${productId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        sellingPrice: 3800,
        description: 'Double-walled vacuum insulated flask',
      },
    });
    expect(patchRes.statusCode).toBe(200);
    const updated = patchRes.json().data.product;
    expect(Number(updated.selling_price)).toBe(3800);
    expect(updated.description).toBe('Double-walled vacuum insulated flask');

    // DELETE product (strict soft delete)
    const delRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/products/${productId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().data.success).toBe(true);

    // Subsequent GET should return 404
    const getDeleted = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products/${productId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getDeleted.statusCode).toBe(404);

    // Listing should exclude soft-deleted product
    const listRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
    });
    const ids = listRes.json().data.products.map((p: any) => p.id);
    expect(ids).not.toContain(productId);
  });

  it('manages product variants for template products', async () => {
    const { token } = await registerAndSetupTenant('prdvar');

    // Create parent product with hasVariants = true
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Cotton Graphic Hoodie',
        sku: 'HOODIE-GRAPHIC',
        costPrice: 5000,
        sellingPrice: 9500,
        hasVariants: true,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const parentId = createRes.json().data.product.id;

    // Add Variant: Size M, Color Black
    const var1Res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/products/${parentId}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        sku: 'HOODIE-M-BLK',
        costPrice: 5000,
        sellingPrice: 9500,
        attributes: { size: 'M', color: 'Black' },
        initialStock: 15,
      },
    });
    expect(var1Res.statusCode).toBe(201);
    const var1 = var1Res.json().data.variant;
    expect(var1.sku).toBe('HOODIE-M-BLK');

    // Add Variant: Size L, Color Black
    const var2Res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/products/${parentId}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        sku: 'HOODIE-L-BLK',
        costPrice: 5000,
        sellingPrice: 9500,
        attributes: { size: 'L', color: 'Black' },
        initialStock: 25,
      },
    });
    expect(var2Res.statusCode).toBe(201);

    // Retrieve parent product details — variants should be included
    const detailRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products/${parentId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(detailRes.statusCode).toBe(200);
    const variants = detailRes.json().data.product.variants;
    expect(variants).toHaveLength(2);
  });

  it('provides quick search endpoint for barcode scanner and lookup', async () => {
    const { token } = await registerAndSetupTenant('prdsearch');

    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Instant Noodles Pack 70g',
        sku: 'NOODLE-IND-70G',
        barcode: '089686010924',
        costPrice: 80,
        sellingPrice: 150,
        initialStock: 100,
      },
    });

    // Search by barcode
    const barcodeSearch = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/products/search?q=089686010924',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(barcodeSearch.statusCode).toBe(200);
    const results = barcodeSearch.json().data.results;
    expect(results).toHaveLength(1);
    expect(results[0].sku).toBe('NOODLE-IND-70G');
    expect(results[0].available_stock).toBe(100);
  });
});
