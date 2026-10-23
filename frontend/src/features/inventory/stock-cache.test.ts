import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStockSummaryCacheKey,
  getStockListCacheKey,
  getReceiptsCacheKey,
  loadPersistedStockSummary,
  savePersistedStockSummary,
  loadPersistedStockList,
  savePersistedStockList,
  loadPersistedReceipts,
  savePersistedReceipts,
  invalidatePersistedStock,
} from './stock-cache';

describe('stock-cache (SWR Persistence for Stock Management)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Key Generation', () => {
    it('generates consistent keys for stock summary, list, and receipts', () => {
      expect(getStockSummaryCacheKey('org-1', 'b-1')).toBe('orvio_stock_summary_org-1_b-1');
      expect(getStockSummaryCacheKey('org-1', undefined)).toBe('orvio_stock_summary_org-1_all');
      expect(getStockListCacheKey('org-1', 'b-1')).toBe('orvio_stock_p1_org-1_b-1');
      expect(getReceiptsCacheKey('org-1', 'b-1')).toBe('orvio_receipts_p1_org-1_b-1');
    });

    it('returns null if orgId is missing', () => {
      expect(getStockSummaryCacheKey(undefined)).toBeNull();
      expect(getStockListCacheKey(undefined)).toBeNull();
      expect(getReceiptsCacheKey(undefined)).toBeNull();
    });
  });

  describe('Stock Summary Persistence', () => {
    const mockSummary = {
      totalItemsTracked: 15,
      totalUnitsOnHand: 250,
      totalUnitsReserved: 10,
      totalUnitsAvailable: 240,
      totalEstimatedValue: 500000,
      lowStockCount: 2,
      outOfStockCount: 1,
    };

    it('saves and re-hydrates stock summary', () => {
      savePersistedStockSummary('org-1', 'b-1', mockSummary as any);
      const loaded = loadPersistedStockSummary('org-1', 'b-1');
      expect(loaded).toEqual(mockSummary);
    });

    it('returns null if not in cache', () => {
      expect(loadPersistedStockSummary('org-1', 'b-unknown')).toBeNull();
    });
  });

  describe('Stock List (Page 1) Persistence', () => {
    const mockList = {
      items: [
        {
          id: 'item-1',
          productId: 'p-1',
          productName: 'Engine Oil',
          sku: 'EO-100',
          barcode: null,
          categoryName: 'Fluids',
          quantityOnHand: 45,
          reserved: 0,
          quantityAvailable: 45,
          lowStockThreshold: 10,
          isLowStock: false,
          isOutOfStock: false,
          isExcluded: false,
          trackQuantity: true,
          sellingPrice: 15000,
          updatedAt: '2026-10-18T10:00:00Z',
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    };

    it('saves and loads page 1 stock items', () => {
      savePersistedStockList('org-1', 'b-1', mockList as any);
      const loaded = loadPersistedStockList('org-1', 'b-1');
      expect(loaded).toEqual(mockList);
    });
  });

  describe('Receipts Persistence & Cache Invalidation', () => {
    const mockReceipts = {
      receipts: [
        {
          id: 'rcpt-1',
          reference: 'RCP-001',
          receiptDate: '2026-10-18T12:00:00Z',
          supplierId: 'sup-1',
          supplierName: 'Total Logistics',
          branchId: 'b-1',
          branchName: 'Main Store',
          status: 'completed',
          lineCount: 2,
          totalQuantity: 30,
          totalCost: 150000,
          createdAt: '2026-10-18T12:00:00Z',
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    };

    it('saves receipts and removes them upon branch-specific invalidation', () => {
      savePersistedReceipts('org-1', 'b-1', mockReceipts as any);
      savePersistedStockSummary('org-1', 'b-1', { totalItemsTracked: 1 } as any);
      savePersistedStockSummary('org-1', 'all', { totalItemsTracked: 5 } as any);

      expect(loadPersistedReceipts('org-1', 'b-1')).not.toBeNull();
      expect(loadPersistedStockSummary('org-1', 'all')).not.toBeNull();

      invalidatePersistedStock('org-1', 'b-1');

      expect(loadPersistedReceipts('org-1', 'b-1')).toBeNull();
      expect(loadPersistedStockSummary('org-1', 'b-1')).toBeNull();
      expect(loadPersistedStockSummary('org-1', 'all')).toBeNull(); // Org overview also purged
    });

    it('purges all organization stock keys when no branchId is specified', () => {
      savePersistedStockSummary('org-1', 'b-1', { totalItemsTracked: 1 } as any);
      savePersistedStockSummary('org-1', 'b-2', { totalItemsTracked: 2 } as any);
      savePersistedStockSummary('org-2', 'b-1', { totalItemsTracked: 9 } as any);

      invalidatePersistedStock('org-1');

      expect(loadPersistedStockSummary('org-1', 'b-1')).toBeNull();
      expect(loadPersistedStockSummary('org-1', 'b-2')).toBeNull();
      expect(loadPersistedStockSummary('org-2', 'b-1')).not.toBeNull(); // Other org untouched
    });
  });
});
