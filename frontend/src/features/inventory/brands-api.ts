import { api } from '../../lib/api/client';

export interface Brand {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  is_active: boolean;
  is_deleted: boolean;
  deleted_at?: string | null;
  deleted_by_user_id?: string | null;
  deleted_reason?: string | null;
  sort_order: number;
  product_count: number;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBrandPayload {
  name: string;
  slug?: string;
  branchId?: string;
  description?: string | null;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateBrandPayload {
  name?: string;
  slug?: string;
  description?: string | null;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown> | null;
}

export interface BrandsListResponse {
  brands: Brand[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface BrandDetailResponse {
  brand: Brand;
}

export interface BrandProductsResponse {
  total: number;
  products: Array<{
    id: string;
    name: string;
    sku: string;
    selling_price: number;
    image_url: string | null;
  }>;
}

export const brandApi = {
  getBrands: async (params?: {
    search?: string;
    branchId?: string;
    activeOnly?: boolean;
    includeDeleted?: boolean;
    sortBy?: 'name' | 'sort_order' | 'created_at';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) => {
    return await api.get<BrandsListResponse>('/inventory/brands', {
      params: {
        ...params,
        branchId: params?.branchId || undefined,
        activeOnly: params?.activeOnly !== undefined ? String(params.activeOnly) : undefined,
        includeDeleted: params?.includeDeleted !== undefined ? String(params.includeDeleted) : undefined,
        page: params?.page ? String(params.page) : undefined,
        limit: params?.limit ? String(params.limit) : undefined,
      },
    });
  },

  getBrand: async (id: string) => {
    return await api.get<BrandDetailResponse>(`/inventory/brands/${id}`);
  },

  createBrand: async (payload: CreateBrandPayload) => {
    return await api.post<BrandDetailResponse>('/inventory/brands', payload);
  },

  updateBrand: async (id: string, payload: UpdateBrandPayload) => {
    return await api.patch<BrandDetailResponse>(`/inventory/brands/${id}`, payload);
  },

  deleteBrand: async (id: string, options?: { reassignToBrandId?: string; reason?: string }) => {
    return await api.delete<{ success: boolean; reassignedCount: number }>(`/inventory/brands/${id}`, {
      params: options,
    });
  },

  restoreBrand: async (id: string) => {
    return await api.patch<BrandDetailResponse>(`/inventory/brands/${id}/restore`);
  },

  getBrandProducts: async (id: string, params?: { page?: number; limit?: number }) => {
    return await api.get<BrandProductsResponse>(`/inventory/brands/${id}/products`, {
      params: {
        page: params?.page ? String(params.page) : undefined,
        limit: params?.limit ? String(params.limit) : undefined,
      },
    });
  },
};
