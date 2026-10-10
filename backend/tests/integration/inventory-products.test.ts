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

  it('enforces selling >= cost validation, compare-at price, and price revision history logging', async () => {
    const { token } = await registerAndSetupTenant('prdhst');

    // 1. Attempt creating product where sellingPrice < costPrice (Must be rejected)
    const invalidPriceRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Loss Leader Beverage',
        costPrice: 500,
        sellingPrice: 300, // Selling < Cost
      },
    });
    expect(invalidPriceRes.statusCode).toBe(400);
    const errorBody = invalidPriceRes.json();
    expect(['VALIDATION_ERROR', 'PRODUCT_PRICE_INVALID']).toContain(errorBody.error.code);
    expect(JSON.stringify(errorBody)).toContain('Selling price must not be less than cost price');

    // 2. Create product with valid price and compare-at promotional price
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Premium Dark Chocolate',
        costPrice: 800,
        sellingPrice: 1200,
        compareAtPrice: 1500,
        unitOfMeasure: 'pcs',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const product = createRes.json().data.product;
    expect(Number(product.selling_price)).toBe(1200);
    expect(Number(product.compare_at_price)).toBe(1500);

    // 3. Update product price and verify sensitive revision is logged
    const updateRes = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v1/inventory/products/${product.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        costPrice: 950,
        sellingPrice: 1400,
        priceChangeReason: 'Vendor raw cocoa price surge',
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json().data.product;
    expect(Number(updated.cost_price)).toBe(950);
    expect(Number(updated.selling_price)).toBe(1400);

    // 4. Retrieve price history endpoint
    const historyRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products/${product.id}/price-history`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(historyRes.statusCode).toBe(200);
    const historyList = historyRes.json().data.history;
    expect(historyList).toHaveLength(1);
    expect(Number(historyList[0].old_cost_price)).toBe(800);
    expect(Number(historyList[0].new_cost_price)).toBe(950);
    expect(Number(historyList[0].old_selling_price)).toBe(1200);
    expect(Number(historyList[0].new_selling_price)).toBe(1400);
    expect(historyList[0].reason).toBe('Vendor raw cocoa price surge');
  });

  it('enforces stock constraints, blocks reserved stock, requires confirmation for on-hand stock, and logs audit trail', async () => {
    const { token } = await registerAndSetupTenant('delstock');

    // 1. Create a product with variants and initial stock
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Organic Brown Sugar 1kg',
        costPrice: 500,
        sellingPrice: 800,
        unitOfMeasure: 'kg',
        hasVariants: true,
        initialStock: 50,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const product = createRes.json().data.product;

    // Create a variant
    const variantRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/products/${product.id}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        sku: 'OBS-1KG-VAR',
        costPrice: 500,
        sellingPrice: 800,
        attributes: { packaging: 'Paper bag' },
      },
    });
    expect(variantRes.statusCode).toBe(201);
    const variant = variantRes.json().data.variant;

    // Direct database update: add 10 reserved stock
    await ctx.prisma.stockLevel.updateMany({
      where: {
        org_id: product.org_id,
        product_id: product.id,
      },
      data: {
        reserved: 10,
      },
    });

    // 2. Check GET /usage
    const usageRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products/${product.id}/usage`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(usageRes.statusCode).toBe(200);
    const usage = usageRes.json().data.usage;
    expect(usage.totalOnHand).toBe(50);
    expect(usage.totalReserved).toBe(10);
    expect(usage.variantCount).toBe(1);
    expect(usage.hasReservedStock).toBe(true);
    expect(usage.canDelete).toBe(false);

    // 3. Attempt to delete while reserved stock > 0 -> must be strictly blocked
    const blockedRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/products/${product.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(blockedRes.statusCode).toBe(400);
    expect(blockedRes.json().error.code).toBe('PRODUCT_HAS_RESERVED_STOCK');

    // 4. Clear reserved stock (orders fulfilled/cancelled), leaving 50 on-hand
    await ctx.prisma.stockLevel.updateMany({
      where: { org_id: product.org_id, product_id: product.id },
      data: { reserved: 0 },
    });

    // Verify usage updated
    const usageAfterReserved = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products/${product.id}/usage`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(usageAfterReserved.statusCode).toBe(200);
    expect(usageAfterReserved.json().data.usage.hasReservedStock).toBe(false);
    expect(usageAfterReserved.json().data.usage.canDelete).toBe(true);
    expect(usageAfterReserved.json().data.usage.totalOnHand).toBe(50);

    // 5. Attempt delete without confirmWithStock flag -> must fail with PRODUCT_HAS_STOCK
    const noConfirmRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/products/${product.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(noConfirmRes.statusCode).toBe(400);
    expect(noConfirmRes.json().error.code).toBe('PRODUCT_HAS_STOCK');

    // 6. Attempt delete with confirmWithStock but missing reason -> must fail with VALIDATION_ERROR
    const noReasonRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/products/${product.id}?confirmWithStock=true`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(noReasonRes.statusCode).toBe(400);
    expect(noReasonRes.json().error.code).toBe('VALIDATION_ERROR');

    // 7. Successful delete with confirmWithStock and valid reason
    const successDeleteRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/products/${product.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        confirmWithStock: true,
        reason: 'Vendor discontinued product line write-off',
      },
    });
    expect(successDeleteRes.statusCode).toBe(200);
    expect(successDeleteRes.json().data.success).toBe(true);

    // 8. Verify soft-deleted state, audit fields, and variant deactivation in database
    const dbProduct = await ctx.prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(dbProduct).toBeDefined();
    expect(dbProduct!.is_deleted).toBe(true);
    expect(dbProduct!.is_active).toBe(false);
    expect(dbProduct!.deleted_at).toBeDefined();
    expect(dbProduct!.deleted_by_user_id).toBeDefined();
    expect(dbProduct!.deleted_reason).toBe('Vendor discontinued product line write-off');

    const dbVariant = await ctx.prisma.productVariant.findUnique({
      where: { id: variant.id },
    });
    expect(dbVariant).toBeDefined();
    expect(dbVariant!.is_active).toBe(false);

    // Verify audit log
    const auditLog = await ctx.prisma.auditLog.findFirst({
      where: {
        org_id: product.org_id,
        event: 'product_archived',
      },
    });
    expect(auditLog).toBeDefined();
    expect((auditLog!.metadata as any).productId).toBe(product.id);
    expect((auditLog!.metadata as any).reason).toBe('Vendor discontinued product line write-off');
  });

  it('restores archived product and supports status=archived filtering in listProducts', async () => {
    const { token } = await registerAndSetupTenant('prdrst');

    // 1. Create product
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Item to Archive and Restore',
        costPrice: 500,
        sellingPrice: 800,
        unitOfMeasure: 'pcs',
        trackQuantity: false,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const product = createRes.json().data.product;

    // 2. Archive product
    const deleteRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/products/${product.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deleteRes.statusCode).toBe(200);

    // 3. List with status=archived — should contain archived product
    const archivedListRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/products?status=archived',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(archivedListRes.statusCode).toBe(200);
    const archivedItems = archivedListRes.json().data.products;
    expect(archivedItems.some((p: any) => p.id === product.id)).toBe(true);

    // List with default active/all — should NOT contain archived product
    const activeListRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/products?status=active',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(activeListRes.statusCode).toBe(200);
    const activeItems = activeListRes.json().data.products;
    expect(activeItems.some((p: any) => p.id === product.id)).toBe(false);

    // 4. Restore product
    const restoreRes = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v1/inventory/products/${product.id}/restore`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(restoreRes.statusCode).toBe(200);
    const restoredProduct = restoreRes.json().data.product;
    expect(restoredProduct.is_deleted).toBe(false);
    expect(restoredProduct.is_active).toBe(true);

    // 5. Verify database and audit log
    const dbProduct = await ctx.prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(dbProduct!.is_deleted).toBe(false);
    expect(dbProduct!.is_active).toBe(true);
    expect(dbProduct!.deleted_at).toBeNull();

    const auditLog = await ctx.prisma.auditLog.findFirst({
      where: {
        org_id: product.org_id,
        event: 'product_restored',
      },
    });
    expect(auditLog).toBeDefined();
    expect((auditLog!.metadata as any).productId).toBe(product.id);
  });

  it('updates variant pricing with no-loss constraint and logs variant price revision history', async () => {
    const { token } = await registerAndSetupTenant('prdvarprc');

    // 1. Create template product with variant
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'T-Shirt Master',
        costPrice: 2000,
        sellingPrice: 3500,
        hasVariants: true,
        unitOfMeasure: 'pcs',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const product = createRes.json().data.product;

    const variantRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/products/${product.id}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Size Medium Black',
        costPrice: 2000,
        sellingPrice: 3500,
        attributes: { size: 'M', color: 'Black' },
      },
    });
    expect(variantRes.statusCode).toBe(201);
    const variant = variantRes.json().data.variant;

    // 2. Reject update if sellingPrice < costPrice (no loss permitted)
    const lossRes = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v1/inventory/products/${product.id}/variants/${variant.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        costPrice: 3000,
        sellingPrice: 2500,
      },
    });
    expect(lossRes.statusCode).toBe(400);

    // 3. Update variant with valid prices and priceChangeReason
    const updateRes = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v1/inventory/products/${product.id}/variants/${variant.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        costPrice: 2200,
        sellingPrice: 4000,
        priceChangeReason: 'Cotton supplier price increase',
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updatedVariant = updateRes.json().data.variant;
    expect(Number(updatedVariant.cost_price)).toBe(2200);
    expect(Number(updatedVariant.selling_price)).toBe(4000);

    // 4. Retrieve variant price history
    const historyRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products/${product.id}/variants/${variant.id}/price-history`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(historyRes.statusCode).toBe(200);
    const history = historyRes.json().data.history;
    expect(history.length).toBeGreaterThanOrEqual(1);

    const latest = history[0];
    expect(latest.variant_id).toBe(variant.id);
    expect(Number(latest.old_cost_price)).toBe(2000);
    expect(Number(latest.new_cost_price)).toBe(2200);
    expect(Number(latest.old_selling_price)).toBe(3500);
    expect(Number(latest.new_selling_price)).toBe(4000);
    expect(latest.reason).toBe('Cotton supplier price increase');
  });

  it('soft-deletes variant with stock guards, reserved check, and reason', async () => {
    const { token } = await registerAndSetupTenant('prdvardel');

    // 1. Create template product and variant
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Phone Case Master',
        costPrice: 1000,
        sellingPrice: 2000,
        hasVariants: true,
        unitOfMeasure: 'pcs',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const product = createRes.json().data.product;

    const variantRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/products/${product.id}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'iPhone 15 Case',
        costPrice: 1000,
        sellingPrice: 2000,
        initialStock: 10,
        attributes: { model: 'iPhone 15' },
      },
    });
    expect(variantRes.statusCode).toBe(201);
    const variant = variantRes.json().data.variant;

    // 2. Reject delete when variant has active stock on hand without confirmWithStock
    const deleteBlockedRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/products/${product.id}/variants/${variant.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deleteBlockedRes.statusCode).toBe(400);
    expect(deleteBlockedRes.json().error.code).toBe('PRODUCT_HAS_STOCK');

    // 3. Reject delete when confirmWithStock is true but no reason provided
    const noReasonRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/products/${product.id}/variants/${variant.id}?confirmWithStock=true`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(noReasonRes.statusCode).toBe(400);
    expect(noReasonRes.json().error.code).toBe('VALIDATION_ERROR');

    // 4. Successful soft-delete with confirmWithStock and reason
    const successDeleteRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/products/${product.id}/variants/${variant.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        confirmWithStock: true,
        reason: 'Discontinued older phone model case',
      },
    });
    expect(successDeleteRes.statusCode).toBe(200);
    expect(successDeleteRes.json().data.success).toBe(true);

    // 5. Verify database state
    const dbVariant = await ctx.prisma.productVariant.findUnique({
      where: { id: variant.id },
    });
    expect(dbVariant!.is_deleted).toBe(true);
    expect(dbVariant!.is_active).toBe(false);
    expect(dbVariant!.deleted_at).toBeDefined();

    // 6. Verify audit log
    const auditLog = await ctx.prisma.auditLog.findFirst({
      where: {
        org_id: product.org_id,
        event: 'product_variant_archived',
      },
    });
    expect(auditLog).toBeDefined();
    expect((auditLog!.metadata as any).variantId).toBe(variant.id);
    expect((auditLog!.metadata as any).reason).toBe('Discontinued older phone model case');
  });

  it('validates business-type metadata and persists typed attributes', async () => {
    const { token } = await registerAndSetupTenant('prdmtd');

    // 1. Invalid metadata types are rejected
    const invalidRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Paracetamol Extra',
        costPrice: 200,
        sellingPrice: 350,
        metadata: {
          requiresPrescription: 'yes_please', // must be boolean
        },
      },
    });
    expect(invalidRes.statusCode).toBe(400);

    // 2. Valid clinical metadata persists cleanly
    const validRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Paracetamol Extra',
        costPrice: 200,
        sellingPrice: 350,
        metadata: {
          requiresPrescription: false,
          dosageForm: 'Tablet',
          strength: '500mg',
          nafdacNumber: '04-5678',
        },
      },
    });
    expect(validRes.statusCode).toBe(201);
    const product = validRes.json().data.product;
    expect(product.metadata).toEqual({
      requiresPrescription: false,
      dosageForm: 'Tablet',
      strength: '500mg',
      nafdacNumber: '04-5678',
    });
  });

  it('ensures cross-entity cache invalidation when category name updates', async () => {
    const { token } = await registerAndSetupTenant('prdcache');

    // 1. Create category
    const catRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Dairy & Milk' },
    });
    expect(catRes.statusCode).toBe(201);
    const category = catRes.json().data.category;

    // 2. Create product in that category
    const prodRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Greek Yogurt 500g',
        categoryId: category.id,
        costPrice: 800,
        sellingPrice: 1300,
      },
    });
    expect(prodRes.statusCode).toBe(201);
    const product = prodRes.json().data.product;

    // 3. Call listProducts to warm cache
    const listRes1 = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes1.statusCode).toBe(200);
    const item1 = listRes1.json().data.products.find((p: any) => p.id === product.id);
    expect(item1.category_name).toBe('Dairy & Milk');

    // 4. Rename category via CategoryService
    const updateCatRes = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v1/inventory/categories/${category.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Artisan Dairy Products' },
    });
    expect(updateCatRes.statusCode).toBe(200);

    // 5. Call listProducts immediately — should reflect updated category name (not stale cached name)
    const listRes2 = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes2.statusCode).toBe(200);
    const item2 = listRes2.json().data.products.find((p: any) => p.id === product.id);
    expect(item2.category_name).toBe('Artisan Dairy Products');
  });
});
