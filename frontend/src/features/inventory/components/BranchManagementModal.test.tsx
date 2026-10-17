import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BranchManagementModal } from './BranchManagementModal';
import { branchApi } from '../branches-api';

vi.mock('../branches-api', () => ({
  branchApi: {
    getBranches: vi.fn(),
    createBranch: vi.fn(),
    updateBranch: vi.fn(),
    deleteBranch: vi.fn(),
    setPrimaryBranch: vi.fn(),
  },
}));

describe('BranchManagementModal (Slide-over Drawer)', () => {
  const mockBranches = [
    {
      id: 'branch-1',
      name: 'Downtown Flagship',
      code: 'DT-01',
      type: 'store' as const,
      status: 'active' as const,
      is_primary: true,
      total_products: 42,
      total_on_hand: 500,
      total_reserved: 12,
    },
    {
      id: 'branch-2',
      name: 'North Fulfillment Center',
      code: 'WH-02',
      type: 'warehouse' as const,
      status: 'active' as const,
      is_primary: false,
      total_products: 35,
      total_on_hand: 1200,
      total_reserved: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(branchApi.getBranches).mockResolvedValue({
      branches: mockBranches as any,
    });
  });

  it('renders as a slide-over drawer when open and displays locations', async () => {
    render(
      <BranchManagementModal
        isOpen={true}
        onClose={vi.fn()}
        currentBranchId="branch-1"
      />
    );

    // Wait for branches to load
    await waitFor(() => {
      expect(screen.getByTestId('branch-management-drawer')).toBeInTheDocument();
      expect(screen.getByText('Branch Management Hub')).toBeInTheDocument();
      expect(screen.getByText('Downtown Flagship')).toBeInTheDocument();
      expect(screen.getByText('North Fulfillment Center')).toBeInTheDocument();
    });

    // Primary badge shown
    expect(screen.getByText('Primary')).toBeInTheDocument();
  });

  it('calls onSelectBranch and closes drawer when Switch is clicked', async () => {
    const handleSelectBranch = vi.fn();
    const handleClose = vi.fn();

    render(
      <BranchManagementModal
        isOpen={true}
        onClose={handleClose}
        currentBranchId="branch-1"
        onSelectBranch={handleSelectBranch}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('North Fulfillment Center')).toBeInTheDocument();
    });

    // Click Switch on branch-2
    const switchBtn = screen.getByRole('button', { name: /Switch/i });
    fireEvent.click(switchBtn);

    expect(handleSelectBranch).toHaveBeenCalledWith(mockBranches[1]);

    // onClose called after animation timeout
    await waitFor(
      () => {
        expect(handleClose).toHaveBeenCalled();
      },
      { timeout: 500 }
    );
  });

  it('navigates to create branch form view', async () => {
    render(
      <BranchManagementModal
        isOpen={true}
        onClose={vi.fn()}
        currentBranchId="branch-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Downtown Flagship')).toBeInTheDocument();
    });

    const addBranchBtn = screen.getByRole('button', { name: /Add Branch/i });
    fireEvent.click(addBranchBtn);

    expect(screen.getByText('Add New Branch')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Victoria Island Flagship/i)).toBeInTheDocument();
  });

  it('triggers onClose when close button is clicked', async () => {
    const handleClose = vi.fn();

    render(
      <BranchManagementModal
        isOpen={true}
        onClose={handleClose}
        currentBranchId="branch-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('branch-drawer-close')).toBeInTheDocument();
    });

    const closeBtn = screen.getByTestId('branch-drawer-close');
    fireEvent.click(closeBtn);

    await waitFor(
      () => {
        expect(handleClose).toHaveBeenCalled();
      },
      { timeout: 500 }
    );
  });
});
