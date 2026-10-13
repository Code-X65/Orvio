import { api } from '../../lib/api/client';

export type BranchType = 'store' | 'warehouse' | 'studio' | 'headquarters';
export type BranchStatus = 'active' | 'inactive';

export interface BranchAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string | null;
  type: BranchType;
  status: BranchStatus;
  is_primary: boolean;
  phone: string | null;
  email: string | null;
  address: BranchAddress | null;
  total_products?: number;
  total_on_hand?: number;
  total_reserved?: number;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BranchInventoryStockItem {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  sku: string;
  barcode: string | null;
  unit_of_measure: string;
  category_name: string | null;
  quantity_on_hand: number;
  reserved: number;
  available: number;
  variant_attributes: Record<string, string> | null;
  updated_at: string;
}

export interface CatalogSetupPayload {
  mode: 'empty' | 'clone_all' | 'selective';
  sourceBranchId?: string;
  categoryIds?: string[];
  brandIds?: string[];
  productIds?: string[];
  copyStock?: boolean;
  importTaxonomy?: boolean;
}

export interface CreateBranchPayload {
  name: string;
  code?: string | null;
  type?: BranchType;
  status?: BranchStatus;
  isPrimary?: boolean;
  phone?: string | null;
  email?: string | null;
  address?: BranchAddress | null;
  catalogSetup?: CatalogSetupPayload;
}

export interface UpdateBranchPayload {
  name?: string;
  code?: string | null;
  type?: BranchType;
  status?: BranchStatus;
  isPrimary?: boolean;
  phone?: string | null;
  email?: string | null;
  address?: BranchAddress | null;
}

export interface DeleteBranchOptions {
  confirmWithStock?: boolean;
  reason?: string;
}

export const branchApi = {
  getBranches: async (params?: { activeOnly?: boolean; status?: string; includeDeleted?: boolean }) => {
    return await api.get<{ branches: Branch[] }>('/inventory/branches', { params });
  },

  getBranch: async (id: string) => {
    return await api.get<{ branch: Branch }>(`/inventory/branches/${id}`);
  },

  getBranchStock: async (id: string) => {
    return await api.get<{ stock: BranchInventoryStockItem[] }>(`/inventory/branches/${id}/stock`);
  },

  createBranch: async (payload: CreateBranchPayload) => {
    return await api.post<{ branch: Branch }>('/inventory/branches', payload);
  },

  updateBranch: async (id: string, payload: UpdateBranchPayload) => {
    return await api.patch<{ branch: Branch }>(`/inventory/branches/${id}`, payload);
  },

  deleteBranch: async (id: string, options?: DeleteBranchOptions) => {
    return await api.delete<{ success: boolean }>(`/inventory/branches/${id}`, {
      params: options?.confirmWithStock !== undefined ? { confirmWithStock: String(options.confirmWithStock) } : undefined,
      body: options?.reason ? { reason: options.reason, confirmWithStock: options.confirmWithStock } : undefined,
    });
  },

  restoreBranch: async (id: string) => {
    return await api.patch<{ success: boolean }>(`/inventory/branches/${id}/restore`);
  },
};
