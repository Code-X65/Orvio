import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Inventory Stock Management & Movement Ledger (Integration Tests)', { timeout: 120000 }, () => {
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
      'user-agent': 'StockIntegrationTestAgent/1.0',
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
        organizationName: `${orgPrefix} Mart`,
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
          streetAddress: '10 Allen Avenue',
        },
        currency: 'NGN',
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

    // Create a secondary branch
    const branch2Res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/branches',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: `${orgPrefix} Branch Two`,
        code: 'BR2',
        type: 'store',
        address: {
          country: 'Nigeria',
          state: 'Lagos',
          city: 'Victoria Island',
          streetAddress: '50 Adeola Odeku',
        },
      },
    });
    expect(branch2Res.statusCode).toBe(201);
    const branch2Id = branch2Res.json().data.branch.id;

    return { token, branch1Id, branch2Id };
  }

  it('records opening stock, receives stock, adjusts stock, and transfers stock with atomic ledger entries', async () => {
    const { token, branch1Id, branch2Id } = await registerAndSetupTenant('stocktest');

    // 1. Create a product
    const prodRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Basmati Rice 5kg',
        sku: 'RICE-BAS-5KG',
        costPrice: 4500,
        sellingPrice: 6000,
        unitOfMeasure: 'pack',
        lowStockThreshold: 10,
        trackQuantity: true,
        branchId: branch1Id,
      },
    });
    expect(prodRes.statusCode).toBe(201);
    const productId = prodRes.json().data.product.id;

    // 2. Record Opening Stock: 50 units at branch 1
    const openingRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/stock/opening',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        branchId: branch1Id,
        productId,
        quantity: 50,
        notes: 'Initial warehouse intake count',
      },
    });
    expect(openingRes.statusCode).toBe(201);
    expect(openingRes.json().data.quantityOnHand).toBe(50);

    // 3. Receive Stock: 25 units at branch 1
    const receiveRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/stock/receive',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        branchId: branch1Id,
        productId,
        quantity: 25,
        reference: 'REC-2026-001',
        notes: 'Supplier replenishment batch #1',
      },
    });
    expect(receiveRes.statusCode).toBe(201);
    expect(receiveRes.json().data.quantityOnHand).toBe(75);

    // 4. Adjust Stock (Delta mode): -5 units due to damage
    const adjustDeltaRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/stock/adjust',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        branchId: branch1Id,
        productId,
        mode: 'delta',
        value: -5,
        reason: 'damage',
        notes: 'Water damaged packs removed from shelf',
      },
    });
    expect(adjustDeltaRes.statusCode).toBe(200);
    expect(adjustDeltaRes.json().data.quantityOnHand).toBe(70);
    expect(adjustDeltaRes.json().data.delta).toBe(-5);

    // 5. Adjust Stock (Counted mode): Physical count found 72
    const adjustCountedRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/stock/adjust',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        branchId: branch1Id,
        productId,
        mode: 'counted',
        value: 72,
        reason: 'found',
        notes: 'Found misplaced stock in backroom',
      },
    });
    expect(adjustCountedRes.statusCode).toBe(200);
    expect(adjustCountedRes.json().data.quantityOnHand).toBe(72);
    expect(adjustCountedRes.json().data.delta).toBe(2);

    // 6. Negative Stock Rejection: attempting to decrease below zero throws 409
    const negativeAdjustRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/stock/adjust',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        branchId: branch1Id,
        productId,
        mode: 'delta',
        value: -200,
        reason: 'loss',
        notes: 'Over-deduction attempt',
      },
    });
    expect(negativeAdjustRes.statusCode).toBe(409);
    expect(negativeAdjustRes.json().error.code).toBe('INSUFFICIENT_STOCK');

    // 7. Atomic Branch Transfer: 20 units from branch 1 -> branch 2
    const transferRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/stock/transfer',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        sourceBranchId: branch1Id,
        destinationBranchId: branch2Id,
        productId,
        quantity: 20,
        notes: 'Inter-branch stock transfer for store opening',
      },
    });
    expect(transferRes.statusCode).toBe(200);
    const transferData = transferRes.json().data;
    expect(transferData.transferredQuantity).toBe(20);
    expect(transferData.sourceBalanceAfter).toBe(52); // 72 - 20
    expect(transferData.destinationBalanceAfter).toBe(20); // 0 + 20
    expect(transferData.transferReferenceId).toBeDefined();

    // 8. Insufficient Transfer Rejection: attempting to transfer 100 units from branch 1 throws 409
    const excessiveTransferRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/stock/transfer',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        sourceBranchId: branch1Id,
        destinationBranchId: branch2Id,
        productId,
        quantity: 100,
      },
    });
    expect(excessiveTransferRes.statusCode).toBe(409);
    expect(excessiveTransferRes.json().error.code).toBe('INSUFFICIENT_STOCK');

    // 9. Verify Stock Summary (Dashboard KPI endpoint with ETag)
    const summaryRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/stock/summary?branchId=${branch1Id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(summaryRes.statusCode).toBe(200);
    const summaryData = summaryRes.json().data;
    expect(summaryData.totalTracked).toBe(1);
    expect(summaryData.inStockCount).toBe(1);
    expect(summaryData.lowStockCount).toBe(0);
    expect(summaryData.outOfStockCount).toBe(0);
    expect(summaryData.totalQuantityOnHand).toBe(52);
    expect(summaryRes.headers.etag).toBeDefined();

    // 10. Verify Movements Ledger History contains all append-only events
    const movementsRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/stock/movements?branchId=${branch1Id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(movementsRes.statusCode).toBe(200);
    const movements = movementsRes.json().data.movements;
    // Expected at branch 1: transfer_out, adjustment (found), adjustment (damage), receipt, opening (total 5)
    expect(movements.length).toBe(5);
    expect(movements[0].movementType).toBe('transfer_out');
    expect(movements[0].quantity).toBe(-20);
    expect(movements[0].referenceId).toBe(transferData.transferReferenceId);
    expect(movements[1].movementType).toBe('adjustment');
    expect(movements[1].reason).toBe('found');
    expect(movements[2].movementType).toBe('adjustment');
    expect(movements[2].reason).toBe('damage');
    expect(movements[3].movementType).toBe('receipt');
    expect(movements[4].movementType).toBe('opening');
    expect(movements[4].quantity).toBe(50);

    // Also verify destination branch 2 movement ledger has the paired transfer_in
    const destMovementsRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/stock/movements?branchId=${branch2Id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(destMovementsRes.statusCode).toBe(200);
    const destMovements = destMovementsRes.json().data.movements;
    expect(destMovements.length).toBe(1);
    expect(destMovements[0].movementType).toBe('transfer_in');
    expect(destMovements[0].quantity).toBe(20);
    expect(destMovements[0].referenceId).toBe(transferData.transferReferenceId); // Linked paired reference!
  });
});
