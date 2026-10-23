import type { StockSummary, StockListResponse } from './stock-api';
import type { StockReceiptsResponse } from './stock-receipts-api';

export const STOCK_CACHE_PREFIX = 'orvio_stock_';
export const RECEIPTS_CACHE_PREFIX = 'orvio_receipts_';

export function getStockSummaryCacheKey(orgId?: string, branchId?: string): string | null {
  if (!orgId) return null;
  const branchKey = branchId || 'all';
  return `${STOCK_CACHE_PREFIX}summary_${orgId}_${branchKey}`;
}

export function getStockListCacheKey(orgId?: string, branchId?: string): string | null {
  if (!orgId) return null;
  const branchKey = branchId || 'all';
  return `${STOCK_CACHE_PREFIX}p1_${orgId}_${branchKey}`;
}

export function getReceiptsCacheKey(orgId?: string, branchId?: string): string | null {
  if (!orgId) return null;
  const branchKey = branchId || 'all';
  return `${RECEIPTS_CACHE_PREFIX}p1_${orgId}_${branchKey}`;
}

/* ========================================================================= */
/* Stock Summary Persistence                                                 */
/* ========================================================================= */

export function loadPersistedStockSummary(orgId?: string, branchId?: string): StockSummary | null {
  if (typeof window === 'undefined') return null;
  const key = getStockSummaryCacheKey(orgId, branchId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore JSON parse errors
  }
  return null;
}

export function savePersistedStockSummary(
  orgId?: string,
  branchId?: string,
  data?: StockSummary | null
): void {
  if (typeof window === 'undefined') return;
  const key = getStockSummaryCacheKey(orgId, branchId);
  if (!key) return;
  try {
    if (data) {
      localStorage.setItem(key, JSON.stringify(data));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage quota error
  }
}

/* ========================================================================= */
/* Stock List (Page 1) Persistence                                           */
/* ========================================================================= */

export function loadPersistedStockList(orgId?: string, branchId?: string): StockListResponse | null {
  if (typeof window === 'undefined') return null;
  const key = getStockListCacheKey(orgId, branchId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

export function savePersistedStockList(
  orgId?: string,
  branchId?: string,
  data?: StockListResponse | null
): void {
  if (typeof window === 'undefined') return;
  const key = getStockListCacheKey(orgId, branchId);
  if (!key) return;
  try {
    if (data && data.items && data.items.length > 0) {
      localStorage.setItem(key, JSON.stringify(data));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage quota error
  }
}

/* ========================================================================= */
/* Receipts (Page 1) Persistence                                             */
/* ========================================================================= */

export function loadPersistedReceipts(orgId?: string, branchId?: string): StockReceiptsResponse | null {
  if (typeof window === 'undefined') return null;
  const key = getReceiptsCacheKey(orgId, branchId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

export function savePersistedReceipts(
  orgId?: string,
  branchId?: string,
  data?: StockReceiptsResponse | null
): void {
  if (typeof window === 'undefined') return;
  const key = getReceiptsCacheKey(orgId, branchId);
  if (!key) return;
  try {
    if (data && data.receipts && data.receipts.length > 0) {
      localStorage.setItem(key, JSON.stringify(data));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage quota error
  }
}

/* ========================================================================= */
/* Cache Invalidation Utilities                                              */
/* ========================================================================= */

export function invalidatePersistedStock(orgId?: string, branchId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (orgId && branchId) {
      const summaryKey = getStockSummaryCacheKey(orgId, branchId);
      const listKey = getStockListCacheKey(orgId, branchId);
      const receiptKey = getReceiptsCacheKey(orgId, branchId);
      if (summaryKey) localStorage.removeItem(summaryKey);
      if (listKey) localStorage.removeItem(listKey);
      if (receiptKey) localStorage.removeItem(receiptKey);

      // Also invalidate 'all' overview keys for the org when branch stock changes
      if (branchId !== 'all') {
        const summaryAll = getStockSummaryCacheKey(orgId, 'all');
        const listAll = getStockListCacheKey(orgId, 'all');
        const receiptAll = getReceiptsCacheKey(orgId, 'all');
        if (summaryAll) localStorage.removeItem(summaryAll);
        if (listAll) localStorage.removeItem(listAll);
        if (receiptAll) localStorage.removeItem(receiptAll);
      }
    } else if (orgId) {
      const stockPrefix = `${STOCK_CACHE_PREFIX}`;
      const receiptPrefix = `${RECEIPTS_CACHE_PREFIX}`;
      Object.keys(localStorage).forEach((k) => {
        if (
          (k.startsWith(stockPrefix) || k.startsWith(receiptPrefix)) &&
          k.includes(`_${orgId}_`)
        ) {
          localStorage.removeItem(k);
        }
      });
    } else {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith(STOCK_CACHE_PREFIX) || k.startsWith(RECEIPTS_CACHE_PREFIX)) {
          localStorage.removeItem(k);
        }
      });
    }
  } catch {
    // Ignore storage error
  }
}
