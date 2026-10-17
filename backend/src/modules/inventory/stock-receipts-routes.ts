import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StockReceiptService } from './stock-receipts-service.js';
import {
  createStockReceiptSchema,
  listStockReceiptsQuerySchema,
} from './stock-receipts-schemas.js';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { sendData } from '../../lib/envelope.js';
import { AppError } from '../../lib/errors.js';

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

function enforceReceiptCreatePermission(request: FastifyRequest): void {
  const membership = request.auth?.membership;
  const productRoles = (membership as any)?.product_roles as Record<string, string> | undefined;
  const invRole = productRoles?.inventory;

  // Cashier check
  if (invRole === 'cashier') {
    throw new AppError('FORBIDDEN', 'Cashiers are not permitted to receive stock', 403);
  }
}

function enforceReceiptViewPermission(request: FastifyRequest): void {
  const membership = request.auth?.membership;
  const productRoles = (membership as any)?.product_roles as Record<string, string> | undefined;
  const invRole = productRoles?.inventory;

  if (invRole === 'cashier') {
    throw new AppError('FORBIDDEN', 'Cashiers are not permitted to view receipt history or cost details', 403);
  }
}

export async function stockReceiptRoutes(app: FastifyInstance) {
  // GET /stock/receipts - List receipts
  app.get(
    '/receipts',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Stock Receipts'],
        summary: 'List paginated stock replenishment receipts with filters',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      enforceReceiptViewPermission(request);
      const orgId = getOrgId(request);
      const query = listStockReceiptsQuerySchema.parse(request.query ?? {});
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StockReceiptService(db);

      const result = await service.listReceipts(orgId, query);
      return sendData(reply, result, 200);
    }
  );

  // POST /stock/receipts - Create stock receipt
  app.post(
    '/receipts',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Stock Receipts'],
        summary: 'Receive stock delivery from supplier atomically',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      enforceReceiptCreatePermission(request);
      const orgId = getOrgId(request);
      const userId = getUserId(request);
      const body = createStockReceiptSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StockReceiptService(db);

      const result = await service.createReceipt(orgId, userId, body);
      return sendData(reply, result, 201);
    }
  );

  // GET /stock/receipts/:id - Get stock receipt detail
  app.get(
    '/receipts/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Stock Receipts'],
        summary: 'Get stock receipt detail with lines and movements',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      enforceReceiptViewPermission(request);
      const orgId = getOrgId(request);
      const { id } = request.params as { id: string };
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StockReceiptService(db);

      const result = await service.getReceiptById(orgId, id);
      return sendData(reply, result, 200);
    }
  );
}
