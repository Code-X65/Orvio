import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ProductService } from './products-service.js';
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  listProductsQuerySchema,
  searchProductsQuerySchema,
  deleteProductQuerySchema,
  updateProductImageSchema,
  reorderProductImagesSchema,
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
      const userId = request.auth?.user?.id ?? request.auth?.claims?.sub ?? null;
      const body = createProductSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const product = await service.createProduct(orgId, body, userId);
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

      const userId = request.auth?.user?.id ?? null;
      const product = await service.updateProduct(orgId, id, { ...body, ...(userId ? { userId } : {}) });
      return sendData(reply, { product }, 200);
    }
  );

  // GET /products/:id/price-history — get price change audit trail
  app.get(
    '/:id/price-history',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Get chronological price change history log for a product',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const history = await service.getPriceHistory(orgId, id);
      return sendData(reply, { history }, 200);
    }
  );

  // GET /products/:id/usage — check stock levels and variants before deletion
  app.get(
    '/:id/usage',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Inspect stock levels and variants for a product before deletion',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const usage = await service.getProductUsage(orgId, id);
      return sendData(reply, { usage }, 200);
    }
  );

  // DELETE /products/:id — soft-delete product with stock and reservation checks
  app.delete(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Soft-delete product from catalog after stock verification',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const userId = request.auth?.user?.id ?? request.auth?.claims?.sub;
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);

      const queryParams = deleteProductQuerySchema.safeParse(request.query);
      const bodyParams = deleteProductQuerySchema.safeParse(request.body);

      const reason = bodyParams.success && bodyParams.data.reason
        ? bodyParams.data.reason
        : queryParams.success
        ? queryParams.data.reason
        : undefined;

      const confirmWithStock =
        (bodyParams.success && bodyParams.data.confirmWithStock) ||
        (queryParams.success && queryParams.data.confirmWithStock) ||
        false;

      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const result = await service.deleteProduct(orgId, id, {
        userId,
        reason,
        confirmWithStock,
      });
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
      const userId = request.auth?.user?.id ?? request.auth?.claims?.sub ?? null;
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = createVariantSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const variant = await service.createVariant(orgId, id, body, userId);
      return sendData(reply, { variant }, 201);
    }
  );

  // PATCH /products/:id/restore — restore soft-deleted product
  app.patch(
    '/:id/restore',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Restore an archived/soft-deleted product back to active status',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const userId = request.auth?.user?.id ?? request.auth?.claims?.sub;
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const product = await service.restoreProduct(orgId, id, userId);
      return sendData(reply, { product }, 200);
    }
  );

  // PATCH /products/:productId/variants/:variantId — update variant
  app.patch(
    '/:productId/variants/:variantId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Update variant attributes, prices, or status with audit history',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const userId = request.auth?.user?.id ?? request.auth?.claims?.sub;
      const { productId, variantId } = z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1),
      }).parse(request.params);
      const body = updateVariantSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const variant = await service.updateVariant(orgId, productId, variantId, body, userId);
      return sendData(reply, { variant }, 200);
    }
  );

  // DELETE /products/:productId/variants/:variantId — soft-delete variant
  app.delete(
    '/:productId/variants/:variantId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Soft-delete variant with stock and reservation checks',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const userId = request.auth?.user?.id ?? request.auth?.claims?.sub;
      const { productId, variantId } = z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1),
      }).parse(request.params);

      const queryParams = deleteProductQuerySchema.safeParse(request.query);
      const bodyParams = deleteProductQuerySchema.safeParse(request.body);

      const reason = bodyParams.success && bodyParams.data.reason
        ? bodyParams.data.reason
        : queryParams.success
        ? queryParams.data.reason
        : undefined;

      const confirmWithStock =
        (bodyParams.success && bodyParams.data.confirmWithStock) ||
        (queryParams.success && queryParams.data.confirmWithStock) ||
        false;

      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const result = await service.deleteVariant(orgId, productId, variantId, {
        userId,
        reason,
        confirmWithStock,
      });
      return sendData(reply, result, 200);
    }
  );

  // GET /products/:productId/variants/:variantId/price-history — variant price change history
  app.get(
    '/:productId/variants/:variantId/price-history',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Get chronological price change history log for a variant',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { productId, variantId } = z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1),
      }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const history = await service.getVariantPriceHistory(orgId, productId, variantId);
      return sendData(reply, { history }, 200);
    }
  );

  // POST /products/:productId/images — upload product images
  app.post(
    '/:productId/images',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Upload 1-5 product images',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { productId } = z.object({ productId: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const files: Array<{ buffer: Buffer; filename?: string; mimeType: string }> = [];
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          files.push({
            buffer,
            filename: part.filename,
            mimeType: part.mimetype,
          });
        }
      }

      if (files.length === 0) {
        throw new AppError('VALIDATION_ERROR', 'No image files uploaded', 400);
      }

      const images = await service.uploadProductImages(orgId, productId, files);
      return sendData(reply, { images }, 201);
    }
  );

  // GET /products/:productId/images — list product images
  app.get(
    '/:productId/images',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'List images for a product',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { productId } = z.object({ productId: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const images = await service.listProductImages(orgId, productId);
      return sendData(reply, { images }, 200);
    }
  );

  // PATCH /products/:productId/images/reorder — reorder images
  app.patch(
    '/:productId/images/reorder',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Reorder product images and update primary flag',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { productId } = z.object({ productId: z.string().min(1) }).parse(request.params);
      const body = reorderProductImagesSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const images = await service.reorderProductImages(orgId, productId, body.images);
      return sendData(reply, { images }, 200);
    }
  );

  // PATCH /products/:productId/images/:imageId — update alt text or primary
  app.patch(
    '/:productId/images/:imageId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Update alt text or primary flag for a product image',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { imageId } = z.object({
        productId: z.string().min(1),
        imageId: z.string().min(1),
      }).parse(request.params);
      const body = updateProductImageSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const image = await service.updateProductImage(orgId, imageId, body);
      return sendData(reply, { image }, 200);
    }
  );

  // DELETE /products/:productId/images/:imageId — delete product image
  app.delete(
    '/:productId/images/:imageId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Delete image record and its files from storage',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { imageId } = z.object({
        productId: z.string().min(1),
        imageId: z.string().min(1),
      }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const result = await service.deleteProductImage(orgId, imageId);
      return sendData(reply, result, 200);
    }
  );

  // POST /products/:productId/variants/:variantId/images — upload variant images
  app.post(
    '/:productId/variants/:variantId/images',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'Upload images for a specific product variant',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { productId, variantId } = z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1),
      }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const files: Array<{ buffer: Buffer; filename?: string; mimeType: string }> = [];
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          files.push({
            buffer,
            filename: part.filename,
            mimeType: part.mimetype,
          });
        }
      }

      if (files.length === 0) {
        throw new AppError('VALIDATION_ERROR', 'No image files uploaded', 400);
      }

      const images = await service.uploadProductImages(orgId, productId, files, variantId);
      return sendData(reply, { images }, 201);
    }
  );

  // GET /products/:variantId/variant-images — get variant images (with parent fallback)
  app.get(
    '/:variantId/variant-images',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Products'],
        summary: 'List variant images with fallback to parent images',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { variantId } = z.object({ variantId: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new ProductService(db);

      const result = await service.listVariantImages(orgId, variantId);
      return sendData(reply, result, 200);
    }
  );
}
