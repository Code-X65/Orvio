import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { OrgService } from './service.js';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireActiveOrg } from '../../middleware/tenant-guard.js';
import { sendData } from '../../lib/envelope.js';
import { AppError } from '../../lib/errors.js';
import { AUTH_RATE_LIMITS } from '../auth/rate-limiter.js';

const checkSubdomainQuerySchema = z.object({
  subdomain: z.string().min(1, 'Subdomain query param is required'),
});

export async function orgRoutes(app: FastifyInstance) {
  // Public check subdomain endpoint with rate limit & Swagger documentation
  app.get(
    '/check-subdomain',
    {
      config: {
        rateLimit: AUTH_RATE_LIMITS.checkSubdomain,
      },
      schema: {
        tags: ['Organizations'],
        summary: 'Check subdomain availability',
        description:
          'Validates subdomain format, checks against reserved words, queries database uniqueness, and generates candidate suggestions if unavailable.',
        querystring: {
          type: 'object',
          required: ['subdomain'],
          properties: {
            subdomain: {
              type: 'string',
              description: 'Target tenant subdomain slug (3-30 lowercase alphanumeric characters)',
              examples: ['acmestore', 'apexsupermarket'],
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', examples: ['success'] },
              data: {
                type: 'object',
                properties: {
                  available: { type: 'boolean', examples: [true] },
                  subdomain: { type: 'string', examples: ['acmestore'] },
                  reason: {
                    type: 'string',
                    enum: ['TOO_SHORT', 'TOO_LONG', 'INVALID_CHARACTERS', 'RESERVED', 'ALREADY_TAKEN'],
                  },
                  suggestions: {
                    type: 'array',
                    items: { type: 'string' },
                    examples: [['acmestoreapp', 'acmestorehq', 'acmestorehub']],
                  },
                },
              },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const orgService = new OrgService(db);
      const query = checkSubdomainQuerySchema.parse(request.query);
      const result = await orgService.findAvailability(query.subdomain);
      return sendData(reply, result, 200);
    }
  );

  // Public tenant info lookup by subdomain
  app.get(
    '/public/:subdomain',
    {
      config: {
        rateLimit: AUTH_RATE_LIMITS.checkSubdomain,
      },
      schema: {
        tags: ['Organizations'],
        summary: 'Get public workspace information by subdomain',
        description: 'Returns whether the workspace exists and public branding name for login / tenant validation.',
        params: {
          type: 'object',
          required: ['subdomain'],
          properties: {
            subdomain: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { subdomain } = z.object({ subdomain: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const orgService = new OrgService(db);
      const info = await orgService.getPublicOrgInfo(subdomain);
      return sendData(reply, info, 200);
    }
  );

  // Authenticated tenant details endpoint behind requireAuth and requireActiveOrg
  app.get(
    '/me',
    {
      preHandler: [requireAuth, requireActiveOrg],
      schema: {
        tags: ['Organizations'],
        summary: 'Get current organization, membership, and branch details',
        description:
          'Returns current user active organization, role membership, and primary default store branch. Requires active organization and verified email.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', examples: ['success'] },
              data: {
                type: 'object',
                properties: {
                  organization: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string', examples: ['Apex Store'] },
                      subdomain: { type: 'string', examples: ['apexstore'] },
                      status: { type: 'string', examples: ['active'] },
                      timezone: { type: 'string', examples: ['Africa/Lagos'] },
                      currency: { type: 'string', examples: ['NGN'] },
                      plan_code: { type: 'string', examples: ['bundle'] },
                      url: { type: 'string', examples: ['http://apexstore.localhost:4000'] },
                      created_at: { type: 'string' },
                      updated_at: { type: 'string' },
                    },
                  },
                  membership: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      id: { type: 'string' },
                      role: { type: 'string', examples: ['owner'] },
                      status: { type: 'string', examples: ['active'] },
                      created_at: { type: 'string' },
                    },
                  },
                  branch: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string', examples: ['Main Store'] },
                      type: { type: 'string', examples: ['store'] },
                      status: { type: 'string', examples: ['active'] },
                    },
                  },
                  branches: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        type: { type: 'string' },
                        status: { type: 'string' },
                      },
                    },
                  },
                  products: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        org_id: { type: 'string' },
                        product_key: { type: 'string' },
                        status: { type: 'string' },
                        is_primary: { type: 'boolean' },
                        settings: { type: 'object', nullable: true },
                        created_at: { type: 'string' },
                        updated_at: { type: 'string' },
                      },
                    },
                  },
                },
              },
              requestId: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              status: { type: 'string', examples: ['error'] },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string', examples: ['UNAUTHORIZED'] },
                  message: { type: 'string' },
                },
              },
            },
          },
          403: {
            type: 'object',
            properties: {
              status: { type: 'string', examples: ['error'] },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string', examples: ['ORG_PENDING'] },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = request.auth;
      const orgId = auth?.organization?.id ?? auth?.claims?.org_id;
      const userId = auth?.user?.id ?? auth?.claims?.sub;

      if (!orgId || !userId) {
        throw new AppError('ORGANIZATION_NOT_FOUND', 'No organization associated with this session', 404);
      }

      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const orgService = new OrgService(db);
      const details = await orgService.getOrganizationDetails(orgId, userId);
      return sendData(
        reply,
        {
          organization: details.organization,
          membership: details.membership,
          branch: details.branch,
          branches: details.branches,
          products: details.products,
        },
        200
      );
    }
  );

  // POST /products: Install a new product module
  app.post(
    '/products',
    {
      preHandler: [requireAuth, requireActiveOrg],
      schema: {
        tags: ['Organizations'],
        summary: 'Install an application module in the workspace',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.auth?.organization?.id ?? request.auth?.claims?.org_id;
      if (!orgId) {
        throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);
      }

      const body = z.object({ productKey: z.string().min(1) }).parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const orgService = new OrgService(db);
      const products = await orgService.addProduct(orgId, body.productKey);
      return sendData(reply, { products }, 200);
    }
  );

  // DELETE /products/:productKey: Uninstall a product module
  app.delete(
    '/products/:productKey',
    {
      preHandler: [requireAuth, requireActiveOrg],
      schema: {
        tags: ['Organizations'],
        summary: 'Uninstall an application module from the workspace',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.auth?.organization?.id ?? request.auth?.claims?.org_id;
      if (!orgId) {
        throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);
      }

      const { productKey } = z.object({ productKey: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const orgService = new OrgService(db);
      const products = await orgService.removeProduct(orgId, productKey);
      return sendData(reply, { products }, 200);
    }
  );

  // PATCH /products/:productKey/primary: Set an installed app as primary default
  app.patch(
    '/products/:productKey/primary',
    {
      preHandler: [requireAuth, requireActiveOrg],
      schema: {
        tags: ['Organizations'],
        summary: 'Set an application as the primary default for the workspace',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.auth?.organization?.id ?? request.auth?.claims?.org_id;
      if (!orgId) {
        throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);
      }

      const { productKey } = z.object({ productKey: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const orgService = new OrgService(db);
      const products = await orgService.setPrimaryProduct(orgId, productKey);
      return sendData(reply, { products }, 200);
    }
  );

  // PATCH /products/:productKey/settings: Update per-app JSON configuration settings
  app.patch(
    '/products/:productKey/settings',
    {
      preHandler: [requireAuth, requireActiveOrg],
      schema: {
        tags: ['Organizations'],
        summary: 'Update application-specific configuration settings',
        description: 'Deep-merges new JSON configuration settings into the workspace product settings column.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['productKey'],
          properties: {
            productKey: { type: 'string', description: 'Application identifier (e.g., pos, gym, whatsapp, invoicing)' },
          },
        },
        body: {
          type: 'object',
          required: ['settings'],
          properties: {
            settings: { type: 'object', description: 'App-specific configuration parameters' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.auth?.organization?.id ?? request.auth?.claims?.org_id;
      if (!orgId) {
        throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);
      }

      const { productKey } = z.object({ productKey: z.string().min(1) }).parse(request.params);
      const { settings } = z.object({ settings: z.record(z.any()) }).parse(request.body);

      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const orgService = new OrgService(db);
      const updatedProduct = await orgService.updateProductSettings(orgId, productKey, settings);
      return sendData(reply, { product: updatedProduct }, 200);
    }
  );
}
