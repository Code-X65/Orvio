import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createBranchSchema,
  updateBranchSchema,
  deleteBranchQuerySchema,
  listBranchesQuerySchema,
} from '../../src/modules/inventory/branches-schemas.js';
import { BranchService } from '../../src/modules/inventory/branches-service.js';
import { AppError } from '../../src/lib/errors.js';

describe('Branch Schemas & Validation', () => {
  it('validates and applies defaults for createBranchSchema', () => {
    const input = {
      name: '  Lagos Main Hub  ',
      code: '  lagos-01  ',
    };
    const parsed = createBranchSchema.parse(input);
    expect(parsed.name).toBe('Lagos Main Hub');
    expect(parsed.code).toBe('lagos-01');
    expect(parsed.type).toBe('store');
    expect(parsed.status).toBe('active');
    expect(parsed.isPrimary).toBe(false);
  });

  it('rejects empty name in createBranchSchema', () => {
    expect(() => createBranchSchema.parse({ name: '   ' })).toThrow();
  });

  it('rejects invalid email format in createBranchSchema', () => {
    expect(() =>
      createBranchSchema.parse({
        name: 'Store',
        email: 'invalid-email',
      })
    ).toThrow();
  });

  it('rejects empty update in updateBranchSchema', () => {
    expect(() => updateBranchSchema.parse({})).toThrow('At least one field must be provided');
  });

  it('parses deleteBranchQuerySchema confirmation flags', () => {
    const parsed = deleteBranchQuerySchema.parse({
      confirmWithStock: 'true',
      reason: 'Lease expired',
    });
    expect(parsed.confirmWithStock).toBe(true);
    expect(parsed.reason).toBe('Lease expired');
  });
});

