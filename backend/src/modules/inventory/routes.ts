import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { InventoryOnboardingService } from './service.js';
import { inventoryBranchSetupSchema, saveOnboardingDraftSchema } from './schemas.js';
import { categoryRoutes } from './categories-routes.js';
import { productRoutes } from './products-routes.js';
import { branchRoutes } from './branches-routes.js';
import { brandRoutes } from './brands-routes.js';
import { catalogRoutes } from './catalog-routes.js';
import { stockRoutes } from './stock-routes.js';
import { supplierRoutes } from './suppliers-routes.js';
import { stockReceiptRoutes } from './stock-receipts-routes.js';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { sendData } from '../../lib/envelope.js';
import { AppError } from '../../lib/errors.js';

export async function inventoryRoutes(app: FastifyInstance) {
  // Register branch management routes under /branches
  app.register(branchRoutes, { prefix: '/branches' });

  // Register category management routes under /categories
  app.register(categoryRoutes, { prefix: '/categories' });

  // Register brand management routes under /brands
  app.register(brandRoutes, { prefix: '/brands' });

  // Register catalog management routes under /catalog
  app.register(catalogRoutes, { prefix: '/catalog' });

  // Register product management routes under /products
  app.register(productRoutes, { prefix: '/products' });

  // Register supplier management routes under /suppliers
  app.register(supplierRoutes, { prefix: '/suppliers' });

  // Register stock management routes under /stock
  app.register(stockRoutes);
  app.register(stockReceiptRoutes, { prefix: '/stock' });

  // GET /api/v1/inventory/onboarding/status
  app.get(
    '/onboarding/status',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory'],
        summary: 'Get inventory onboarding and branch setup status for active tenant',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.auth?.organization?.id ?? request.auth?.claims?.org_id;
      if (!orgId) {
        throw new AppError('ORGANIZATION_NOT_FOUND', 'No active organization found in session', 404);
      }

      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new InventoryOnboardingService(db);
      const status = await service.getStatus(orgId);

      return sendData(reply, status, 200);
    }
  );

  // PUT /api/v1/inventory/onboarding/draft
  app.put(
    '/onboarding/draft',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory'],
        summary: 'Save in-progress onboarding step data',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.auth?.organization?.id ?? request.auth?.claims?.org_id;
      const userId = request.auth?.user?.id ?? request.auth?.claims?.sub;

      if (!orgId || !userId) {
        throw new AppError('UNAUTHORIZED', 'Authentication credentials and organization context required', 401);
      }

      const body = saveOnboardingDraftSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new InventoryOnboardingService(db);

      const result = await service.saveDraft(orgId, userId, body);
      return sendData(reply, result, 200);
    }
  );

  // POST /api/v1/inventory/onboarding/setup
  app.post(
    '/onboarding/setup',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory'],
        summary: 'Complete initial branch setup and mark inventory onboarding completed',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.auth?.organization?.id ?? request.auth?.claims?.org_id;
      const userId = request.auth?.user?.id ?? request.auth?.claims?.sub;

      if (!orgId || !userId) {
        throw new AppError('UNAUTHORIZED', 'Authentication credentials and organization context required', 401);
      }

      const body = inventoryBranchSetupSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new InventoryOnboardingService(db);

      const result = await service.completeBranchSetup(orgId, userId, body);
      return sendData(reply, result, 201);
    }
  );
}
