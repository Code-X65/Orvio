import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'node:crypto';
import { StockService } from './stock-service.js';
import {
  stockSummaryQuerySchema,
  stockListQuerySchema,
  stockMovementsQuerySchema,
  recordOpeningStockSchema,
  receiveStockSchema,
  adjustStockSchema,
  transferStockSchema,
} from './stock-schemas.js';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { sendData } from '../../lib/envelope.js';
import { AppError } from '../../lib/errors.js';

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

export async function stockRoutes(app: FastifyInstance) {
  // GET /stock/summary
  app.get(
    '/stock/summary',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Stock Management'],
        summary: 'Get stock aggregate metrics (in stock, low stock, out of stock, totals)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const query = stockSummaryQuerySchema.parse(request.query ?? {});
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StockService(db);

      const result = await service.getStockSummary(orgId, query);
      return sendConditionalData(request, reply, result);
    }
  );

  // GET /stock/items
  app.get(
    '/stock/items',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Stock Management'],
        summary: 'List paginated product stock levels with availability and status',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const query = stockListQuerySchema.parse(request.query ?? {});
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StockService(db);

      const result = await service.listStockItems(orgId, query);
      return sendConditionalData(request, reply, result);
    }
  );

  // GET /stock/movements
  app.get(
    '/stock/movements',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Stock Management'],
        summary: 'List append-only stock movement ledger history with filters',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const query = stockMovementsQuerySchema.parse(request.query ?? {});
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StockService(db);

      const result = await service.listStockMovements(orgId, query);
      return sendConditionalData(request, reply, result);
    }
  );

  // POST /stock/opening
  app.post(
    '/stock/opening',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Stock Management'],
        summary: 'Record initial opening stock balance for a product at a branch',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const userId = getUserId(request);
      const payload = recordOpeningStockSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StockService(db);

      const result = await service.recordOpeningStock(orgId, userId, payload);
      return sendData(reply, result, 201);
    }
  );

  // POST /stock/receive
  app.post(
    '/stock/receive',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Stock Management'],
        summary: 'Receive stock replenishment at a branch without requiring formal purchase orders',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const userId = getUserId(request);
      const payload = receiveStockSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StockService(db);

      const result = await service.receiveStock(orgId, userId, payload);
      return sendData(reply, result, 201);
    }
  );

  // POST /stock/adjust
  app.post(
    '/stock/adjust',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Stock Management'],
        summary: 'Perform manual stock adjustment (delta or counted) with reason code',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const userId = getUserId(request);
      const payload = adjustStockSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StockService(db);

      const result = await service.adjustStock(orgId, userId, payload);
      return sendData(reply, result, 200);
    }
  );

  // POST /stock/transfer
  app.post(
    '/stock/transfer',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Stock Management'],
        summary: 'Transfer stock atomically between two distinct branches in the organization',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const userId = getUserId(request);
      const payload = transferStockSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StockService(db);

      const result = await service.transferStock(orgId, userId, payload);
      return sendData(reply, result, 200);
    }
  );
}
