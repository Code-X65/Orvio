import { api } from '../../lib/api/client';

export interface BranchProductItem {
  id: string;
  org_id: string;
  branch_id: string;
  product_id: string;
  source_branch_id: string | null;
  source_branch_name: string | null;
  is_excluded: boolean;
  notes: string | null;
  added_at: string;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    selling_price: number;
    cost_price: number;
    is_active: boolean;
    image_url: string | null;
    primary_thumbnail_url?: string | null;
    thumbnail_200?: string | null;
    thumbnail_400?: string | null;
    category_id: string | null;
    category_name: string | null;
    brand_id: string | null;
    brand_name: string | null;
    brand_logo: string | null;
    has_variants: boolean;
  };
  quantity_on_hand: number;
  reserved: number;
  available: number;
}

export interface CatalogImportAudit {
  id: string;
  org_id: string;
  source_branch_id: string;
  target_branch_id: string;
  imported_by_user_id: string | null;
  product_count: number;
  copy_stock: boolean;
  notes: string | null;
  created_at: string;
  source_branch_name: string;
  target_branch_name: string;
  user_name: string | null;
}

export interface BranchCatalogSummary {
  branch: {
    id: string;
    name: string;
  };
  totalAssignedProducts: number;
  activeAssignedProducts: number;
  excludedProducts: number;
  importedProductsCount: number;
  categoriesCount: number;
  brandsCount: number;
}

export interface BranchCatalogListResponse {
  items: BranchProductItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    nextCursor?: string | null;
    hasMore?: boolean;
  };
}

export interface ImportCatalogPayload {
  sourceBranchId: string;
  productIds?: string[];
  importAll?: boolean;
  copyStock?: boolean;
  overwriteExisting?: boolean;
  importTaxonomy?: boolean;
  notes?: string;
}

export interface ImportPreviewPayload {
  sourceBranchId: string;
  productIds?: string[];
  importAll?: boolean;
}

export interface ImportPreviewResponse {
  totalProducts: number;
  matchedCategories: Array<{ id: string; name: string; slug: string; path: string }>;
  newCategories: Array<{ name: string; slug: string; path: string; parentName: string | null }>;
  matchedBrands: Array<{ id: string; name: string; slug: string }>;
  newBrands: Array<{ name: string; slug: string }>;
}

export interface ImportCatalogResponse {
  importedCount: number;
  skippedCount: number;
  auditLog: CatalogImportAudit;
}

export interface CatalogImportsResponse {
  imports: CatalogImportAudit[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const catalogApi = {
  getBranchCatalog: async (
    branchId: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      categoryId?: string;
      brandId?: string;
      includeExcluded?: boolean;
      cursor?: string;
    }
  ) => {
    return await api.get<BranchCatalogListResponse>(`/inventory/catalog/branches/${branchId}/products`, {
      params: {
        ...params,
        page: params?.page ? String(params.page) : undefined,
        limit: params?.limit ? String(params.limit) : undefined,
        includeExcluded: params?.includeExcluded !== undefined ? String(params.includeExcluded) : undefined,
        cursor: params?.cursor || undefined,
      },
    });
  },

  assignProduct: async (branchId: string, payload: { productId: string; notes?: string }) => {
    return await api.post<{ assignment: any }>(`/inventory/catalog/branches/${branchId}/products`, payload);
  },

  removeProduct: async (branchId: string, productId: string, reason?: string) => {
    return await api.delete<{ success: boolean }>(`/inventory/catalog/branches/${branchId}/products/${productId}`, {
      params: reason ? { reason } : undefined,
    });
  },

  restoreProduct: async (branchId: string, productId: string) => {
    return await api.post<{ assignment: any }>(`/inventory/catalog/branches/${branchId}/products/${productId}/restore`);
  },

  importCatalog: async (branchId: string, payload: ImportCatalogPayload) => {
    return await api.post<ImportCatalogResponse>(`/inventory/catalog/branches/${branchId}/import`, payload);
  },

  previewImportTaxonomy: async (branchId: string, payload: ImportPreviewPayload) => {
    return await api.post<ImportPreviewResponse>(`/inventory/catalog/branches/${branchId}/import-preview`, payload);
  },

  getBranchCatalogSummary: async (branchId: string) => {
    return await api.get<BranchCatalogSummary>(`/inventory/catalog/branches/${branchId}/summary`);
  },

  getCatalogImports: async (params?: { page?: number; limit?: number }) => {
    return await api.get<CatalogImportsResponse>('/inventory/catalog/imports', {
      params: {
        page: params?.page ? String(params.page) : undefined,
        limit: params?.limit ? String(params.limit) : undefined,
      },
    });
  },
};
