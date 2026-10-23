import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StaffService } from '../../src/modules/organizations/staff.service.js';
import { eventBus } from '../../src/infrastructure/websocket/event-bus.js';

describe('StaffService Access Management & Realtime Ejection', () => {
  let mockDb: any;
  let service: StaffService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(eventBus, 'broadcastToOrg').mockImplementation(() => {});

    mockDb = {
      membership: {
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      membershipBranchAccess: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      refreshToken: {
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(mockDb)),
    };

    service = new StaffService(mockDb);
  });

  const actorContext = {
    id: 'owner-user-1',
    membershipId: 'mem-owner-1',
    org_role: 'owner' as const,
    scope_all_branches: true,
    branch_ids: ['b1', 'b2'],
  };

  it('permanently removes a staff member and broadcasts staff:removed event', async () => {
    mockDb.membership.findFirst.mockResolvedValue({
      id: 'mem-staff-1',
      org_id: 'org-1',
      user_id: 'user-staff-1',
      org_role: 'cashier',
      user: { id: 'user-staff-1', email: 'cashier@example.com' },
    });

    const res = await service.removeMember('org-1', 'mem-staff-1', actorContext);

    expect(res.success).toBe(true);
    expect(mockDb.membership.delete).toHaveBeenCalledWith({
      where: { id: 'mem-staff-1' },
    });
    expect(mockDb.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { user_id: 'user-staff-1', revoked_at: null },
      data: expect.objectContaining({ revoked_at: expect.any(Date) }),
    });
    expect(eventBus.broadcastToOrg).toHaveBeenCalledWith('org-1', {
      type: 'staff:removed',
      payload: expect.objectContaining({
        membershipId: 'mem-staff-1',
        userId: 'user-staff-1',
      }),
    });
  });

  it('prevents removing the organization owner', async () => {
    mockDb.membership.findFirst.mockResolvedValue({
      id: 'mem-owner-1',
      org_id: 'org-1',
      user_id: 'user-owner-1',
      org_role: 'owner',
      user: { id: 'user-owner-1' },
    });

    await expect(service.removeMember('org-1', 'mem-owner-1', actorContext)).rejects.toThrow(
      'Organization Owner cannot be removed'
    );
  });

  it('detects branch revocation during updateMember and broadcasts staff:branch_revoked', async () => {
    mockDb.membership.findFirst.mockResolvedValue({
      id: 'mem-staff-2',
      org_id: 'org-1',
      user_id: 'user-staff-2',
      org_role: 'storekeeper',
      scope_all_branches: false,
      user: { id: 'user-staff-2' },
      branch_accesses: [{ branch_id: 'branch-a' }, { branch_id: 'branch-b' }],
    });

    // Update staff to only have access to branch-a (revoking branch-b)
    const res = await service.updateMember(
      'org-1',
      'mem-staff-2',
      actorContext,
      { branchIds: ['branch-a'] }
    );

    expect(res.success).toBe(true);
    expect(eventBus.broadcastToOrg).toHaveBeenCalledWith('org-1', {
      type: 'staff:branch_revoked',
      payload: expect.objectContaining({
        membershipId: 'mem-staff-2',
        userId: 'user-staff-2',
        revokedBranchIds: ['branch-b'],
        remainingBranchIds: ['branch-a'],
      }),
    });
  });

  it('suspends a staff member and broadcasts staff:suspended event', async () => {
    mockDb.membership.findFirst.mockResolvedValue({
      id: 'mem-staff-3',
      org_id: 'org-1',
      user_id: 'user-staff-3',
      org_role: 'cashier',
    });

    const res = await service.suspendMember('org-1', 'mem-staff-3', actorContext);

    expect(res.success).toBe(true);
    expect(mockDb.membership.update).toHaveBeenCalledWith({
      where: { id: 'mem-staff-3' },
      data: { status: 'suspended' },
    });
    expect(eventBus.broadcastToOrg).toHaveBeenCalledWith('org-1', {
      type: 'staff:suspended',
      payload: expect.objectContaining({
        membershipId: 'mem-staff-3',
        userId: 'user-staff-3',
      }),
    });
  });

  it('updates member role, broadcasts staff:updated with oldRole and newRole, and preserves refresh tokens for silent refresh', async () => {
    mockDb.membership.findFirst.mockResolvedValue({
      id: 'mem-staff-4',
      org_id: 'org-1',
      user_id: 'user-staff-4',
      org_role: 'storekeeper',
      role: 'member',
      status: 'active',
      scope_all_branches: false,
      branch_accesses: [{ branch_id: 'branch-1' }],
    });

    const res = await service.updateMember('org-1', 'mem-staff-4', actorContext, {
      role: 'manager',
    });

    expect(res.success).toBe(true);
    // Refresh tokens must NOT be revoked on role update
    expect(mockDb.refreshToken.updateMany).not.toHaveBeenCalled();
    // Broadcast must include both oldRole and newRole
    expect(eventBus.broadcastToOrg).toHaveBeenCalledWith('org-1', {
      type: 'staff:updated',
      payload: expect.objectContaining({
        membershipId: 'mem-staff-4',
        userId: 'user-staff-4',
        oldRole: 'storekeeper',
        newRole: 'manager',
        role: 'manager',
        branchRoles: {
          'branch-1': 'manager',
        },
      }),
    });
  });

  it('updates member role specifically in a single branch without overwriting other branches', async () => {
    mockDb.membership.findFirst.mockResolvedValue({
      id: 'mem-staff-5',
      org_id: 'org-1',
      user_id: 'user-staff-5',
      org_role: 'storekeeper',
      status: 'active',
      scope_all_branches: false,
      branch_accesses: [{ branch_id: 'branch-a', role: 'storekeeper' }],
    });

    mockDb.membershipBranchAccess.findMany.mockResolvedValue([
      { branch_id: 'branch-a', role: 'manager' },
      { branch_id: 'branch-b', role: 'cashier' },
    ]);

    const res = await service.updateBranchRole(
      'org-1',
      'mem-staff-5',
      'branch-a',
      'manager',
      actorContext
    );

    expect(res.success).toBe(true);
    expect(mockDb.membershipBranchAccess.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          membership_id_branch_id: {
            membership_id: 'mem-staff-5',
            branch_id: 'branch-a',
          },
        },
        update: { role: 'manager' },
      })
    );

    expect(eventBus.broadcastToOrg).toHaveBeenCalledWith('org-1', {
      type: 'staff:updated',
      payload: expect.objectContaining({
        membershipId: 'mem-staff-5',
        branchRoles: {
          'branch-a': 'manager',
          'branch-b': 'cashier',
        },
      }),
    });
  });

  it('revokes branch access from a staff member and broadcasts staff:branch_revoked', async () => {
    mockDb.membership.findFirst.mockResolvedValue({
      id: 'mem-staff-6',
      org_id: 'org-1',
      user_id: 'user-staff-6',
      org_role: 'cashier',
      status: 'active',
      scope_all_branches: false,
      branch_accesses: [{ branch_id: 'branch-a' }, { branch_id: 'branch-b' }],
    });

    mockDb.membershipBranchAccess.findMany.mockResolvedValue([
      { branch_id: 'branch-b', role: 'cashier' },
    ]);

    const res = await service.revokeBranchAccess(
      'org-1',
      'mem-staff-6',
      'branch-a',
      actorContext
    );

    expect(res.success).toBe(true);
    expect(mockDb.membershipBranchAccess.deleteMany).toHaveBeenCalledWith({
      where: {
        membership_id: 'mem-staff-6',
        branch_id: 'branch-a',
      },
    });

    expect(eventBus.broadcastToOrg).toHaveBeenCalledWith('org-1', {
      type: 'staff:branch_revoked',
      payload: expect.objectContaining({
        membershipId: 'mem-staff-6',
        userId: 'user-staff-6',
        revokedBranchIds: ['branch-a'],
        remainingBranchIds: ['branch-b'],
      }),
    });
  });
});

