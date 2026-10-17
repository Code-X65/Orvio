import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SupplierService } from './suppliers-service.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  listSuppliersQuerySchema,
  checkSupplierDuplicatesSchema,
} from './suppliers-schemas.js';
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

function enforceSupplierManagePermission(request: FastifyRequest): void {
  const membership = request.auth?.membership;
  const role = membership?.role;
  const productRoles = (membership as any)?.product_roles as Record<string, string> | undefined;
  const invRole = productRoles?.inventory;

  // Cashier check
  if (invRole === 'cashier') {
    throw new AppError('FORBIDDEN', 'Cashiers are not permitted to manage suppliers', 403);
  }

  // Allow owner, admin, manager
  if (role && ['owner', 'admin', 'manager'].includes(role)) {
    return;
  }

  if (invRole && ['manager', 'owner', 'admin'].includes(invRole)) {
    return;
  }

  throw new AppError('FORBIDDEN', 'Only owners, administrators, and inventory managers can manage suppliers', 403);
}

function enforceSupplierViewPermission(request: FastifyRequest): void {
  const membership = request.auth?.membership;
  const productRoles = (membership as any)?.product_roles as Record<string, string> | undefined;
  const invRole = productRoles?.inventory;

  if (invRole === 'cashier') {
    throw new AppError('FORBIDDEN', 'Cashiers cannot view supplier directory', 403);
  }
}

export async function supplierRoutes(app: FastifyInstance) {
  // GET /suppliers - List suppliers
  app.get(
    '/',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Suppliers'],
        summary: 'List suppliers for the current organization with search and status filters',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      enforceSupplierViewPermission(request);
      const orgId = getOrgId(request);
      const query = listSuppliersQuerySchema.parse(request.query ?? {});
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new SupplierService(db);

      const result = await service.listSuppliers(orgId, query);
      return sendData(reply, result, 200);
    }
  );

  // POST /suppliers/check-duplicates - Check duplicate name or phone before/while saving
  app.post(
    '/check-duplicates',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Suppliers'],
        summary: 'Check if a supplier with matching name or phone exists',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = getOrgId(request);
      const body = checkSupplierDuplicatesSchema.parse(request.body ?? {});
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new SupplierService(db);

      const result = await service.checkDuplicates(orgId, body);
      return sendData(reply, result, 200);
    }
  );

  // POST /suppliers - Create supplier
  app.post(
    '/',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Suppliers'],
        summary: 'Create a new supplier in current organization',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      enforceSupplierManagePermission(request);
      const orgId = getOrgId(request);
      const userId = getUserId(request);
      const body = createSupplierSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new SupplierService(db);

      const result = await service.createSupplier(orgId, userId, body);
      return sendData(reply, result, 201);
    }
  );

  // GET /suppliers/:id - Get supplier by ID
  app.get(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Suppliers'],
        summary: 'Get supplier details and recent receipts',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      enforceSupplierViewPermission(request);
      const orgId = getOrgId(request);
      const { id } = request.params as { id: string };
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new SupplierService(db);

      const result = await service.getSupplierById(orgId, id);
      return sendData(reply, result, 200);
    }
  );

  // PATCH /suppliers/:id - Update supplier
  app.patch(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Suppliers'],
        summary: 'Update existing supplier',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      enforceSupplierManagePermission(request);
      const orgId = getOrgId(request);
      const { id } = request.params as { id: string };
      const body = updateSupplierSchema.parse(request.body);
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new SupplierService(db);

      const result = await service.updateSupplier(orgId, id, body);
      return sendData(reply, result, 200);
    }
  );

  // POST /suppliers/:id/deactivate - Deactivate supplier
  app.post(
    '/:id/deactivate',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Suppliers'],
        summary: 'Deactivate supplier',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      enforceSupplierManagePermission(request);
      const orgId = getOrgId(request);
      const { id } = request.params as { id: string };
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new SupplierService(db);

      const result = await service.deactivateSupplier(orgId, id);
      return sendData(reply, result, 200);
    }
  );

  // POST /suppliers/:id/activate - Re-activate supplier
  app.post(
    '/:id/activate',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Inventory Suppliers'],
        summary: 'Re-activate an inactive supplier',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      enforceSupplierManagePermission(request);
      const orgId = getOrgId(request);
      const { id } = request.params as { id: string };
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new SupplierService(db);

      const result = await service.activateSupplier(orgId, id);
      return sendData(reply, result, 200);
    }
  );
}
