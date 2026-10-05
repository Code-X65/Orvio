import { afterAll, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { requireAuth } from '../../src/middleware/auth.js';
import { requireActiveOrg } from '../../src/middleware/tenant-guard.js';
import { errorHandler } from '../../src/middleware/error-handler.js';
import { signAccessToken } from '../../src/lib/tokens.js';
import type { PrismaClient } from '@prisma/client';

const mockPrisma = {
  user: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      if (where.id === 'active_user') {
        return {
          id: 'active_user',
          email: 'active@example.com',
          status: 'active',
          email_verified_at: new Date(),
          memberships: [
            {
              id: 'mem_1',
              org_id: 'org_1',
              role: 'owner',
              organization: {
                id: 'org_1',
                name: 'Active Org',
                subdomain: 'activeorg',
                status: 'active',
              },
            },
          ],
        };
      }
      if (where.id === 'unverified_user') {
        return {
          id: 'unverified_user',
          email: 'unverified@example.com',
          status: 'active',
          email_verified_at: null,
          memberships: [
            {
              id: 'mem_2',
              org_id: 'org_2',
              role: 'owner',
              organization: {
                id: 'org_2',
                name: 'Pending Org',
                subdomain: 'pendingorg',
                status: 'pending',
              },
            },
          ],
        };
      }
      return null;
    },
  },
} as unknown as PrismaClient;

const testApp = Fastify();
testApp.decorate('prisma', mockPrisma);
testApp.setErrorHandler(errorHandler);

testApp.get(
  '/test/protected',
  {
    preHandler: [requireAuth],
  },
  async (request) => {
    return { status: 'success', user: request.auth?.user.id };
  }
);

testApp.get(
  '/test/tenant-active',
  {
    preHandler: [requireActiveOrg],
  },
  async (request) => {
    return { status: 'success', org: request.auth?.organization?.id };
  }
);

afterAll(async () => {
  await testApp.close();
});

describe('Middleware: requireAuth & requireActiveOrg', () => {
  describe('requireAuth', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const response = await testApp.inject({
        method: 'GET',
        url: '/test/protected',
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.status).toBe('error');
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when Bearer token is invalid', async () => {
      const response = await testApp.inject({
        method: 'GET',
        url: '/test/protected',
        headers: {
          authorization: 'Bearer invalid.token.payload',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('INVALID_TOKEN');
    });

    it('authenticates successfully with valid token', async () => {
      const token = await signAccessToken({
        sub: 'active_user',
        email: 'active@example.com',
      });

      const response = await testApp.inject({
        method: 'GET',
        url: '/test/protected',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().user).toBe('active_user');
    });
  });

  describe('requireActiveOrg (Tenant Guard)', () => {
    it('rejects unverified users with 403 EMAIL_NOT_VERIFIED', async () => {
      const token = await signAccessToken({
        sub: 'unverified_user',
        email: 'unverified@example.com',
      });

      const response = await testApp.inject({
        method: 'GET',
        url: '/test/tenant-active',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('allows verified active user with active organization', async () => {
      const token = await signAccessToken({
        sub: 'active_user',
        email: 'active@example.com',
      });

      const response = await testApp.inject({
        method: 'GET',
        url: '/test/tenant-active',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().org).toBe('org_1');
    });
  });
});
