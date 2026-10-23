import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { StaffService, type ActorContext } from './staff.service.js';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { sendData } from '../../lib/envelope.js';
import { AppError } from '../../lib/errors.js';

const inviteStaffSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['manager', 'storekeeper', 'cashier', 'accountant']),
  branchIds: z.array(z.string()).optional(),
  branchRoles: z.record(z.enum(['manager', 'storekeeper', 'cashier', 'accountant'])).optional(),
  defaultBranchId: z.string().optional(),
  scopeAllBranches: z.boolean().optional(),
  appKeys: z.array(z.string()).optional(),
});

const updateMemberSchema = z.object({
  role: z.enum(['manager', 'storekeeper', 'cashier', 'accountant']).optional(),
  branchIds: z.array(z.string()).optional(),
  branchRoles: z.record(z.enum(['manager', 'storekeeper', 'cashier', 'accountant'])).optional(),
  defaultBranchId: z.string().optional(),
  scopeAllBranches: z.boolean().optional(),
  appKeys: z.array(z.string()).optional(),
});

const branchRoleSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  role: z.enum(['manager', 'storekeeper', 'cashier', 'accountant']),
});

const acceptInviteSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  password: z.string().min(12, 'Password must be at least 12 characters').optional(),
});

function getActorContext(request: FastifyRequest): ActorContext {
  const membership = request.auth?.membership;
  const user = request.auth?.user;
  if (!membership || !user) {
    throw new AppError('UNAUTHORIZED', 'Authentication context missing', 401);
  }

  const branchIds = membership.branch_accesses
    ? membership.branch_accesses.map((ba) => ba.branch_id)
    : [];

  return {
    id: user.id,
    membershipId: membership.id,
    org_role: membership.org_role,
    scope_all_branches: membership.scope_all_branches,
    branch_ids: branchIds,
  };
}

/**
 * Protected routes for organization staff management.
 * Mounted at `/api/v1/organizations/:orgId/staff`
 */
