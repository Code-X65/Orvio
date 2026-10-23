import type { ProductListResponse } from './products-api';

export const CATALOG_CACHE_PREFIX = 'orvio_catalog_p1_';

export function getCatalogCacheKey(orgId?: string, branchId?: string): string | null {
  if (!orgId) return null;
  const branchKey = branchId || 'all';
  return `${CATALOG_CACHE_PREFIX}${orgId}_${branchKey}`;
}

export function loadPersistedCatalog(orgId?: string, branchId?: string): ProductListResponse | null {
  if (typeof window === 'undefined') return null;
  const key = getCatalogCacheKey(orgId, branchId);
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

export function savePersistedCatalog(
  orgId?: string,
  branchId?: string,
  data?: ProductListResponse | null
): void {
  if (typeof window === 'undefined') return;
  const key = getCatalogCacheKey(orgId, branchId);
  if (!key) return;
  try {
    if (data && data.products && data.products.length > 0) {
      localStorage.setItem(key, JSON.stringify(data));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage quota error
  }
}

export function invalidatePersistedCatalog(orgId?: string, branchId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (orgId && branchId) {
      const key = getCatalogCacheKey(orgId, branchId);
      if (key) localStorage.removeItem(key);
    } else if (orgId) {
      const prefix = `${CATALOG_CACHE_PREFIX}${orgId}_`;
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith(prefix)) {
          localStorage.removeItem(k);
        }
      });
    } else {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith(CATALOG_CACHE_PREFIX)) {
          localStorage.removeItem(k);
        }
      });
    }
  } catch {
    // Ignore storage error
  }
}
