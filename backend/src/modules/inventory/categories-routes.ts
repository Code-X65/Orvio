import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CategoryService } from './categories-service.js';
import {
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
  listCategoriesQuerySchema,
} from './categories-schemas.js';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { sendData } from '../../lib/envelope.js';
import { AppError } from '../../lib/errors.js';
import { z } from 'zod';

const seedSchema = z.object({
  businessType: z.string().optional(),
});

function getOrgId(request: FastifyRequest): string {
  const orgId = request.auth?.organization?.id ?? request.auth?.claims?.org_id;
  if (!orgId) {
    throw new AppError('ORGANIZATION_NOT_FOUND', 'No active organization found in session', 404);
  }
  return orgId;
}

export async function categoryRoutes(app: FastifyInstance) {
  // GET /categories
  app.get(
    '/',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Categories'],
        summary: 'List hierarchical category tree for current organization',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const query = listCategoriesQuerySchema.parse(request.query);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new CategoryService(db);

      const tree = await service.getCategoryTree(orgId, {
        activeOnly: query.activeOnly,
        parentId: query.parentId,
        includeInactive: query.includeInactive,
      });

      return sendData(reply, { categories: tree }, 200);
    }
  );

  // POST /categories/seed
  app.post(
    '/seed',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Categories'],
        summary: 'Seed default starter categories for current organization',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const body = seedSchema.parse(request.body ?? {});
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new CategoryService(db);

      // If businessType wasn't passed in body, try to check org's saved business_type or onboarding step data
      let businessType = body.businessType;
      if (!businessType) {
        const org = await db.organization.findUnique({
          where: { id: orgId },
          include: { inventory_onboarding: true },
        });
        const onboardingStepData = org?.inventory_onboarding?.step_data as { businessType?: string } | null;
        businessType = onboardingStepData?.businessType || org?.business_type || undefined;
      }

      const result = await service.seedDefaultCategories(orgId, businessType);
      return sendData(reply, result, 201);
    }
  );

  // PATCH /categories/reorder
  app.patch(
    '/reorder',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Categories'],
        summary: 'Reorder sibling categories by position',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const body = reorderCategoriesSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new CategoryService(db);

      const updated = await service.reorderCategories(orgId, body.parentId, body.categoryIds);
      return sendData(reply, { categories: updated }, 200);
    }
  );

  // GET /categories/:id
  app.get(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Categories'],
        summary: 'Get single category details with path and direct children count',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new CategoryService(db);

      const category = await service.getCategoryById(orgId, id);
      return sendData(reply, { category }, 200);
    }
  );

  // POST /categories
  app.post(
    '/',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Categories'],
        summary: 'Create a new inventory category',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const body = createCategorySchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new CategoryService(db);

      const category = await service.createCategory(orgId, body);
      return sendData(reply, { category }, 201);
    }
  );

  // PUT /categories/:id
  app.put(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Categories'],
        summary: 'Update category details',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = updateCategorySchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new CategoryService(db);

      const category = await service.updateCategory(orgId, id, body);
      return sendData(reply, { category }, 200);
    }
  );

  // DELETE /categories/:id
  app.delete(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Categories'],
        summary: 'Delete category if it has no child categories',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new CategoryService(db);

      const result = await service.deleteCategory(orgId, id);
      return sendData(reply, result, 200);
    }
  );

  // PATCH /categories/:id/toggle-status
  app.patch(
    '/:id/toggle-status',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Categories'],
        summary: 'Toggle active status of a category',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new CategoryService(db);

      const category = await service.toggleCategoryStatus(orgId, id);
      return sendData(reply, { category }, 200);
    }
  );
}
