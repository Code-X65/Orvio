import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCatalogCacheKey,
  loadPersistedCatalog,
  savePersistedCatalog,
  invalidatePersistedCatalog,
} from './catalog-cache';
import type { ProductListResponse } from './products-api';

describe('Catalog Page-1 SWR Cache', () => {
  const orgId = 'org-abc';
  const branchId = 'branch-xyz';

  const mockCatalogResponse: ProductListResponse = {
    products: [
      {
        id: 'prod-1',
        org_id: orgId,
        name: 'Organic Honey',
        sku: 'HONEY-001',
        barcode: '123456789',
        category_id: 'cat-1',
        category_name: 'Groceries',
        brand_id: null,
        brand_name: null,
        brand_logo: null,
        description: null,
        cost_price: 1500,
        selling_price: 2500,
        compare_at_price: null,
        unit_of_measure: 'pcs',
        track_quantity: true,
        low_stock_threshold: 5,
        has_variants: false,
        variants_count: 0,
        is_active: true,
        is_deleted: false,
        business_type: null,
        image_url: null,
        primary_image_url: null,
        primary_thumbnail_url: null,
        thumbnail_200: null,
        thumbnail_400: null,
        metadata: null,
        total_stock: 45,
        reserved_stock: 0,
        available_stock: 45,
        created_at: '',
        updated_at: '',
      },
    ],
    pagination: {
      page: 1,
      limit: 15,
      total: 1,
      totalPages: 1,
    },
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('generates correct cache keys', () => {
    expect(getCatalogCacheKey(orgId, branchId)).toBe(`orvio_catalog_p1_${orgId}_${branchId}`);
    expect(getCatalogCacheKey(orgId, undefined)).toBe(`orvio_catalog_p1_${orgId}_all`);
    expect(getCatalogCacheKey(undefined, branchId)).toBeNull();
  });

  it('saves and loads catalog response from localStorage', () => {
    expect(loadPersistedCatalog(orgId, branchId)).toBeNull();

    savePersistedCatalog(orgId, branchId, mockCatalogResponse);

    const loaded = loadPersistedCatalog(orgId, branchId);
    expect(loaded).toEqual(mockCatalogResponse);
    expect(loaded?.products[0].name).toBe('Organic Honey');
  });

  it('invalidates cache for a specific branch', () => {
    savePersistedCatalog(orgId, 'branch-1', mockCatalogResponse);
    savePersistedCatalog(orgId, 'branch-2', mockCatalogResponse);

    invalidatePersistedCatalog(orgId, 'branch-1');

    expect(loadPersistedCatalog(orgId, 'branch-1')).toBeNull();
    expect(loadPersistedCatalog(orgId, 'branch-2')).not.toBeNull();
  });

  it('invalidates all branches for a given organization', () => {
    savePersistedCatalog(orgId, 'branch-1', mockCatalogResponse);
    savePersistedCatalog(orgId, 'branch-2', mockCatalogResponse);
    savePersistedCatalog('other-org', 'branch-1', mockCatalogResponse);

    invalidatePersistedCatalog(orgId);

    expect(loadPersistedCatalog(orgId, 'branch-1')).toBeNull();
    expect(loadPersistedCatalog(orgId, 'branch-2')).toBeNull();
    expect(loadPersistedCatalog('other-org', 'branch-1')).not.toBeNull();
  });
});
