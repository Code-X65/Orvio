import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ProductService } from './products-service.js';
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  listProductsQuerySchema,
  searchProductsQuerySchema,
} from './products-schemas.js';
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

export async function productRoutes(app: FastifyInstance) {
  // GET /products/search — quick search by name/SKU/barcode
  app.get(
    '/search',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Lightweight product lookup by barcode, SKU, or name',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const query = searchProductsQuerySchema.parse(request.query);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const results = await service.searchProducts(orgId, query);
      return sendData(reply, { results }, 200);
    }
  );

  // GET /products — list products with pagination and filters
  app.get(
    '/',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'List products with filtering, search, pagination, and aggregated stock',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const query = listProductsQuerySchema.parse(request.query);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const data = await service.listProducts(orgId, query);
      return sendData(reply, data, 200);
    }
  );

  // GET /products/:id — single product details
  app.get(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Get single product details with per-branch stock levels and variants',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const data = await service.getProductById(orgId, id);
      return sendData(reply, data, 200);
    }
  );

  // POST /products — create a new product
  app.post(
    '/',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Create a new catalog product',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const body = createProductSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const product = await service.createProduct(orgId, body);
      return sendData(reply, { product }, 201);
    }
  );

  // PATCH /products/:id — partial product update
  app.patch(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Update product properties',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = updateProductSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const product = await service.updateProduct(orgId, id, body);
      return sendData(reply, { product }, 200);
    }
  );

  // DELETE /products/:id — soft-delete product
  app.delete(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Soft-delete product from catalog',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const result = await service.deleteProduct(orgId, id);
      return sendData(reply, result, 200);
    }
  );

  // PATCH /products/:id/toggle-status — toggle active status
  app.patch(
    '/:id/toggle-status',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Toggle active status of a product',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const product = await service.toggleProductStatus(orgId, id);
      return sendData(reply, { product }, 200);
    }
  );

  // POST /products/:id/variants — create a variant for a template product
  app.post(
    '/:id/variants',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Create variant for a product with has_variants enabled',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = createVariantSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const variant = await service.createVariant(orgId, id, body);
      return sendData(reply, { variant }, 201);
    }
  );
}
