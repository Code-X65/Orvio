import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Inventory Suppliers & Stock Receipts Integration Tests', { timeout: 120000 }, () => {
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
      'user-agent': 'SuppliersReceiptsTestAgent/1.0',
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
        fullName: `${orgPrefix} Admin`,
        organizationName: `${orgPrefix} Wholesale`,
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

    // Complete onboarding setup to have primary branch
    const setupRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/onboarding/setup',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        businessType: 'retail_supermarket',
        businessDescription: 'Wholesale & Retail Supplies',
        branchName: `${orgPrefix} Central Store`,
        branchCode: 'CS01',
        useOrgEmail: true,
        useOrgPhone: true,
        address: {
          country: 'Nigeria',
          state: 'Lagos',
          city: 'Ikeja',
          streetAddress: '15 Warehouse Road',
        },
        currency: 'NGN',
      },
    });
    expect(setupRes.statusCode).toBe(201);
    const branch = setupRes.json().data.branch;

    return { token, branch, orgId: branch.org_id };
  }

  it('manages supplier lifecycle: create, duplicate warning, list, update, deactivate', async () => {
    const { token } = await registerAndSetupTenant('supp');

    // 1. Create a supplier
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/suppliers',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Apex Foods Ltd',
        phone: '+2348011223344',
        email: 'sales@apexfoods.com',
        contactPerson: 'Babatunde Ade',
        address: '15 Warehouse Road, Ikeja, Lagos',
        notes: 'Preferred bulk grain supplier',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const created = createRes.json().data.supplier;
    expect(created.name).toBe('Apex Foods Ltd');
    expect(created.isActive).toBe(true);
    expect(created.receiptsCount).toBe(0);

    // 2. Check duplicate detection with same name
    const dupRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/suppliers/check-duplicates',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'apex foods ltd' },
    });
    expect(dupRes.statusCode).toBe(200);
    expect(dupRes.json().data.hasDuplicates).toBe(true);

    // 3. List suppliers
    const listRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/suppliers?search=Apex',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().data.suppliers.length).toBe(1);
    expect(listRes.json().data.suppliers[0].id).toBe(created.id);

    // 4. Update supplier
    const updateRes = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v1/inventory/suppliers/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { contactPerson: 'Babatunde Ade (Updated)' },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().data.contactPerson).toBe('Babatunde Ade (Updated)');

    // 5. Deactivate supplier
    const deactRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/suppliers/${created.id}/deactivate`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deactRes.statusCode).toBe(200);
    expect(deactRes.json().data.isActive).toBe(false);

    // Verify activeOnly filter excludes deactivated supplier
    const activeList = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/suppliers?activeOnly=true',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(activeList.statusCode).toBe(200);
    expect(activeList.json().data.suppliers.length).toBe(0);

    // Re-activate supplier
    const reactRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/suppliers/${created.id}/activate`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(reactRes.statusCode).toBe(200);
    expect(reactRes.json().data.isActive).toBe(true);
  });

  it('records multi-product stock receipt atomically with stock movement ledger update', async () => {
    const { token, branch } = await registerAndSetupTenant('rcpt');

    // Create 2 products
    const prod1Res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Organic Basmati Rice 50kg',
        sku: 'RICE-50KG-01',
        costPrice: 25000,
        sellingPrice: 32000,
        trackQuantity: true,
      },
    });
    expect(prod1Res.statusCode).toBe(201);
    const prod1 = prod1Res.json().data.product;

    const prod2Res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Vegetable Oil 25L',
        sku: 'OIL-25L-01',
        costPrice: 18000,
        sellingPrice: 22000,
        trackQuantity: true,
      },
    });
    expect(prod2Res.statusCode).toBe(201);
    const prod2 = prod2Res.json().data.product;

    // Create supplier
    const suppRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/suppliers',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Prime Distributors',
        phone: '+2348099887766',
      },
    });
    expect(suppRes.statusCode).toBe(201);
    const supplier = suppRes.json().data.supplier;

    // Receive stock delivery with multiple items
    const receiptRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/stock/receipts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        branchId: branch.id,
        supplierId: supplier.id,
        supplierInvoiceNumber: 'INV-2026-0091',
        notes: 'Delivery received in good condition at loading bay A',
        items: [
          {
            productId: prod1.id,
            quantityReceived: 40,
            unitCost: 24500,
            notes: 'Pallet 1 & 2',
          },
          {
            productId: prod2.id,
            quantityReceived: 15,
            unitCost: 17500,
          },
        ],
      },
    });

    expect(receiptRes.statusCode).toBe(201);
    const receipt = receiptRes.json().data;
    expect(receipt.reference).toMatch(/^RCPT-\d{6}$/);
    expect(receipt.lineCount).toBe(2);
    expect(receipt.totalQuantity).toBe(55);
    expect(receipt.totalCost).toBe(40 * 24500 + 15 * 17500);

    // Verify stock levels were updated
    const stockItemsRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/stock/items?branchId=${branch.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(stockItemsRes.statusCode).toBe(200);
    const items = stockItemsRes.json().data.items;

    const riceStock = items.find((i: any) => i.productId === prod1.id);
    expect(riceStock).toBeDefined();
    expect(riceStock.quantityOnHand).toBe(40);

    const oilStock = items.find((i: any) => i.productId === prod2.id);
    expect(oilStock).toBeDefined();
    expect(oilStock.quantityOnHand).toBe(15);

    // Verify movements ledger contains receipt entries
    const movementsRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/stock/movements?branchId=${branch.id}&movementType=receipt`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(movementsRes.statusCode).toBe(200);
    const movements = movementsRes.json().data.movements;
    expect(movements.length).toBeGreaterThanOrEqual(2);
    const riceMovement = movements.find((m: any) => m.productId === prod1.id);
    expect(riceMovement).toBeDefined();
    expect(riceMovement.movementType).toBe('receipt');
    expect(riceMovement.quantity).toBe(40);
    expect(riceMovement.referenceId).toBe(receipt.reference);

    // Verify list receipts
    const listReceiptsRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/stock/receipts?branchId=${branch.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listReceiptsRes.statusCode).toBe(200);
    expect(listReceiptsRes.json().data.receipts.length).toBe(1);

    // Verify get receipt detail
    const detailRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/stock/receipts/${receipt.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json().data;
    expect(detail.items.length).toBe(2);
    expect(detail.supplierDetails.name).toBe('Prime Distributors');
    expect(detail.movements.length).toBe(2);

    // Verify supplier receipt count was updated
    const suppDetailRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/suppliers/${supplier.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(suppDetailRes.statusCode).toBe(200);
    expect(suppDetailRes.json().data.receiptsCount).toBe(1);
    expect(suppDetailRes.json().data.recentReceipts.length).toBe(1);
  });

  it('rejects receiving stock from a deactivated supplier or with duplicate reference', async () => {
    const { token, branch } = await registerAndSetupTenant('errtest');

    const prodRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Sugar 50kg',
        sku: 'SUGAR-01',
        costPrice: 20000,
        sellingPrice: 25000,
        trackQuantity: true,
      },
    });
    const product = prodRes.json().data.product;

    const suppRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/suppliers',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Inactive Supplier' },
    });
    const supplier = suppRes.json().data.supplier;

    // Deactivate supplier
    await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/suppliers/${supplier.id}/deactivate`,
      headers: { authorization: `Bearer ${token}` },
    });

    // Try receiving from inactive supplier
    const inactiveReceipt = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/stock/receipts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        branchId: branch.id,
        supplierId: supplier.id,
        items: [{ productId: product.id, quantityReceived: 10 }],
      },
    });
    expect(inactiveReceipt.statusCode).toBe(400);
    expect(inactiveReceipt.json().error.code).toBe('SUPPLIER_INACTIVE');

    // Reactivate supplier
    await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/suppliers/${supplier.id}/activate`,
      headers: { authorization: `Bearer ${token}` },
    });

    // Receive first time with explicit reference
    const firstReceipt = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/stock/receipts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        branchId: branch.id,
        supplierId: supplier.id,
        reference: 'CUSTOM-RCPT-001',
        items: [{ productId: product.id, quantityReceived: 5 }],
      },
    });
    expect(firstReceipt.statusCode).toBe(201);

    // Try receiving second time with SAME reference (collision)
    const duplicateReceipt = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/stock/receipts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        branchId: branch.id,
        supplierId: supplier.id,
        reference: 'CUSTOM-RCPT-001',
        items: [{ productId: product.id, quantityReceived: 5 }],
      },
    });
    expect(duplicateReceipt.statusCode).toBe(409);
    expect(duplicateReceipt.json().error.code).toBe('DUPLICATE_RECEIPT_REFERENCE');
  });
});
