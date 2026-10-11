import { describe, it, expect, vi, beforeEach } from 'vitest';
import { branchApi } from './branches-api';
import { api } from '../../lib/api/client';

vi.mock('../../lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Branch API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches branches with activeOnly filter', async () => {
    const mockBranches = [
      {
        id: 'branch-1',
        name: 'Main Store',
        code: 'MAIN',
        type: 'store',
        status: 'active',
        is_primary: true,
        phone: null,
        email: null,
        address: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    vi.mocked(api.get).mockResolvedValueOnce({ branches: mockBranches });

    const res = await branchApi.getBranches({ activeOnly: true });

    expect(api.get).toHaveBeenCalledWith('/inventory/branches', {
      params: { activeOnly: true },
    });
    expect(res.branches).toEqual(mockBranches);
  });

  it('creates a new branch with valid payload', async () => {
    const newBranch = {
      name: 'Victoria Island Hub',
      code: 'VI-01',
      type: 'store' as const,
      status: 'active' as const,
      isPrimary: false,
    };

    vi.mocked(api.post).mockResolvedValueOnce({
      branch: { ...newBranch, id: 'branch-2', created_at: '', updated_at: '' },
    });

    const res = await branchApi.createBranch(newBranch);

    expect(api.post).toHaveBeenCalledWith('/inventory/branches', newBranch);
    expect(res.branch.name).toBe('Victoria Island Hub');
  });

  it('updates an existing branch', async () => {
    const updatePayload = {
      name: 'Victoria Island Flagship',
      isPrimary: true,
    };

    vi.mocked(api.patch).mockResolvedValueOnce({
      branch: { id: 'branch-2', name: 'Victoria Island Flagship', is_primary: true },
    });

    const res = await branchApi.updateBranch('branch-2', updatePayload);

    expect(api.patch).toHaveBeenCalledWith('/inventory/branches/branch-2', updatePayload);
    expect(res.branch.name).toBe('Victoria Island Flagship');
  });

  it('deletes branch with stock confirmation and reason', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ success: true });

    const res = await branchApi.deleteBranch('branch-2', {
      confirmWithStock: true,
      reason: 'Relocating inventory to warehouse',
    });

    expect(api.delete).toHaveBeenCalledWith('/inventory/branches/branch-2', {
      params: { confirmWithStock: 'true' },
      body: {
        confirmWithStock: true,
        reason: 'Relocating inventory to warehouse',
      },
    });
    expect(res.success).toBe(true);
  });

  it('restores a soft-deleted branch', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ success: true });

    const res = await branchApi.restoreBranch('branch-2');

    expect(api.patch).toHaveBeenCalledWith('/inventory/branches/branch-2/restore');
    expect(res.success).toBe(true);
  });

  it('fetches branch inventory stock levels', async () => {
    const mockStock = [
      {
        id: 'sl-1',
        product_id: 'prod-1',
        variant_id: null,
        product_name: 'Organic Milk',
        sku: 'MILK-01',
        barcode: '1234567890',
        unit_of_measure: 'pcs',
        category_name: 'Dairy',
        quantity_on_hand: 50,
        reserved: 5,
        available: 45,
        variant_attributes: null,
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    vi.mocked(api.get).mockResolvedValueOnce({ stock: mockStock });

    const res = await branchApi.getBranchStock('branch-1');

    expect(api.get).toHaveBeenCalledWith('/inventory/branches/branch-1/stock');
    expect(res.stock).toEqual(mockStock);
  });
});
