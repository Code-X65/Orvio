import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BrandService } from './brands-service.js';
import {
  createBrandSchema,
  updateBrandSchema,
  deleteBrandQuerySchema,
  listBrandsQuerySchema,
} from './brands-schemas.js';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { sendData } from '../../lib/envelope.js';
import { AppError } from '../../lib/errors.js';
import { z } from 'zod';

function getOrgId(request: FastifyRequest): string {
  const orgId = request.auth?.organization?.id ?? request.auth?.claims?.org_id;
  if (!orgId) {
    throw new AppError('ORGANIZATION_NOT_FOUND', 'No active organization found in session', 404);
  }
  return orgId;
}

function getUserId(request: FastifyRequest): string {
  const userId = request.auth?.user?.id ?? request.auth?.claims?.sub;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication credentials required', 401);
  }
  return userId;
}

export async function brandRoutes(app: FastifyInstance) {
  // GET /brands - list brands
  app.get(
    '/',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Brands'],
        summary: 'List brands for current organization',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const query = listBrandsQuerySchema.parse(request.query);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new BrandService(db);

      const result = await service.listBrands(orgId, query);
      return sendData(reply, result, 200);
    }
  );

  // POST /brands - create brand
  app.post(
    '/',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Brands'],
        summary: 'Create a new brand',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const body = createBrandSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new BrandService(db);

      const brand = await service.createBrand(orgId, body);
      return sendData(reply, { brand }, 201);
    }
  );

  // GET /brands/:id - get brand detail
  app.get(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Brands'],
        summary: 'Get brand by ID',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id: brandId } = z.object({ id: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new BrandService(db);

      const brand = await service.getBrand(orgId, brandId);
      return sendData(reply, { brand }, 200);
    }
  );

  // PATCH /brands/:id - update brand
  app.patch(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Brands'],
        summary: 'Update brand by ID',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id: brandId } = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = updateBrandSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new BrandService(db);

      const brand = await service.updateBrand(orgId, brandId, body);
      return sendData(reply, { brand }, 200);
    }
  );

  // DELETE /brands/:id - soft delete brand
  app.delete(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Brands'],
        summary: 'Soft-delete a brand with optional product reassignment',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const userId = getUserId(request);
      const { id: brandId } = z.object({ id: z.string().min(1) }).parse(request.params);
      const options = deleteBrandQuerySchema.parse(request.query ?? {});
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new BrandService(db);

      const result = await service.deleteBrand(orgId, brandId, userId, options);
      return sendData(reply, result, 200);
    }
  );

  // PATCH /brands/:id/restore - restore brand
  app.patch(
    '/:id/restore',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Brands'],
        summary: 'Restore a soft-deleted brand',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id: brandId } = z.object({ id: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new BrandService(db);

      const brand = await service.restoreBrand(orgId, brandId);
      return sendData(reply, { brand }, 200);
    }
  );

  // GET /brands/:id/products - list brand products
  app.get(
    '/:id/products',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Brands'],
        summary: 'List products associated with this brand',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id: brandId } = z.object({ id: z.string().min(1) }).parse(request.params);
      const querySchema = z.object({
        page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
        limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
      });
      const query = querySchema.parse(request.query ?? {});
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new BrandService(db);

      const result = await service.listBrandProducts(orgId, brandId, query.page, query.limit);
      return sendData(reply, result, 200);
    }
  );
}
