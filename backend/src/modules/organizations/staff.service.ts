import type { PrismaClient, org_role, membership_role } from '@prisma/client';
import crypto from 'node:crypto';
import { generateOpaqueToken, hashToken, signAccessToken } from '../../lib/tokens.js';
import { hashPassword, assertPasswordPolicy } from '../../lib/password.js';
import { AppError } from '../../lib/errors.js';
import { canManageRole } from '../../middleware/rbac.js';
import type { EmailSender } from '../email/index.js';
import { env } from '../../config/env.js';
import { defaultAppCache } from '../../infrastructure/cache/in-memory-cache.js';
import { eventBus } from '../../infrastructure/websocket/event-bus.js';

export function mapOrgRoleToMembershipRole(role: org_role): membership_role {
  if (role === 'owner') return 'owner';
  if (role === 'manager') return 'manager';
  return 'member';
}

export interface ActorContext {
  id: string; // user id
  membershipId: string;
  org_role: org_role;
  scope_all_branches: boolean;
  branch_ids: string[];
}

export interface InviteStaffDto {
  email: string;
  role: org_role;
  branchIds?: string[];
  branchRoles?: Record<string, org_role>;
  defaultBranchId?: string;
  scopeAllBranches?: boolean;
  appKeys?: string[];
}

export interface UpdateMemberDto {
  role?: org_role;
  branchIds?: string[];
  branchRoles?: Record<string, org_role>;
  defaultBranchId?: string;
  scopeAllBranches?: boolean;
  appKeys?: string[];
}

export class StaffService {
  constructor(
    private db: PrismaClient,
    private emailSender?: EmailSender
  ) {}

  /**
   * List all staff members and pending invitations for an organization.
   */
  async listStaff(orgId: string, actor: ActorContext, branchId?: string) {
    const org = await this.db.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);

