import type { FastifyRequest } from 'fastify';
import type { org_role } from '@prisma/client';
import { AppError } from '../lib/errors.js';

export const ROLE_TIERS: Record<org_role, number> = {
  owner: 4,
  manager: 3,
  storekeeper: 2,
  accountant: 2,
  cashier: 1,
};

export const READ_ONLY_ROLES: org_role[] = ['cashier', 'accountant'];

/**
 * Checks if the acting role has authority to assign, modify, or invite the target role.
 * Rule: An actor can only manage strictly lower tiers.
 * Exception: Owner has universal authority (except creating another Owner, which is structural).
 */
export function canManageRole(actingRole: org_role, targetRole: org_role): boolean {
  if (targetRole === 'owner') return false; // Owner is never assignable via invite/delegation
  if (actingRole === 'owner') return true;
  if (actingRole !== 'manager') return false; // Subordinates cannot manage or invite staff
  return ROLE_TIERS[actingRole] > ROLE_TIERS[targetRole];
}

export type Capability =
  | 'view_branches'
  | 'catalog_crud'
  | 'stock_adjust'
  | 'transfer_approve'
  | 'stock_history'
  | 'grn_receive'
  | 'sales'
  | 'export_reports'
  | 'manage_staff';

const CAPABILITY_MATRIX: Record<Capability, org_role[]> = {
  view_branches: ['owner', 'manager', 'storekeeper', 'cashier', 'accountant'],
  catalog_crud: ['owner', 'manager'],
  stock_adjust: ['owner', 'manager', 'storekeeper'],
  transfer_approve: ['owner', 'manager', 'storekeeper'],
  stock_history: ['owner', 'manager', 'storekeeper', 'accountant'],
  grn_receive: ['owner', 'manager', 'storekeeper'],
  sales: ['owner', 'manager', 'cashier'],
  export_reports: ['owner', 'manager', 'storekeeper', 'cashier', 'accountant'],
  manage_staff: ['owner', 'manager'],
};

export function hasPermission(role: org_role, capability: Capability): boolean {
  const allowed = CAPABILITY_MATRIX[capability];
  return allowed ? allowed.includes(role) : false;
}

/**
 * Fastify preHandler to require one of the specified org roles.
 */
export function requireRole(...allowedRoles: org_role[]) {
  return async function (request: FastifyRequest): Promise<void> {
    const role = request.auth?.membership?.org_role;
    if (!role) {
      throw new AppError('UNAUTHORIZED', 'No active membership role found', 401);
    }

    if (!allowedRoles.includes(role)) {
      throw new AppError(
        'FORBIDDEN',
        `Role '${role}' is not authorized to perform this action`,
        403
      );
    }
  };
}

/**
 * Fastify preHandler to require a specific business capability.
 */
export function requirePermission(capability: Capability) {
  return async function (request: FastifyRequest): Promise<void> {
    const role = request.auth?.membership?.org_role;
    if (!role) {
      throw new AppError('UNAUTHORIZED', 'No active membership role found', 401);
    }

    if (!hasPermission(role, capability)) {
      throw new AppError(
        'FORBIDDEN',
        `Role '${role}' lacks the '${capability}' permission`,
        403
      );
    }
  };
}

/**
 * Fastify preHandler to reject read-only roles (e.g. cashier & accountant on mutation routes).
 */
export async function requireNotReadOnly(request: FastifyRequest): Promise<void> {
  const role = request.auth?.membership?.org_role;
  if (role && READ_ONLY_ROLES.includes(role)) {
    throw new AppError(
      'FORBIDDEN',
      `Role '${role}' has read-only access and cannot perform this modification`,
      403
    );
  }
}
