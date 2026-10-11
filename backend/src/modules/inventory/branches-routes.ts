import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BranchService } from './branches-service.js';
import {
  createBranchSchema,
  updateBranchSchema,
  listBranchesQuerySchema,
  deleteBranchQuerySchema,
} from './branches-schemas.js';
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

export async function branchRoutes(app: FastifyInstance) {
  // GET /branches - List branches
  app.get(
    '/',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Branches'],
        summary: 'List branches for current organization with stock breakdown',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const query = listBranchesQuerySchema.parse(request.query ?? {});
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new BranchService(db);

      const branches = await service.listBranches(orgId, query);
      return sendData(reply, { branches }, 200);
    }
  );

  // POST /branches - Create branch
  app.post(
    '/',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Branches'],
        summary: 'Create a new branch for the organization',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const input = createBranchSchema.parse(request.body);
      const userId = request.auth?.user?.id ?? request.auth?.claims?.sub;
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new BranchService(db);

      const branch = await service.createBranch(orgId, input, userId);
      return sendData(reply, { branch }, 201);
    }
  );

  // GET /branches/:id - Get branch details
  app.get(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Branches'],
        summary: 'Get details for a specific branch',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new BranchService(db);

      const branch = await service.getBranch(orgId, id);
      return sendData(reply, { branch }, 200);
    }
  );

  // GET /branches/:id/stock - Get stock levels for branch
  app.get(
    '/:id/stock',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Branches'],
        summary: 'Get inventory stock levels for a specific branch',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new BranchService(db);

      const stock = await service.getBranchStock(orgId, id);
      return sendData(reply, { stock }, 200);
    }
  );

  // PATCH /branches/:id - Update branch
  app.patch(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Branches'],
        summary: 'Update branch details or set as primary',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const input = updateBranchSchema.parse(request.body);
      const userId = request.auth?.user?.id ?? request.auth?.claims?.sub;
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new BranchService(db);

      const branch = await service.updateBranch(orgId, id, input, userId);
      return sendData(reply, { branch }, 200);
    }
  );

  // PATCH /branches/:id/restore - Restore soft-deleted branch
  app.patch(
    '/:id/restore',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Branches'],
        summary: 'Restore a soft-deleted branch',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new BranchService(db);

      const result = await service.restoreBranch(orgId, id);
      return sendData(reply, result, 200);
    }
  );

  // DELETE /branches/:id - Soft-delete branch
  app.delete(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Branches'],
        summary: 'Archive/soft-delete branch with stock safeguard check',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const query = deleteBranchQuerySchema.parse(request.query ?? {});
      const body = (request.body && typeof request.body === 'object')
        ? (request.body as { confirmWithStock?: boolean; reason?: string })
        : {};
      const confirmWithStock = Boolean(query.confirmWithStock || body.confirmWithStock);
      const reason = query.reason || body.reason;

      const userId = request.auth?.user?.id ?? request.auth?.claims?.sub;
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new BranchService(db);

      const result = await service.deleteBranch(orgId, id, {
        userId,
        reason,
        confirmWithStock,
      });
      return sendData(reply, result, 200);
    }
  );
}
