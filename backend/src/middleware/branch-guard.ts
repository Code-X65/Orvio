import type { FastifyRequest } from 'fastify';
import { prisma as defaultPrisma } from '../infrastructure/database/client.js';
import { AppError } from '../lib/errors.js';

export function extractRequestedBranchId(request: FastifyRequest): string | null {
  const params = request.params as Record<string, string> | undefined;
  if (params?.branchId) return params.branchId;
  if (params?.branch_id) return params.branch_id;
  if (params?.id) return params.id;

  const query = request.query as Record<string, string> | undefined;
  if (query?.branchId) return query.branchId;
  if (query?.branch_id) return query.branch_id;
  if (query?.branch) return query.branch;

  const body = request.body as Record<string, any> | undefined;
  if (body?.branch_id && typeof body.branch_id === 'string') return body.branch_id;
  if (body?.branchId && typeof body.branchId === 'string') return body.branchId;

  const header = request.headers['x-active-branch'];
  if (typeof header === 'string' && header.trim().length > 0) return header.trim();

  return null;
}

/**
 * Fastify preHandler that enforces branch-level access control.
 * Bypasses for:
 * - Owner role
 * - Memberships with `scope_all_branches: true`
 *
 * For all others, verifies against the database `MembershipBranchAccess` table.
 */
export async function requireBranchScope(request: FastifyRequest): Promise<void> {
  const membership = request.auth?.membership;
  if (!membership) {
    throw new AppError('UNAUTHORIZED', 'No active membership context', 401);
  }

  // 1. Owner has unconditional all-branch scope
  if (membership.org_role === 'owner' || membership.role === 'owner') {
    return;
  }

  // 2. Members with global branch scope bypass individual branch checks
  if (membership.scope_all_branches) {
    return;
  }

  const requestedBranchId = extractRequestedBranchId(request);
  // If no branch is explicitly requested on this endpoint, pass to handler
  if (!requestedBranchId) {
    return;
  }

  const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;

  // 3. Re-resolve directly from DB to prevent stale-session elevation
  const hasAccess = await db.membershipBranchAccess.findUnique({
    where: {
      membership_id_branch_id: {
        membership_id: membership.id,
        branch_id: requestedBranchId,
      },
    },
    select: { id: true },
  });

  if (!hasAccess) {
    // Log forensic audit event for denied branch access attempt
    try {
      await db.auditLog.create({
        data: {
          user_id: request.auth?.user.id,
          org_id: membership.org_id,
          branch_id: requestedBranchId,
          event: 'branch_access_denied',
          status: 'failed',
          ip_address: request.ip,
          user_agent: request.headers['user-agent'] || null,
          metadata: {
            role: membership.org_role,
            requested_branch_id: requestedBranchId,
            url: request.url,
            method: request.method,
          },
        },
      });
    } catch {
      // Non-fatal if audit write fails
    }

    throw new AppError(
      'FORBIDDEN',
      'Branch access denied: You do not have permission to access or operate on this branch',
      403
    );
  }
}
