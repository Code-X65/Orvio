import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../helpers/app.js';
import { prisma } from '../../src/infrastructure/database/client.js';

describe('Workspace Application Management (Integration)', () => {
  beforeEach(async () => {
    // Clean database before each test in single batch transaction
    await prisma.$transaction([
      prisma.idempotencyKey.deleteMany(),
      prisma.onboardingFlow.deleteMany(),
      prisma.workspaceProduct.deleteMany(),
      prisma.verificationToken.deleteMany(),
      prisma.branch.deleteMany(),
      prisma.membership.deleteMany(),
      prisma.organization.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  it(
    'provisions initial WorkspaceProduct on registration and allows install, settings update, primary toggle, and uninstall',
    async () => {
    const { app } = await createTestApp();
    const timestamp = Date.now();
    const email = `owner${timestamp}@orviotest.com`;
    const subdomain = `apptest${timestamp}`.slice(0, 20);

    // 1. Register new organization
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'Password123!',
        fullName: 'Test App Owner',
        organizationName: 'App Test Org',
        subdomain,
        planCode: 'inventory',
      },
    });

    expect(regRes.statusCode).toBe(201);
    const regBody = JSON.parse(regRes.payload);
    expect(regBody.status).toBe('success');

    // 2. Activate user & organization and login
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeTruthy();
    await prisma.user.update({
      where: { id: user!.id },
      data: { email_verified_at: new Date() },
    });
    await prisma.organization.update({
      where: { subdomain },
      data: { status: 'active' },
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email,
        password: 'Password123!',
        subdomain,
      },
    });
    expect(loginRes.statusCode).toBe(200);
    const loginBody = JSON.parse(loginRes.payload);
    const token = loginBody.data.accessToken;

    // 3. GET /api/v1/orgs/me -> check initial seeded product
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/orgs/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(meRes.statusCode).toBe(200);
    const meBody = JSON.parse(meRes.payload);
    expect(meBody.data.products).toHaveLength(1);
    expect(meBody.data.products[0].product_key).toBe('inventory');
    expect(meBody.data.products[0].is_primary).toBe(true);

    // 4. POST /api/v1/orgs/products -> Install POS and Gym modules
    const installPos = await app.inject({
      method: 'POST',
      url: '/api/v1/orgs/products',
      headers: { authorization: `Bearer ${token}` },
      payload: { productKey: 'pos' },
    });
    expect(installPos.statusCode).toBe(200);
    const posBody = JSON.parse(installPos.payload);
    expect(posBody.data.products).toHaveLength(2);

    const installGym = await app.inject({
      method: 'POST',
      url: '/api/v1/orgs/products',
      headers: { authorization: `Bearer ${token}` },
      payload: { productKey: 'gym' },
    });
    expect(installGym.statusCode).toBe(200);
    const gymBody = JSON.parse(installGym.payload);
    expect(gymBody.data.products).toHaveLength(3);

    // 5. PATCH /api/v1/orgs/products/pos/primary -> Switch primary app to POS
    const primaryRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/orgs/products/pos/primary',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(primaryRes.statusCode).toBe(200);
    const primaryBody = JSON.parse(primaryRes.payload);
    const posProduct = primaryBody.data.products.find((p: any) => p.product_key === 'pos');
    expect(posProduct.is_primary).toBe(true);

    // 6. PATCH /api/v1/orgs/products/pos/settings -> Update per-app JSON configuration settings
    const settingsRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/orgs/products/pos/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        settings: {
          printerIp: '192.168.1.100',
          autoPrintReceipt: true,
          defaultTaxRate: 7.5,
        },
      },
    });
    expect(settingsRes.statusCode).toBe(200);
    const settingsBody = JSON.parse(settingsRes.payload);
    expect(settingsBody.data.product.settings).toEqual({
      printerIp: '192.168.1.100',
      autoPrintReceipt: true,
      defaultTaxRate: 7.5,
    });

    // 7. Deep merge additional settings
    const updateMoreSettings = await app.inject({
      method: 'PATCH',
      url: '/api/v1/orgs/products/pos/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        settings: {
          currencySymbol: '₦',
          cashDrawerPin: 1234,
        },
      },
    });
    expect(updateMoreSettings.statusCode).toBe(200);
    const updatedBody = JSON.parse(updateMoreSettings.payload);
    expect(updatedBody.data.product.settings).toEqual({
      printerIp: '192.168.1.100',
      autoPrintReceipt: true,
      defaultTaxRate: 7.5,
      currencySymbol: '₦',
      cashDrawerPin: 1234,
    });

    // 8. DELETE /api/v1/orgs/products/inventory -> Uninstall inventory app
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/orgs/products/inventory',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deleteRes.statusCode).toBe(200);
    const deleteBody = JSON.parse(deleteRes.payload);
    expect(deleteBody.data.products).toHaveLength(2);
    expect(deleteBody.data.products.map((p: any) => p.product_key)).not.toContain('inventory');

    await app.close();
  }, 35000);
});