describe('BranchService (Unit Tests)', () => {
  let mockDb: any;
  let service: BranchService;

  beforeEach(() => {
    mockDb = {
      branch: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
      },
      stockLevel: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb: any) => await cb(mockDb)),
    };
    service = new BranchService(mockDb);
  });

  describe('listBranches', () => {
    it('returns branches with calculated stock summaries', async () => {
      mockDb.branch.findMany.mockResolvedValueOnce([
        {
          id: 'b-1',
          name: 'Main Branch',
          code: 'MAIN',
          type: 'store',
          status: 'active',
          is_primary: true,
          phone: null,
          email: null,
          address: null,
          is_deleted: false,
          deleted_at: null,
          deleted_reason: null,
          created_at: new Date(),
          updated_at: new Date(),
          stock_levels: [
            { quantity_on_hand: 50, reserved: 5, product_id: 'p-1' },
            { quantity_on_hand: 20, reserved: 0, product_id: 'p-2' },
          ],
        },
      ]);

      const result = await service.listBranches('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].total_products).toBe(2);
      expect(result[0].total_on_hand).toBe(70);
      expect(result[0].total_reserved).toBe(5);
    });
  });

  describe('createBranch', () => {
    it('throws DUPLICATE_BRANCH_NAME if name exists in org', async () => {
      mockDb.branch.findFirst.mockResolvedValueOnce({ id: 'existing', name: 'Main Store' });

      await expect(
        service.createBranch('org-1', {
          name: 'Main Store',
          type: 'store',
          status: 'active',
          isPrimary: false,
        })
      ).rejects.toThrowError(AppError);
    });

    it('makes the first branch primary automatically', async () => {
      mockDb.branch.findFirst.mockResolvedValue(null);
      mockDb.branch.count.mockResolvedValueOnce(0); // 0 active branches
      mockDb.branch.create.mockImplementationOnce(({ data }: any) => ({
        id: 'new-b',
        ...data,
      }));

      const branch = await service.createBranch('org-1', {
        name: 'First Store',
        type: 'store',
        status: 'active',
        isPrimary: false,
      });

      expect(branch.is_primary).toBe(true);
    });

    it('demotes existing primaries when a new primary branch is created', async () => {
      mockDb.branch.findFirst.mockResolvedValue(null);
      mockDb.branch.count.mockResolvedValueOnce(1); // 1 existing branch
      mockDb.branch.create.mockImplementationOnce(({ data }: any) => ({
        id: 'new-b',
        ...data,
      }));

      await service.createBranch('org-1', {
        name: 'Second Store',
        type: 'store',
        status: 'active',
        isPrimary: true,
      });

      expect(mockDb.branch.updateMany).toHaveBeenCalledWith({
        where: { org_id: 'org-1', is_primary: true },
        data: { is_primary: false },
      });
    });
  });

  describe('deleteBranch', () => {
    it('blocks deleting the only branch in an organization', async () => {
      mockDb.branch.findFirst.mockResolvedValueOnce({
        id: 'b-1',
        name: 'Solo Branch',
        is_primary: true,
      });
      mockDb.branch.count.mockResolvedValueOnce(1); // Only 1 active branch

      await expect(
        service.deleteBranch('org-1', 'b-1')
      ).rejects.toThrowError('Cannot archive the only branch in your organization');
    });

    it('blocks deleting the primary branch without reassigning', async () => {
      mockDb.branch.findFirst.mockResolvedValueOnce({
        id: 'b-1',
        name: 'Primary Branch',
        is_primary: true,
      });
      mockDb.branch.count.mockResolvedValueOnce(2);

      await expect(
        service.deleteBranch('org-1', 'b-1')
      ).rejects.toThrowError('Cannot archive the primary branch');
    });

    it('blocks deleting branch with active reserved orders', async () => {
      mockDb.branch.findFirst.mockResolvedValueOnce({
        id: 'b-2',
        name: 'Secondary Branch',
        is_primary: false,
      });
      mockDb.branch.count.mockResolvedValueOnce(2);
      mockDb.stockLevel.findMany.mockResolvedValueOnce([
        { quantity_on_hand: 50, reserved: 10 },
      ]);

      await expect(
        service.deleteBranch('org-1', 'b-2')
      ).rejects.toThrowError('active reserved units');
    });

    it('requires confirmation if branch has stock on hand', async () => {
      mockDb.branch.findFirst.mockResolvedValueOnce({
        id: 'b-2',
        name: 'Secondary Branch',
        is_primary: false,
      });
      mockDb.branch.count.mockResolvedValueOnce(2);
      mockDb.stockLevel.findMany.mockResolvedValueOnce([
        { quantity_on_hand: 50, reserved: 0 },
      ]);

      await expect(
        service.deleteBranch('org-1', 'b-2', { confirmWithStock: false })
      ).rejects.toThrowError('Explicit confirmation required');
    });

    it('requires a reason when archiving branch with stock on hand', async () => {
      mockDb.branch.findFirst.mockResolvedValueOnce({
        id: 'b-2',
        name: 'Secondary Branch',
        is_primary: false,
      });
      mockDb.branch.count.mockResolvedValueOnce(2);
      mockDb.stockLevel.findMany.mockResolvedValueOnce([
        { quantity_on_hand: 50, reserved: 0 },
      ]);

      await expect(
        service.deleteBranch('org-1', 'b-2', { confirmWithStock: true, reason: '' })
      ).rejects.toThrowError('A reason is required');
    });

    it('successfully soft-deletes when criteria are met', async () => {
      mockDb.branch.findFirst.mockResolvedValueOnce({
        id: 'b-2',
        name: 'Secondary Branch',
        is_primary: false,
      });
      mockDb.branch.count.mockResolvedValueOnce(2);
      mockDb.stockLevel.findMany.mockResolvedValueOnce([
        { quantity_on_hand: 50, reserved: 0 },
      ]);

      const res = await service.deleteBranch('org-1', 'b-2', {
        confirmWithStock: true,
        reason: 'Consolidating branch operations',
      });

      expect(res.success).toBe(true);
      expect(mockDb.branch.update).toHaveBeenCalledWith({
        where: { id: 'b-2' },
        data: expect.objectContaining({
          is_deleted: true,
          deleted_reason: 'Consolidating branch operations',
        }),
      });
    });
  });

  describe('restoreBranch', () => {
    it('restores soft-deleted branch', async () => {
      mockDb.branch.findFirst
        .mockResolvedValueOnce({
          id: 'b-archived',
          name: 'Old Branch',
          is_deleted: true,
        })
        .mockResolvedValueOnce(null); // No name collision

      const res = await service.restoreBranch('org-1', 'b-archived');
      expect(res.success).toBe(true);
      expect(mockDb.branch.update).toHaveBeenCalledWith({
        where: { id: 'b-archived' },
        data: expect.objectContaining({
          is_deleted: false,
          deleted_at: null,
          deleted_reason: null,
        }),
      });
    });
  });
});