export async function staffProtectedRoutes(app: FastifyInstance) {
  // Pre-handlers for all staff management endpoints: requires authentication & manager/owner role
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', requireRole('owner', 'manager'));

  // 1. List staff and pending invitations
  app.get('/', async (request: FastifyRequest<{ Params: { orgId: string }; Querystring: { branchId?: string } }>, reply: FastifyReply) => {
    const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
    const emailSender = (request.server as any).emailSender;
    const service = new StaffService(db, emailSender);

    const actor = getActorContext(request);
    const branchId = (request.query as any)?.branchId as string | undefined;
    const data = await service.listStaff(request.params.orgId, actor, branchId);
    return sendData(reply, data, 200);
  });

  // 2. Send staff invitation
  app.post(
    '/invitations',
    async (request: FastifyRequest<{ Params: { orgId: string } }>, reply: FastifyReply) => {
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const emailSender = (request.server as any).emailSender;
      const service = new StaffService(db, emailSender);

      const dto = inviteStaffSchema.parse(request.body);
      const actor = getActorContext(request);
      const result = await service.inviteStaff(request.params.orgId, actor, dto);
      return sendData(reply, result, 201);
    }
  );

  // 3. Update staff member role or branches
  app.patch(
    '/members/:membershipId',
    async (
      request: FastifyRequest<{ Params: { orgId: string; membershipId: string } }>,
      reply: FastifyReply
    ) => {
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StaffService(db);

      const dto = updateMemberSchema.parse(request.body);
      const actor = getActorContext(request);
      const result = await service.updateMember(
        request.params.orgId,
        request.params.membershipId,
        actor,
        dto
      );
      return sendData(reply, result, 200);
    }
  );

  // 3b. Update member's role specifically in a single branch
  app.patch(
    '/members/:membershipId/branch-role',
    async (
      request: FastifyRequest<{ Params: { orgId: string; membershipId: string } }>,
      reply: FastifyReply
    ) => {
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StaffService(db);

      const dto = branchRoleSchema.parse(request.body);
      const actor = getActorContext(request);
      const result = await service.updateBranchRole(
        request.params.orgId,
        request.params.membershipId,
        dto.branchId,
        dto.role,
        actor
      );
      return sendData(reply, result, 200);
    }
  );

  // 3c. Revoke member's access to a single branch
  app.delete(
    '/members/:membershipId/branch-access/:branchId',
    async (
      request: FastifyRequest<{ Params: { orgId: string; membershipId: string; branchId: string } }>,
      reply: FastifyReply
    ) => {
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StaffService(db);

      const actor = getActorContext(request);
      const result = await service.revokeBranchAccess(
        request.params.orgId,
        request.params.membershipId,
        request.params.branchId,
        actor
      );
      return sendData(reply, result, 200);
    }
  );

  // 3d. Assign member to a branch
  app.post(
    '/members/:membershipId/branch-access',
    async (
      request: FastifyRequest<{ Params: { orgId: string; membershipId: string } }>,
      reply: FastifyReply
    ) => {
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StaffService(db);

      const dto = branchRoleSchema.parse(request.body);
      const actor = getActorContext(request);
      const result = await service.assignBranchAccess(
        request.params.orgId,
        request.params.membershipId,
        dto.branchId,
        dto.role,
        actor
      );
      return sendData(reply, result, 201);
    }
  );

  // 4. Suspend a staff member
  app.post(
    '/members/:membershipId/suspend',
    async (
      request: FastifyRequest<{ Params: { orgId: string; membershipId: string } }>,
      reply: FastifyReply
    ) => {
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StaffService(db);

      const actor = getActorContext(request);
      const result = await service.suspendMember(
        request.params.orgId,
        request.params.membershipId,
        actor
      );
      return sendData(reply, result, 200);
    }
  );

  // 5. Reactivate a staff member
  app.post(
    '/members/:membershipId/reactivate',
    async (
      request: FastifyRequest<{ Params: { orgId: string; membershipId: string } }>,
      reply: FastifyReply
    ) => {
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StaffService(db);

      const actor = getActorContext(request);
      const result = await service.reactivateMember(
        request.params.orgId,
        request.params.membershipId,
        actor
      );
      return sendData(reply, result, 200);
    }
  );

  // 5b. Permanently remove a staff member from the organization
  app.delete(
    '/members/:membershipId',
    async (
      request: FastifyRequest<{ Params: { orgId: string; membershipId: string } }>,
      reply: FastifyReply
    ) => {
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StaffService(db);

      const actor = getActorContext(request);
      const result = await service.removeMember(
        request.params.orgId,
        request.params.membershipId,
        actor
      );
      return sendData(reply, result, 200);
    }
  );

  // 6. Revoke a pending invitation
  app.delete(
    '/invitations/:invitationId',
    async (
      request: FastifyRequest<{ Params: { orgId: string; invitationId: string } }>,
      reply: FastifyReply
    ) => {
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StaffService(db);

      const actor = getActorContext(request);
      const result = await service.revokeInvitation(
        request.params.orgId,
        request.params.invitationId,
        actor
      );
      return sendData(reply, result, 200);
    }
  );

  // 7. Resend a pending invitation
  app.post(
    '/invitations/:invitationId/resend',
    async (
      request: FastifyRequest<{ Params: { orgId: string; invitationId: string } }>,
      reply: FastifyReply
    ) => {
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const emailSender = (request.server as any).emailSender;
      const service = new StaffService(db, emailSender);

      const actor = getActorContext(request);
      const result = await service.resendInvitation(
        request.params.orgId,
        request.params.invitationId,
        actor
      );
      return sendData(reply, result, 200);
    }
  );
}

/**
 * Public routes for viewing and accepting invitations.
 * Mounted at `/api/v1/invitations`
 */
export async function publicInvitationRoutes(app: FastifyInstance) {
  // 1. Fetch invitation metadata by raw token
  app.get('/:token', async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
    const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
    const service = new StaffService(db);

    const data = await service.getInvitationByToken(request.params.token);
    return sendData(reply, data, 200);
  });

  // 2. Accept invitation
  app.post(
    '/:token/accept',
    async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const service = new StaffService(db);

      const dto = acceptInviteSchema.parse(request.body);
      const result = await service.acceptInvitation(request.params.token, dto);
      return sendData(reply, result, 200);
    }
  );
}
