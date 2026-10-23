import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StaffListPage } from './StaffListPage';
import { staffApi } from '../api/staff-api';

vi.mock('../api/staff-api', () => ({
  staffApi: {
    listStaff: vi.fn(),
    inviteStaff: vi.fn(),
    updateMember: vi.fn(),
    suspendMember: vi.fn(),
    reactivateMember: vi.fn(),
    revokeInvitation: vi.fn(),
    resendInvitation: vi.fn(),
    removeMember: vi.fn(),
  },
}));

vi.mock('../../../stores/auth-store', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      user: { id: 'user-1', email: 'owner@acme.com', fullName: 'Alice Owner' },
    })
  ),
}));

describe('StaffListPage Component', () => {
  const mockBranches = [
    { id: 'branch-1', name: 'HQ Store', code: 'HQ', is_primary: true },
    { id: 'branch-2', name: 'Lekki Annex', code: 'LK', is_primary: false },
  ];

  const mockOrg = {
    id: 'org-1',
    name: 'Acme Retail',
    subdomain: 'acme',
  };

  const mockStaffData = {
    members: [
      {
        membershipId: 'mem-1',
        userId: 'user-1',
        email: 'owner@acme.com',
        fullName: 'Alice Owner',
        role: 'owner',
        legacyRole: 'owner',
        status: 'active',
        scopeAllBranches: true,
        branches: [],
        createdAt: new Date().toISOString(),
      },
      {
        membershipId: 'mem-2',
        userId: 'user-2',
        email: 'bob@acme.com',
        fullName: 'Bob Storekeeper',
        role: 'storekeeper',
        legacyRole: 'member',
        status: 'active',
        scopeAllBranches: false,
        branches: [
          {
            id: 'branch-1',
            name: 'HQ Store',
            code: 'HQ',
            isPrimary: true,
            isDefault: true,
            grantedAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
      },
    ],
    invitations: [
      {
        id: 'inv-1',
        email: 'carol@acme.com',
        role: 'cashier',
        status: 'pending',
        default_branch_id: 'branch-1',
        branches: [{ id: 'branch-1', name: 'HQ Store' }],
        expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
      },
    ],
    branches: mockBranches,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (staffApi.listStaff as any).mockResolvedValue(mockStaffData);
  });

  it('renders staff directory with member rows, role badges, and branch tags', async () => {
    render(
      <StaffListPage
        organization={mockOrg}
        branches={mockBranches}
      />
    );

    expect(screen.getByText(/Staff & Access Management/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Alice Owner')).toBeInTheDocument();
      expect(screen.getByText('Bob Storekeeper')).toBeInTheDocument();
      expect(screen.getByText('Global (All Branches)')).toBeInTheDocument();
      expect(screen.getAllByText('HQ Store').length).toBeGreaterThan(0);
    });
  });

  it('switches to Pending Invites tab and renders invitation items', async () => {
    render(
      <StaffListPage
        organization={mockOrg}
        branches={mockBranches}
      />
    );

    const pendingBtn = await screen.findByRole('button', { name: /Pending Invites/i });
    fireEvent.click(pendingBtn);

    await waitFor(() => {
      expect(screen.getByText('carol@acme.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Resend/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Revoke/i })).toBeInTheDocument();
    });
  });

  it('opens InviteStaffModal when clicking Invite Staff button', async () => {
    render(
      <StaffListPage
        organization={mockOrg}
        branches={mockBranches}
      />
    );

    const inviteBtn = screen.getByRole('button', { name: /Invite Staff/i });
    fireEvent.click(inviteBtn);

    expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/employee@company.com/i)).toBeInTheDocument();
  });

  it('allows owner to open remove confirmation modal and permanently remove a staff member', async () => {
    (staffApi.removeMember as any).mockResolvedValue({ success: true, message: 'Member removed' });

    render(
      <StaffListPage
        organization={mockOrg}
        branches={mockBranches}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Bob Storekeeper')).toBeInTheDocument();
    });

    // Bob has a kebab menu button
    const memberRows = screen.getAllByRole('row');
    // Row 0 is header, Row 1 is Alice Owner (no action menu for owner), Row 2 is Bob Storekeeper
    const bobRow = memberRows.find((row) => row.textContent?.includes('Bob Storekeeper'));
    expect(bobRow).toBeDefined();

    // Click kebab menu button in Bob's row
    const actionButtons = bobRow!.querySelectorAll('button');
    expect(actionButtons.length).toBeGreaterThan(0);
    fireEvent.click(actionButtons[0]);

    // Check menu options
    expect(screen.getByText('Edit Permissions')).toBeInTheDocument();
    expect(screen.getByText('Suspend Access')).toBeInTheDocument();
    const removeBtn = screen.getByText('Remove from Org');
    expect(removeBtn).toBeInTheDocument();

    // Click "Remove from Org" to open confirmation modal
    fireEvent.click(removeBtn);

    // Modal dialog is displayed
    expect(screen.getByText('Remove Staff Member')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to remove/i)).toBeInTheDocument();
    expect(screen.getByText(/Notice: Immediate Realtime Ejection/i)).toBeInTheDocument();

    // Click Confirm Remove
    const confirmBtn = screen.getByRole('button', { name: /Confirm Remove/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(staffApi.removeMember).toHaveBeenCalledWith('org-1', 'mem-2');
    });
  });

  it('reloads staff directory when receiving orvio:staff-updated real-time event', async () => {
    render(
      <StaffListPage
        organization={mockOrg}
        branches={mockBranches}
      />
    );

    await waitFor(() => {
      expect(staffApi.listStaff).toHaveBeenCalledTimes(1);
    });

    // Simulate cross-tab or WebSocket staff:updated broadcast
    window.dispatchEvent(new CustomEvent('orvio:staff-updated'));

    await waitFor(() => {
      expect(staffApi.listStaff).toHaveBeenCalledTimes(2);
    });
  });
});