    // Fetch members
    const members = await this.db.membership.findMany({
      where: { org_id: orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true,
            phone: true,
            status: true,
            last_login_at: true,
          },
        },
        branch_accesses: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
                is_primary: true,
              },
            },
          },
          orderBy: { is_default: 'desc' },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // Fetch pending invitations
    const invitations = await this.db.workspaceInvitation.findMany({
      where: {
        org_id: orgId,
        status: 'pending',
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });

    // Fetch branches map for invitation branch names
    const branches = await this.db.branch.findMany({
      where: { org_id: orgId, is_deleted: false },
      select: { id: true, name: true, code: true, is_primary: true },
    });
    const branchMap = new Map(branches.map((b) => [b.id, b]));

    const formattedInvitations = invitations.map((inv) => {
      const assignedBranchIds = (inv.branch_ids as string[] | null) || [];
      const assignedBranches = assignedBranchIds
        .map((id) => branchMap.get(id))
        .filter(Boolean);

      return {
        id: inv.id,
        email: inv.email,
        role: inv.org_role || inv.role,
        status: inv.status,
        default_branch_id: inv.default_branch_id,
        branches: assignedBranches,
        expires_at: inv.expires_at,
        created_at: inv.created_at,
      };
    });

    const formattedMembers = members.map((m) => {
      return {
        membershipId: m.id,
        userId: m.user.id,
        email: m.user.email,
        fullName: m.user.full_name,
        phone: m.user.phone,
        role: m.org_role,
        legacyRole: m.role,
        status: m.status,
        scopeAllBranches: m.scope_all_branches,
        branches: m.branch_accesses.map((ba) => ({
          id: ba.branch.id,
          name: ba.branch.name,
          code: ba.branch.code,
          isPrimary: ba.branch.is_primary,
          isDefault: ba.is_default,
          role: ba.role || m.org_role,
          grantedAt: ba.granted_at,
        })),
        branchRoles: m.branch_accesses.reduce((acc, ba) => {
          acc[ba.branch_id] = ba.role || m.org_role;
          return acc;
        }, {} as Record<string, org_role>),
        createdAt: m.created_at,
        lastLoginAt: m.user.last_login_at,
      };
    });

    const filteredMembers = branchId
      ? formattedMembers.filter((m) => m.scopeAllBranches || m.branches.some((b) => b.id === branchId))
      : formattedMembers;

    const filteredInvitations = branchId
      ? formattedInvitations.filter(
          (inv) => inv.branches.some((b) => b?.id === branchId) || inv.branches.length === 0
        )
      : formattedInvitations;

    return {
      members: filteredMembers,
      invitations: filteredInvitations,
      branches,
    };
  }

  /**
   * Invite a staff member with role and branch scoping.
   */
  async inviteStaff(orgId: string, actor: ActorContext, dto: InviteStaffDto) {
    const cleanEmail = dto.email.toLowerCase().trim();

    // 1. Owner role cannot be assigned via invitation
    if (dto.role === 'owner') {
      throw new AppError(
        'VALIDATION_ERROR',
        'Owner role cannot be assigned via staff invitation',
        422
      );
    }

    // 2. Enforce Tier Hierarchy: Actor can only invite strictly lower tiers
    if (!canManageRole(actor.org_role, dto.role)) {
      throw new AppError(
        'FORBIDDEN',
        `Role '${actor.org_role}' does not have authority to invite a '${dto.role}'`,
        403
      );
    }

    const org = await this.db.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);

    // 3. Manager branch constraint: Managers cannot grant branches they don't have access to
    if (actor.org_role !== 'owner' && !actor.scope_all_branches && dto.branchIds) {
      const unauthorized = dto.branchIds.filter((bId) => !actor.branch_ids.includes(bId));
      if (unauthorized.length > 0) {
        throw new AppError(
          'FORBIDDEN',
          'You cannot assign branches outside of your own granted branch scope',
          403
        );
      }
    }

    // 4. Check if user is already a member
    const existingMember = await this.db.membership.findFirst({
      where: {
        org_id: orgId,
        user: { email: cleanEmail },
      },
    });

    if (existingMember) {
      throw new AppError('DUPLICATE_RESOURCE', 'User is already an active member of this organization', 409);
    }

    const { rawToken, tokenHash } = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.db.workspaceInvitation.upsert({
      where: { token_hash: tokenHash },
      create: {
        org_id: orgId,
        email: cleanEmail,
        role: mapOrgRoleToMembershipRole(dto.role),
        org_role: dto.role,
        default_branch_id: dto.defaultBranchId || (dto.branchIds && dto.branchIds[0]) || null,
        branch_ids: dto.branchIds ? (dto.branchIds as any) : undefined,
        app_keys: dto.appKeys ? (dto.appKeys as any) : (dto.role === 'storekeeper' ? ['inventory'] : undefined),
        token_hash: tokenHash,
        invited_by_id: actor.id,
        expires_at: expiresAt,
        status: 'pending',
      },
      update: {
        role: mapOrgRoleToMembershipRole(dto.role),
        org_role: dto.role,
        default_branch_id: dto.defaultBranchId || (dto.branchIds && dto.branchIds[0]) || null,
        branch_ids: dto.branchIds ? (dto.branchIds as any) : undefined,
        app_keys: dto.appKeys ? (dto.appKeys as any) : (dto.role === 'storekeeper' ? ['inventory'] : undefined),
        token_hash: tokenHash,
        expires_at: expiresAt,
        status: 'pending',
      },
    });

    // Send invitation email
    const appBaseUrl = env.FRONTEND_URL || 'http://localhost:4000';
    const acceptUrl = `${appBaseUrl}/invite?token=${rawToken}`;

    if (this.emailSender) {
      try {
        await this.emailSender.send({
          to: [{ email: cleanEmail }],
          subject: `Join ${org.name} on Orvio (${dto.role.toUpperCase()})`,
          htmlContent: `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #714b67;">You're invited to join ${org.name}</h2>
              <p>You have been invited to join <strong>${org.name}</strong> as <strong>${dto.role}</strong>.</p>
              <div style="margin: 28px 0;">
                <a href="${acceptUrl}" style="background-color: #714b67; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                  Accept Invitation & Set Up Account
                </a>
              </div>
              <p style="color: #666; font-size: 13px;">This invitation link will expire in 7 days.</p>
            </div>
          `,
        });
      } catch {
        // Non-fatal if email provider fails
      }
    }

    return {
      invitationId: invitation.id,
      email: cleanEmail,
      role: dto.role,
      status: 'sent',
      rawToken: env.NODE_ENV === 'test' ? rawToken : undefined,
    };
  }

  /**
   * Fetch invitation details by raw token (for public /invite page).
   */
  async getInvitationByToken(rawToken: string) {
    const tokenHash = hashToken(rawToken);

    const invitation = await this.db.workspaceInvitation.findUnique({
      where: { token_hash: tokenHash },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            logo_url: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new AppError('NOT_FOUND', 'Invitation not found or link is invalid', 404);
    }

    if (invitation.status !== 'pending' || invitation.expires_at < new Date()) {
      throw new AppError('TOKEN_EXPIRED', 'This invitation has expired or has already been accepted', 410);
    }

    const branchIds = (invitation.branch_ids as string[] | null) || [];
    const branches =
      branchIds.length > 0
        ? await this.db.branch.findMany({
            where: { id: { in: branchIds } },
            select: { id: true, name: true, code: true },
          })
        : [];

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.org_role || invitation.role,
      organization: invitation.organization,
      defaultBranchId: invitation.default_branch_id,
      appKeys: (invitation.app_keys as string[]) || (invitation.org_role === 'storekeeper' ? ['inventory'] : undefined),
      branches,
      expiresAt: invitation.expires_at,
    };
  }

  /**
   * Accept an invitation, provision user/membership, and issue session tokens.
   */
  async acceptInvitation(
    rawToken: string,
    dto: { fullName: string; password?: string; userId?: string }
  ) {
    const tokenHash = hashToken(rawToken);

    const invitation = await this.db.workspaceInvitation.findUnique({
      where: { token_hash: tokenHash },
      include: {
        organization: true,
      },
    });

    if (!invitation || invitation.status !== 'pending' || invitation.expires_at < new Date()) {
      throw new AppError('TOKEN_EXPIRED', 'Invitation is invalid, expired, or already used', 410);
    }

    let user;

    if (dto.userId) {
      user = await this.db.user.findUnique({ where: { id: dto.userId } });
      if (!user) throw new AppError('USER_NOT_FOUND', 'Authenticated user not found', 404);
    } else {
      // Find or create user by email
      const existingUser = await this.db.user.findUnique({
        where: { email: invitation.email.toLowerCase() },
      });

      if (existingUser) {
        user = existingUser;
      } else {
        if (!dto.password) {
          throw new AppError('VALIDATION_ERROR', 'Password is required to create your account', 400);
        }
        assertPasswordPolicy(dto.password);
        const passwordHash = await hashPassword(dto.password);

        user = await this.db.user.create({
          data: {
            email: invitation.email.toLowerCase(),
            full_name: dto.fullName,
            password_hash: passwordHash,
            status: 'active',
            email_verified_at: new Date(), // verified by virtue of receiving the invite token
          },
        });
      }
    }

    const assignedRole = invitation.org_role || 'storekeeper';
    const legacyRole = mapOrgRoleToMembershipRole(assignedRole);
    const branchIds = (invitation.branch_ids as string[] | null) || [];
    const scopeAll = branchIds.length === 0 || assignedRole === 'owner';
    const appAccess = (invitation.app_keys as string[]) || (assignedRole === 'storekeeper' ? ['inventory'] : undefined);

    // Create Membership in transaction with Branch Accesses
    const membership = await this.db.$transaction(async (tx) => {
      const createdMembership = await tx.membership.create({
        data: {
          org_id: invitation.org_id,
          user_id: user.id,
          role: legacyRole,
          org_role: assignedRole,
          scope_all_branches: scopeAll,
          app_access: appAccess ? (appAccess as any) : undefined,
          status: 'active',
          accepted_at: new Date(),
        },
      });

      if (branchIds.length > 0) {
        const defaultBranchId = invitation.default_branch_id || branchIds[0];
        await tx.membershipBranchAccess.createMany({
          data: branchIds.map((bId) => ({
            membership_id: createdMembership.id,
            branch_id: bId,
            role: assignedRole,
            is_default: bId === defaultBranchId,
          })),
        });
      }

      // Mark invitation accepted
      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'accepted',
          accepted_at: new Date(),
        },
      });

      return createdMembership;
    });

    // Issue JWT access token
    const familyId = generateOpaqueToken().rawToken;
    const sessionId = generateOpaqueToken().rawToken;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await this.db.refreshToken.create({
      data: {
        user_id: user.id,
        membership_id: membership.id,
        family_id: familyId,
        session_id: sessionId,
        jti: crypto.randomUUID(),
        token_hash: hashToken(familyId),
        expires_at: expiresAt,
      },
    });

    const branchRolesMap: Record<string, string> = {};
    for (const bId of branchIds) {
      branchRolesMap[bId] = assignedRole;
    }

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      org_id: invitation.org_id,
      role: legacyRole,
      org_role: assignedRole,
      scope_all_branches: scopeAll,
      branch_scope: branchIds,
      branch_roles: branchRolesMap,
      membership_id: membership.id,
      session_id: sessionId,
    });

    return {
      accessToken,
      refreshToken: familyId,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      },
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
        subdomain: invitation.organization.subdomain,
      },
      role: assignedRole,
      defaultBranchId: invitation.default_branch_id || (branchIds[0] ?? null),
    };
  }

  /**
   * Update a staff member's role or branch assignments.
   */
  async updateMember(
    orgId: string,
    membershipId: string,
    actor: ActorContext,
    dto: UpdateMemberDto
  ) {
    const target = await this.db.membership.findFirst({
      where: { id: membershipId, org_id: orgId },
      include: { user: true, branch_accesses: true },
    });

    if (!target) {
      throw new AppError('NOT_FOUND', 'Staff membership not found', 404);
    }

    // 1. Cannot modify owner
    if (target.org_role === 'owner') {
      throw new AppError('FORBIDDEN', 'Owner membership cannot be modified or re-roled', 403);
    }

    // 2. Enforce Tier Hierarchy on existing target role
    if (!canManageRole(actor.org_role, target.org_role)) {
      throw new AppError(
        'FORBIDDEN',
        `Role '${actor.org_role}' cannot modify a peer or higher tier '${target.org_role}'`,
        403
      );
    }

    // 3. Enforce Tier Hierarchy on proposed new role
    if (dto.role) {
      if (dto.role === 'owner') {
        throw new AppError('VALIDATION_ERROR', 'Cannot promote user to Owner', 422);
      }
      if (!canManageRole(actor.org_role, dto.role)) {
        throw new AppError(
          'FORBIDDEN',
          `Role '${actor.org_role}' cannot assign the role '${dto.role}'`,
          403
        );
      }
    }

    const previousBranchIds = target.branch_accesses.map((ba) => ba.branch_id);
    let revokedBranchIds: string[] = [];
    if (dto.branchIds) {
      revokedBranchIds = previousBranchIds.filter((bId) => !dto.branchIds!.includes(bId));
    }

    await this.db.$transaction(async (tx) => {
      const updateData: any = {};
      if (dto.role) {
        updateData.org_role = dto.role;
        updateData.role = mapOrgRoleToMembershipRole(dto.role);
      }
      if (typeof dto.scopeAllBranches === 'boolean') {
        updateData.scope_all_branches = dto.scopeAllBranches;
      }
      if (dto.appKeys) {
        updateData.app_access = dto.appKeys as any;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.membership.update({
          where: { id: membershipId },
          data: updateData,
        });
      }

      if (dto.branchIds) {
        // Clear previous branch accesses and re-create
        await tx.membershipBranchAccess.deleteMany({
          where: { membership_id: membershipId },
        });

        const defaultId = dto.defaultBranchId || dto.branchIds[0];
        const assignedRole = dto.role || target.org_role;
        if (dto.branchIds.length > 0) {
          await tx.membershipBranchAccess.createMany({
            data: dto.branchIds.map((bId) => ({
              membership_id: membershipId,
              branch_id: bId,
              role: (dto.branchRoles && dto.branchRoles[bId]) || assignedRole,
              is_default: bId === defaultId,
            })),
          });
        }
      }
    });

    defaultAppCache.clearPrefix(`org_details:${orgId}`);

    // Broadcast realtime event for revoked branches if any
    if (revokedBranchIds.length > 0) {
      eventBus.broadcastToOrg(orgId, {
        type: 'staff:branch_revoked',
        payload: {
          membershipId,
          userId: target.user_id,
          revokedBranchIds,
          remainingBranchIds: dto.branchIds || [],
          message: 'Your access to this branch has been revoked by an administrator.',
        },
      });
    }

    // Broadcast staff:updated event for live list refreshes and seamless role synchronization
    const newRole = dto.role || target.org_role;
    const mappedBranchRoles: Record<string, string> = {};
    if (dto.branchIds) {
      dto.branchIds.forEach((bId) => {
        mappedBranchRoles[bId] = (dto.branchRoles && dto.branchRoles[bId]) || newRole;
      });
    } else {
      target.branch_accesses.forEach((ba) => {
        mappedBranchRoles[ba.branch_id] = ba.role || newRole;
      });
    }

    eventBus.broadcastToOrg(orgId, {
      type: 'staff:updated',
      payload: {
        membershipId,
        userId: target.user_id,
        role: newRole,
        oldRole: target.org_role,
        newRole,
        scopeAllBranches: dto.scopeAllBranches ?? target.scope_all_branches,
        branchIds: dto.branchIds ?? previousBranchIds,
        branchRoles: mappedBranchRoles,
      },
    });

    return { success: true, membershipId };
  }

  /**
   * Update a staff member's designated role specifically in a single branch without affecting other branches.
   */
  async updateBranchRole(
    orgId: string,
    membershipId: string,
    branchId: string,
    role: org_role,
    actor: ActorContext
  ) {
    const target = await this.db.membership.findFirst({
      where: { id: membershipId, org_id: orgId },
      include: { user: true, branch_accesses: true },
    });

    if (!target) throw new AppError('NOT_FOUND', 'Staff membership not found', 404);
    if (target.org_role === 'owner') {
      throw new AppError('FORBIDDEN', 'Owner role cannot be modified', 403);
    }
    if (!canManageRole(actor.org_role, target.org_role)) {
      throw new AppError(
        'FORBIDDEN',
        `Role '${actor.org_role}' cannot modify a peer or higher tier '${target.org_role}'`,
        403
      );
    }
    if (role === 'owner') {
      throw new AppError('VALIDATION_ERROR', 'Cannot promote user to Owner at branch level', 422);
    }
    if (!canManageRole(actor.org_role, role)) {
      throw new AppError(
        'FORBIDDEN',
        `Role '${actor.org_role}' cannot assign the role '${role}'`,
        403
      );
    }

    // Enforce branch boundary: actor must have access to the target branch unless global
    if (!actor.scope_all_branches && actor.org_role !== 'owner') {
      if (!actor.branch_ids.includes(branchId)) {
        throw new AppError('FORBIDDEN', 'You do not have permission to manage this branch', 403);
      }
    }

    await this.db.membershipBranchAccess.upsert({
      where: {
        membership_id_branch_id: {
          membership_id: membershipId,
          branch_id: branchId,
        },
      },
      update: { role },
      create: {
        membership_id: membershipId,
        branch_id: branchId,
        role,
        is_default: target.branch_accesses.length === 0,
      },
    });

    const updatedBA = await this.db.membershipBranchAccess.findMany({
      where: { membership_id: membershipId },
    });

    const mappedBranchRoles: Record<string, string> = {};
    updatedBA.forEach((ba) => {
      mappedBranchRoles[ba.branch_id] = ba.role || target.org_role;
    });

    // Broadcast staff:updated with refreshed branchRoles
    eventBus.broadcastToOrg(orgId, {
      type: 'staff:updated',
      payload: {
        membershipId,
        userId: target.user_id,
        role: target.org_role,
        oldRole: target.org_role,
        newRole: target.org_role,
        scopeAllBranches: target.scope_all_branches,
        branchIds: updatedBA.map((ba) => ba.branch_id),
        branchRoles: mappedBranchRoles,
      },
    });

    return { success: true, membershipId, branchId, role };
  }

  /**
   * Revoke a staff member's access to a specific branch.
   */
  async revokeBranchAccess(
    orgId: string,
    membershipId: string,
    branchId: string,
    actor: ActorContext
  ) {
    const target = await this.db.membership.findFirst({
      where: { id: membershipId, org_id: orgId },
      include: { user: true, branch_accesses: true },
    });

    if (!target) throw new AppError('NOT_FOUND', 'Staff membership not found', 404);
    if (target.org_role === 'owner') {
      throw new AppError('FORBIDDEN', 'Owner branch access cannot be revoked', 403);
    }
    if (!canManageRole(actor.org_role, target.org_role)) {
      throw new AppError('FORBIDDEN', 'Cannot modify a peer or higher tier member', 403);
    }

    // Actor branch authorization
    if (!actor.scope_all_branches && actor.org_role !== 'owner') {
      if (!actor.branch_ids.includes(branchId)) {
        throw new AppError('FORBIDDEN', 'You do not have permission to manage this branch', 403);
      }
    }

    await this.db.membershipBranchAccess.deleteMany({
      where: {
        membership_id: membershipId,
        branch_id: branchId,
      },
    });

    const remaining = await this.db.membershipBranchAccess.findMany({
      where: { membership_id: membershipId },
    });
    const remainingBranchIds = remaining.map((ba) => ba.branch_id);

    // Broadcast realtime event for revoked branch
    eventBus.broadcastToOrg(orgId, {
      type: 'staff:branch_revoked',
      payload: {
        membershipId,
        userId: target.user_id,
        revokedBranchIds: [branchId],
        remainingBranchIds,
        message: 'Your access to this branch has been revoked by an administrator.',
      },
    });

    const mappedBranchRoles: Record<string, string> = {};
    remaining.forEach((ba) => {
      mappedBranchRoles[ba.branch_id] = ba.role || target.org_role;
    });

    eventBus.broadcastToOrg(orgId, {
      type: 'staff:updated',
      payload: {
        membershipId,
        userId: target.user_id,
        role: target.org_role,
        oldRole: target.org_role,
        newRole: target.org_role,
        scopeAllBranches: target.scope_all_branches,
        branchIds: remainingBranchIds,
        branchRoles: mappedBranchRoles,
      },
    });

    return { success: true, membershipId, revokedBranchId: branchId };
  }

  /**
   * Assign an existing organization member to a branch.
   */
  async assignBranchAccess(
    orgId: string,
    membershipId: string,
    branchId: string,
    role: org_role,
    actor: ActorContext
  ) {
    return this.updateBranchRole(orgId, membershipId, branchId, role, actor);
  }

  /**
   * Suspend a staff member and revoke all their active sessions immediately.
   */
  async suspendMember(orgId: string, membershipId: string, actor: ActorContext) {
    const target = await this.db.membership.findFirst({
      where: { id: membershipId, org_id: orgId },
    });

    if (!target) throw new AppError('NOT_FOUND', 'Staff membership not found', 404);
    if (target.org_role === 'owner') {
      throw new AppError('FORBIDDEN', 'Owner cannot be suspended', 403);
    }
    if (!canManageRole(actor.org_role, target.org_role)) {
      throw new AppError('FORBIDDEN', 'Cannot suspend a peer or superior tier', 403);
    }

    await this.db.$transaction(async (tx) => {
      await tx.membership.update({
        where: { id: membershipId },
        data: { status: 'suspended' },
      });

      // Instantly revoke all active sessions
      await tx.refreshToken.updateMany({
        where: { user_id: target.user_id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    });

    defaultAppCache.clearPrefix(`org_details:${orgId}`);

    // Broadcast realtime suspension event to eject active sessions
    eventBus.broadcastToOrg(orgId, {
      type: 'staff:suspended',
      payload: {
        membershipId,
        userId: target.user_id,
        message: 'Your access to this organization has been suspended by an administrator.',
      },
    });

    return { success: true, status: 'suspended' };
  }

  /**
   * Reactivate a previously suspended staff member.
   */
  async reactivateMember(orgId: string, membershipId: string, actor: ActorContext) {
    const target = await this.db.membership.findFirst({
      where: { id: membershipId, org_id: orgId },
    });

    if (!target) throw new AppError('NOT_FOUND', 'Staff membership not found', 404);
    if (!canManageRole(actor.org_role, target.org_role)) {
      throw new AppError('FORBIDDEN', 'Cannot manage this member', 403);
    }

    await this.db.membership.update({
      where: { id: membershipId },
      data: { status: 'active' },
    });

    defaultAppCache.clearPrefix(`org_details:${orgId}`);

    eventBus.broadcastToOrg(orgId, {
      type: 'staff:reactivated',
      payload: {
        membershipId,
        userId: target.user_id,
      },
    });

    return { success: true, status: 'active' };
  }

  /**
   * Permanently remove a staff member from the organization.
   * Cascade-deletes the Membership record and revokes all active sessions for this membership.
   * Preserves the underlying User profile record.
   */
  async removeMember(orgId: string, membershipId: string, actor: ActorContext) {
    const target = await this.db.membership.findFirst({
      where: { id: membershipId, org_id: orgId },
      include: { user: true },
    });

    if (!target) throw new AppError('NOT_FOUND', 'Staff membership not found', 404);
    if (target.org_role === 'owner') {
      throw new AppError('FORBIDDEN', 'Organization Owner cannot be removed', 403);
    }
    if (!canManageRole(actor.org_role, target.org_role)) {
      throw new AppError('FORBIDDEN', 'Cannot remove a peer or superior tier', 403);
    }

    await this.db.$transaction(async (tx) => {
      // 1. Delete membership (Prisma cascades to MembershipBranchAccess)
      await tx.membership.delete({
        where: { id: membershipId },
      });

      // 2. Revoke all active refresh tokens for this user in this organization
      await tx.refreshToken.updateMany({
        where: { user_id: target.user_id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    });

    defaultAppCache.clearPrefix(`org_details:${orgId}`);

    // Broadcast realtime removal event to immediately eject all active sessions
    eventBus.broadcastToOrg(orgId, {
      type: 'staff:removed',
      payload: {
        membershipId,
        userId: target.user_id,
        message: 'Your access to this organization has been removed by an administrator.',
      },
    });

    return { success: true, membershipId };
  }

  /**
   * Revoke a pending invitation.
   */
  async revokeInvitation(orgId: string, invitationId: string, actor: ActorContext) {
    const inv = await this.db.workspaceInvitation.findFirst({
      where: { id: invitationId, org_id: orgId },
    });

    if (!inv) throw new AppError('NOT_FOUND', 'Invitation not found', 404);
    if (inv.org_role && !canManageRole(actor.org_role, inv.org_role)) {
      throw new AppError('FORBIDDEN', 'Cannot revoke an invitation for a peer or superior role', 403);
    }

    await this.db.workspaceInvitation.update({
      where: { id: invitationId },
      data: { status: 'revoked' },
    });

    return { success: true };
  }

  /**
   * Resend an invitation with a refreshed 7-day expiration.
   */
  async resendInvitation(orgId: string, invitationId: string, actor: ActorContext) {
    const inv = await this.db.workspaceInvitation.findFirst({
      where: { id: invitationId, org_id: orgId },
      include: { organization: true },
    });

    if (!inv) throw new AppError('NOT_FOUND', 'Invitation not found', 404);

    const { rawToken, tokenHash } = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.db.workspaceInvitation.update({
      where: { id: invitationId },
      data: {
        token_hash: tokenHash,
        expires_at: expiresAt,
        status: 'pending',
      },
    });

    const appBaseUrl = env.FRONTEND_URL || 'http://localhost:4000';
    const acceptUrl = `${appBaseUrl}/invite?token=${rawToken}`;

    if (this.emailSender) {
      try {
        await this.emailSender.send({
          to: [{ email: inv.email }],
          subject: `Reminder: Join ${inv.organization.name} on Orvio`,
          htmlContent: `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #714b67;">Invitation Reminder for ${inv.organization.name}</h2>
              <p>You have an open invitation to join <strong>${inv.organization.name}</strong> on Orvio.</p>
              <div style="margin: 28px 0;">
                <a href="${acceptUrl}" style="background-color: #714b67; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                  Accept Invitation & Set Up Account
                </a>
              </div>
            </div>
          `,
        });
      } catch {
        // Non-fatal if email provider fails
      }
    }

    return {
      success: true,
      invitationId,
      rawToken: env.NODE_ENV === 'test' ? rawToken : undefined,
    };
  }
}
