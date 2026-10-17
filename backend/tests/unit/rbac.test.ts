import { describe, it, expect } from 'vitest';
import { canManageRole, hasPermission, ROLE_TIERS, READ_ONLY_ROLES } from '../../src/middleware/rbac.js';

describe('RBAC Middleware and Permissions Matrix', () => {
  describe('ROLE_TIERS and canManageRole', () => {
    it('enforces owner hierarchy over all subordinate roles', () => {
      expect(canManageRole('owner', 'manager')).toBe(true);
      expect(canManageRole('owner', 'storekeeper')).toBe(true);
      expect(canManageRole('owner', 'cashier')).toBe(true);
      expect(canManageRole('owner', 'accountant')).toBe(true);
      // Owner is structural and never assignable via invite/delegation
      expect(canManageRole('owner', 'owner')).toBe(false);
    });

    it('allows manager to manage strictly lower tiers only', () => {
      expect(canManageRole('manager', 'storekeeper')).toBe(true);
      expect(canManageRole('manager', 'cashier')).toBe(true);
      expect(canManageRole('manager', 'accountant')).toBe(true);

      // Cannot manage peer manager or owner
      expect(canManageRole('manager', 'manager')).toBe(false);
      expect(canManageRole('manager', 'owner')).toBe(false);
    });

    it('prevents subordinates from managing or inviting any roles', () => {
      const subordinates = ['storekeeper', 'accountant', 'cashier'] as const;
      for (const sub of subordinates) {
        expect(canManageRole(sub, 'cashier')).toBe(false);
        expect(canManageRole(sub, 'storekeeper')).toBe(false);
        expect(canManageRole(sub, 'manager')).toBe(false);
        expect(canManageRole(sub, 'owner')).toBe(false);
      }
    });
  });

  describe('Capability Permissions Matrix', () => {
    it('restricts catalog CRUD to owner and manager', () => {
      expect(hasPermission('owner', 'catalog_crud')).toBe(true);
      expect(hasPermission('manager', 'catalog_crud')).toBe(true);
      expect(hasPermission('storekeeper', 'catalog_crud')).toBe(false);
      expect(hasPermission('cashier', 'catalog_crud')).toBe(false);
      expect(hasPermission('accountant', 'catalog_crud')).toBe(false);
    });

    it('restricts manual stock adjustments to authorized operations staff', () => {
      expect(hasPermission('owner', 'stock_adjust')).toBe(true);
      expect(hasPermission('manager', 'stock_adjust')).toBe(true);
      expect(hasPermission('storekeeper', 'stock_adjust')).toBe(true);
      expect(hasPermission('cashier', 'stock_adjust')).toBe(false);
      expect(hasPermission('accountant', 'stock_adjust')).toBe(false);
    });

    it('identifies read-only roles correctly', () => {
      expect(READ_ONLY_ROLES).toContain('cashier');
      expect(READ_ONLY_ROLES).toContain('accountant');
      expect(READ_ONLY_ROLES).not.toContain('owner');
      expect(READ_ONLY_ROLES).not.toContain('manager');
      expect(READ_ONLY_ROLES).not.toContain('storekeeper');
    });

    it('restricts staff management to owner and manager', () => {
      expect(hasPermission('owner', 'manage_staff')).toBe(true);
      expect(hasPermission('manager', 'manage_staff')).toBe(true);
      expect(hasPermission('storekeeper', 'manage_staff')).toBe(false);
      expect(hasPermission('cashier', 'manage_staff')).toBe(false);
      expect(hasPermission('accountant', 'manage_staff')).toBe(false);
    });
  });
});
