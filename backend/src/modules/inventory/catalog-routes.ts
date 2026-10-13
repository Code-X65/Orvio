import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'node:crypto';
import { CatalogService } from './catalog-service.js';
import {
  assignProductSchema,
  removeProductSchema,
  importCatalogSchema,
  importPreviewSchema,
  listBranchProductsQuerySchema,
} from './catalog-schemas.js';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { sendData } from '../../lib/envelope.js';
import { AppError } from '../../lib/errors.js';
import { z } from 'zod';

function computeEtag(data: unknown): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = createHash('sha1').update(content).digest('hex').slice(0, 16);
  return `W/"${hash}"`;
}

function sendConditionalData<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  data: T
) {
  const etag = computeEtag(data);
  reply.header('ETag', etag);
  reply.header('Cache-Control', 'private, no-cache');

  const ifNoneMatch = request.headers['if-none-match'];
  if (ifNoneMatch) {
    const cleanIfNoneMatch = ifNoneMatch.replace(/^W\//, '');
    const cleanEtag = etag.replace(/^W\//, '');
    if (cleanIfNoneMatch === cleanEtag || ifNoneMatch === '*') {
      return reply.status(304).send();
    }
  }

  return sendData(reply, data, 200);
}

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

export async function catalogRoutes(app: FastifyInstance) {
  // GET /catalog/branches/:branchId/products
  app.get(
    '/branches/:branchId/products',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Branch Catalog'],
        summary: 'List products assigned to branch catalog',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { branchId } = z.object({ branchId: z.string().min(1) }).parse(request.params);
      const query = listBranchProductsQuerySchema.parse(request.query);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new CatalogService(db);

      const result = await service.listBranchProducts(orgId, branchId, query);
      return sendConditionalData(request, reply, result);
    }
  );

  // POST /catalog/branches/:branchId/products
  app.post(
    '/branches/:branchId/products',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Branch Catalog'],
        summary: 'Assign a product to branch catalog',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const userId = getUserId(request);
      const { branchId } = z.object({ branchId: z.string().min(1) }).parse(request.params);
      const body = assignProductSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new CatalogService(db);

      const result = await service.assignProductToBranch(orgId, branchId, body.productId, userId, body.notes);
      return sendData(reply, { assignment: result }, 201);
    }
  );

  // DELETE /catalog/branches/:branchId/products/:productId
  app.delete(
    '/branches/:branchId/products/:productId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Branch Catalog'],
        summary: 'Remove product from branch catalog (marks excluded)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const userId = getUserId(request);
      const { branchId, productId } = z
        .object({ branchId: z.string().min(1), productId: z.string().min(1) })
        .parse(request.params);
      const body = removeProductSchema.parse(request.query ?? {});
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new CatalogService(db);

      const result = await service.removeProductFromBranch(orgId, branchId, productId, userId, body.reason);
      return sendData(reply, result, 200);
    }
  );

  // POST /catalog/branches/:branchId/products/:productId/restore
  app.post(
    '/branches/:branchId/products/:productId/restore',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Branch Catalog'],
        summary: 'Restore an excluded product back to branch catalog',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { branchId, productId } = z
        .object({ branchId: z.string().min(1), productId: z.string().min(1) })
        .parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new CatalogService(db);

      const result = await service.restoreProductToBranch(orgId, branchId, productId);
      return sendData(reply, { assignment: result }, 200);
    }
  );

  // POST /catalog/branches/:branchId/import
  app.post(
    '/branches/:branchId/import',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Branch Catalog'],
        summary: 'Import catalog products from another branch',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const userId = getUserId(request);
      const { branchId: targetBranchId } = z.object({ branchId: z.string().min(1) }).parse(request.params);
      const body = importCatalogSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new CatalogService(db);

      const result = await service.importCatalog(orgId, body.sourceBranchId, targetBranchId, body, userId);
      return sendData(reply, result, 201);
    }
  );

  // POST /catalog/branches/:branchId/import-preview
  app.post(
    '/branches/:branchId/import-preview',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Branch Catalog'],
        summary: 'Preview catalog taxonomy reconciliation before importing',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { branchId: targetBranchId } = z.object({ branchId: z.string().min(1) }).parse(request.params);
      const body = importPreviewSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new CatalogService(db);

      const result = await service.previewImportTaxonomy(orgId, targetBranchId, body);
      return sendData(reply, result, 200);
    }
  );

  // GET /catalog/branches/:branchId/summary
  app.get(
    '/branches/:branchId/summary',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Branch Catalog'],
        summary: 'Get catalog statistics summary for a branch',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { branchId } = z.object({ branchId: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new CatalogService(db);

      const summary = await service.getBranchCatalogSummary(orgId, branchId);
      return sendConditionalData(request, reply, summary);
    }
  );

  // GET /catalog/imports - list import audit logs
  app.get(
    '/imports',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Branch Catalog'],
        summary: 'List catalog import history for organization',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const querySchema = z.object({
        page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
        limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
      });
      const query = querySchema.parse(request.query ?? {});
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new CatalogService(db);

      const result = await service.listCatalogImports(orgId, query.page, query.limit);
      return sendData(reply, result, 200);
    }
  );
}
