import { afterAll, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { orgRoutes } from '../../src/modules/organizations/routes.js';
import { errorHandler } from '../../src/middleware/error-handler.js';
import { signAccessToken } from '../../src/lib/tokens.js';
import type { PrismaClient } from '@prisma/client';

const mockPrisma = {
  user: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      if (where.id === 'usr_active') {
        return {
          id: 'usr_active',
          email: 'active@company.com',
          status: 'active',
          email_verified_at: new Date(),
          memberships: [
            {
              id: 'mem_1',
              org_id: 'org_active',
              role: 'owner',
              organization: {
                id: 'org_active',
                name: 'Apex Supermarket',
                subdomain: 'apexsupermarket',
                status: 'active',
              },
            },
          ],
        };
      }
      if (where.id === 'usr_unverified') {
        return {
          id: 'usr_unverified',
          email: 'unverified@company.com',
          status: 'active',
          email_verified_at: null,
          memberships: [
            {
              id: 'mem_2',
              org_id: 'org_pending',
              role: 'owner',
              organization: {
                id: 'org_pending',
                name: 'Pending Store',
                subdomain: 'pendingstore',
                status: 'pending',
              },
            },
          ],
        };
      }
      if (where.id === 'usr_pending_org') {
        return {
          id: 'usr_pending_org',
          email: 'verified_pending_org@company.com',
          status: 'active',
          email_verified_at: new Date(),
          memberships: [
            {
              id: 'mem_3',
              org_id: 'org_pending',
              role: 'owner',
              organization: {
                id: 'org_pending',
                name: 'Pending Store',
                subdomain: 'pendingstore',
                status: 'pending',
              },
            },
          ],
        };
      }
      return null;
    },
  },
  organization: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      if (where.id === 'org_active') {
        return {
          id: 'org_active',
          name: 'Apex Supermarket',
          subdomain: 'apexsupermarket',
          status: 'active',
          plan_code: 'bundle',
          timezone: 'Africa/Lagos',
          currency: 'NGN',
          created_at: new Date(),
          updated_at: new Date(),
          branches: [
            {
              id: 'branch_1',
              org_id: 'org_active',
              name: 'Main Store',
              type: 'store',
              status: 'active',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        };
      }
      return null;
    },
  },
  membership: {
    findFirst: async ({ where }: { where: { org_id: string; user_id: string } }) => {
      if (where.org_id === 'org_active' && where.user_id === 'usr_active') {
        return {
          id: 'mem_1',
          org_id: 'org_active',
          user_id: 'usr_active',
          role: 'owner',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        };
      }
      return null;
    },
  },
} as unknown as PrismaClient;

const testApp = Fastify();
testApp.decorate('prisma', mockPrisma);
testApp.setErrorHandler(errorHandler);
testApp.register(orgRoutes, { prefix: '/api/v1/orgs' });

afterAll(async () => {
  await testApp.close();
});

describe('GET /api/v1/orgs/me Endpoint', () => {
  it('returns 401 UNAUTHORIZED when no authorization header is sent', async () => {
    const response = await testApp.inject({
      method: 'GET',
      url: '/api/v1/orgs/me',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 EMAIL_NOT_VERIFIED when user email is unverified', async () => {
    const token = await signAccessToken({
      sub: 'usr_unverified',
      email: 'unverified@company.com',
      org_id: 'org_pending',
    });

    const response = await testApp.inject({
      method: 'GET',
      url: '/api/v1/orgs/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('returns 403 ORG_PENDING when organization is pending activation', async () => {
    const token = await signAccessToken({
      sub: 'usr_pending_org',
      email: 'verified_pending_org@company.com',
      org_id: 'org_pending',
    });

    const response = await testApp.inject({
      method: 'GET',
      url: '/api/v1/orgs/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ORG_PENDING');
  });

  it('returns 200 with organization, membership, and branch details for active verified tenant', async () => {
    const token = await signAccessToken({
      sub: 'usr_active',
      email: 'active@company.com',
      org_id: 'org_active',
      role: 'owner',
    });

    const response = await testApp.inject({
      method: 'GET',
      url: '/api/v1/orgs/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.status).toBe('success');
    expect(json.data.organization).toBeDefined();
    expect(json.data.organization.name).toBe('Apex Supermarket');
    expect(json.data.organization.subdomain).toBe('apexsupermarket');
    expect(json.data.organization.url).toBeDefined();
    expect(json.data.membership.role).toBe('owner');
    expect(json.data.branch.name).toBe('Main Store');
    expect(json.data.branch.type).toBe('store');
  });
});
