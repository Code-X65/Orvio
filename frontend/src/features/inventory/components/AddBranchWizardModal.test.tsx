import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddBranchWizardModal } from './AddBranchWizardModal';
import { branchApi } from '../branches-api';

vi.mock('../branches-api', () => ({
  branchApi: {
    createBranch: vi.fn(),
    getBranches: vi.fn().mockResolvedValue({ branches: [] }),
  },
}));

describe('AddBranchWizardModal Component', () => {
  const mockOrg = {
    id: 'org-1',
    name: 'Apex Supermarkets',
    subdomain: 'apex',
    currency: 'NGN',
    businessEmail: 'org@apex.com',
    phone: '+234 801 000 0000',
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    organization: mockOrg,
    onBranchCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Step 1 with operational roles and advances to Step 2', () => {
    render(<AddBranchWizardModal {...defaultProps} />);

    expect(screen.getByText(/What is the role of this new location\?/i)).toBeInTheDocument();
    expect(screen.getByText('Retail Store & Point-of-Sale')).toBeInTheDocument();
    expect(screen.getByText('Warehouse & Bulk Storage')).toBeInTheDocument();

    // Select Warehouse
    fireEvent.click(screen.getByText('Warehouse & Bulk Storage'));

    // Click Continue
    fireEvent.click(screen.getByRole('button', { name: /Continue to Branch Identity/i }));

    // Now in Step 2
    expect(screen.getByText(/Branch branding & contact points/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. Abuja Central Fulfillment Hub/i)).toBeInTheDocument();
  });

  it('validates Step 2 fields before advancing to Step 3', () => {
    render(<AddBranchWizardModal {...defaultProps} />);

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /Continue to Branch Identity/i }));

    // Try to advance without filling required fields
    fireEvent.click(screen.getByRole('button', { name: /Continue to Location Address/i }));

    // Still in Step 2 because name is required
    expect(screen.getByText(/Branch branding & contact points/i)).toBeInTheDocument();

    // Fill name and code
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Abuja Central Fulfillment Hub/i), {
      target: { value: 'Abuja Distribution Hub' },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. ABJ-01/i), {
      target: { value: 'ABJ-02' },
    });

    // Advance to Step 3
    fireEvent.click(screen.getByRole('button', { name: /Continue to Location Address/i }));

    expect(screen.getByText(/Where is this branch located\?/i)).toBeInTheDocument();
  });

  it('submits branch creation and displays celebration screen', async () => {
    const createdMockBranch = {
      id: 'branch-abj',
      name: 'Abuja Distribution Hub',
      code: 'ABJ-02',
      type: 'warehouse' as const,
      status: 'active' as const,
      is_primary: false,
      phone: '+234 801 000 0000',
      email: 'org@apex.com',
      address: {
        country: 'Nigeria',
        state: 'FCT - Abuja',
        city: 'Garki',
        street: 'Plot 100 Garki Area 1',
      },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    vi.mocked(branchApi.createBranch).mockResolvedValueOnce({
      branch: createdMockBranch,
    });

    render(<AddBranchWizardModal {...defaultProps} />);

    // Step 1: Select Warehouse
    fireEvent.click(screen.getByText('Warehouse & Bulk Storage'));
    fireEvent.click(screen.getByRole('button', { name: /Continue to Branch Identity/i }));

    // Step 2: Name & Code
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Abuja Central Fulfillment Hub/i), {
      target: { value: 'Abuja Distribution Hub' },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. ABJ-01/i), {
      target: { value: 'ABJ-02' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Location Address/i }));

    // Step 3: Location
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Central Business District/i), {
      target: { value: 'Garki' },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Plot 405 Constitution Avenue/i), {
      target: { value: 'Plot 100 Garki Area 1' },
    });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Complete & Launch Branch/i }));

    // Wait for celebration screen
    await waitFor(() => {
      expect(screen.getByText('Abuja Distribution Hub is Live!')).toBeInTheDocument();
    });

    expect(branchApi.createBranch).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Abuja Distribution Hub',
        code: 'ABJ-02',
        type: 'warehouse',
      })
    );

    // Click "Open Branch Workspace"
    fireEvent.click(screen.getByRole('button', { name: /Open Abuja Distribution Hub Workspace/i }));

    expect(defaultProps.onBranchCreated).toHaveBeenCalledWith(createdMockBranch);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders Step 4 Catalog Setup when existing branches are present and supports clone mode', async () => {
    const existingBranches = [
      { id: 'branch-1', name: 'Lagos Main Store', code: 'LOS-01', is_primary: true },
    ];

    const createdBranch = {
      id: 'branch-2',
      name: 'Ikeja Branch',
      code: 'IKJ-01',
      type: 'store' as const,
      status: 'active' as const,
      is_primary: false,
      phone: null,
      email: null,
      address: { country: 'Nigeria', state: 'Lagos', city: 'Ikeja', street: '10 Allen Ave' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    vi.mocked(branchApi.createBranch).mockResolvedValueOnce({
      branch: createdBranch,
    });

    render(<AddBranchWizardModal {...defaultProps} branches={existingBranches} />);

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /Continue to Branch Identity/i }));

    // Step 2 -> Step 3
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Abuja Central Fulfillment Hub/i), {
      target: { value: 'Ikeja Branch' },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. ABJ-01/i), {
      target: { value: 'IKJ-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Location Address/i }));

    // Step 3 -> Step 4
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Central Business District/i), {
      target: { value: 'Ikeja' },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Plot 405 Constitution Avenue/i), {
      target: { value: '10 Allen Ave' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Catalog Setup/i }));

    // Now in Step 4
    expect(screen.getByText('Catalog Setup for New Branch')).toBeInTheDocument();
    expect(screen.getByText('Clone Entire Catalog')).toBeInTheDocument();

    // Select Clone Entire Catalog
    fireEvent.click(screen.getByText('Clone Entire Catalog'));

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Complete & Launch Branch/i }));

    await waitFor(() => {
      expect(screen.getByText('Ikeja Branch is Live!')).toBeInTheDocument();
    });

    expect(branchApi.createBranch).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ikeja Branch',
        code: 'IKJ-01',
        catalogSetup: expect.objectContaining({
          mode: 'clone_all',
          sourceBranchId: 'branch-1',
        }),
      })
    );
  });
});
