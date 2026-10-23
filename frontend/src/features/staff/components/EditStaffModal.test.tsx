import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditStaffModal } from './EditStaffModal';
import { staffApi } from '../api/staff-api';

vi.mock('../api/staff-api', () => ({
  staffApi: {
    updateBranchRole: vi.fn(),
    revokeBranchAccess: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('EditStaffModal Component', () => {
  const mockBranches = [
    { id: 'branch-1', name: 'HQ Store', code: 'HQ' },
    { id: 'branch-2', name: 'Lekki Annex', code: 'LK' },
  ];

  const mockMember = {
    membershipId: 'mem-10',
    userId: 'user-10',
    email: 'john@example.com',
    fullName: 'John Doe',
    role: 'cashier' as const,
    legacyRole: 'member',
    status: 'active' as const,
    scopeAllBranches: false,
    branches: [
      {
        id: 'branch-1',
        name: 'HQ Store',
        code: 'HQ',
        isPrimary: true,
        isDefault: true,
        role: 'cashier' as const,
        grantedAt: new Date().toISOString(),
      },
    ],
    branchRoles: {
      'branch-1': 'cashier' as const,
    },
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders locked active branch context when contextBranchId is set', async () => {
    render(
      <EditStaffModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        orgId="org-1"
        member={mockMember}
        branches={mockBranches}
        contextBranchId="branch-1"
        activeBranchId="branch-1"
        activeBranchName="HQ Store"
        actorRole="owner"
      />
    );

    // Should display Active Context badge and branch name
    expect(screen.getByText('Active Context')).toBeInTheDocument();
    expect(screen.getAllByText('HQ Store').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Role and permissions will be applied exclusively to this branch.')
    ).toBeInTheDocument();

    // Should NOT render branch dropdown selector
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('submits role update specifically for the active branch', async () => {
    (staffApi.updateBranchRole as any).mockResolvedValue({ success: true });
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <EditStaffModal
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
        orgId="org-1"
        member={mockMember}
        branches={mockBranches}
        contextBranchId="branch-1"
        actorRole="owner"
      />
    );

    // Select Storekeeper role
    const storekeeperBtn = screen.getByRole('button', { name: /storekeeper/i });
    fireEvent.click(storekeeperBtn);

    // Click Save
    const saveBtn = screen.getByRole('button', { name: /save role/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(staffApi.updateBranchRole).toHaveBeenCalledWith(
        'org-1',
        'mem-10',
        'branch-1',
        'storekeeper'
      );
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('renders dropdown selector when not in branch context', () => {
    render(
      <EditStaffModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        orgId="org-1"
        member={mockMember}
        branches={mockBranches}
        contextBranchId="all"
        activeBranchId="all"
        actorRole="owner"
      />
    );

    // In 'all' or global context, dropdown is displayed for choosing branch
    expect(screen.getByText('Target Branch:')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByText('Active Context')).not.toBeInTheDocument();
  });
});
