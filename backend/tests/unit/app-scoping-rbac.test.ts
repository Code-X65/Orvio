import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireRole } from '../../src/middleware/rbac.js';
import { extractRequestedBranchId, requireBranchScope } from '../../src/middleware/branch-guard.js';
import { AppError } from '../../src/lib/errors.js';

describe('App & Branch Scoping RBAC Guards', () => {
  describe('requireRole on Product Mutations & Branch Management', () => {
    it('allows owner to access owner-only routes', async () => {
      const mockReq: any = {
        auth: {
          membership: { org_role: 'owner' },
        },
      };
      const guard = requireRole('owner');
      await expect(guard(mockReq)).resolves.toBeUndefined();
    });

    it('rejects storekeeper attempting to mutate products (403 Forbidden)', async () => {
      const mockReq: any = {
        auth: {
          membership: { org_role: 'storekeeper' },
        },
      };
      const guard = requireRole('owner');
      await expect(guard(mockReq)).rejects.toThrowError(AppError);
      await expect(guard(mockReq)).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('allows owner and manager to access branch management routes', async () => {
      const guard = requireRole('owner', 'manager');
      await expect(guard({ auth: { membership: { org_role: 'owner' } } } as any)).resolves.toBeUndefined();
      await expect(guard({ auth: { membership: { org_role: 'manager' } } } as any)).resolves.toBeUndefined();
    });

    it('rejects cashier or storekeeper from branch management routes', async () => {
      const guard = requireRole('owner', 'manager');
      await expect(guard({ auth: { membership: { org_role: 'cashier' } } } as any)).rejects.toThrowError(AppError);
      await expect(guard({ auth: { membership: { org_role: 'storekeeper' } } } as any)).rejects.toThrowError(AppError);
    });
  });

  describe('extractRequestedBranchId support for :id param', () => {
    it('extracts branch ID from params.id on /branches/:id', () => {
      const req: any = { params: { id: 'branch-999' } };
      expect(extractRequestedBranchId(req)).toBe('branch-999');
    });

    it('prioritizes params.branchId when available', () => {
      const req: any = { params: { branchId: 'branch-123', id: 'other' } };
      expect(extractRequestedBranchId(req)).toBe('branch-123');
    });
  });
});
