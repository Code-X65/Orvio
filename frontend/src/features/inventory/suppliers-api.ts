import { api } from '../../lib/api/client';

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  contactPerson: string | null;
  taxId: string | null;
  notes: string | null;
  isActive: boolean;
  receiptsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDetail extends Supplier {
  recentReceipts: Array<{
    id: string;
    reference: string;
    receiptDate: string;
    branchId: string;
    branchName: string;
    supplierInvoiceNumber: string | null;
    itemCount: number;
    status: string;
  }>;
}

export interface ListSuppliersResponse {
  suppliers: Supplier[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateSupplierPayload {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  taxId?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface UpdateSupplierPayload {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  taxId?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface CheckDuplicatesPayload {
  name?: string;
  phone?: string;
  excludeId?: string;
}

export interface CheckDuplicatesResponse {
  hasDuplicates: boolean;
  matches: Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    is_active: boolean;
  }>;
}

export const supplierApi = {
  listSuppliers: async (params?: {
    search?: string;
    activeOnly?: boolean;
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'created_at' | 'receipts_count';
    sortOrder?: 'asc' | 'desc';
  }): Promise<ListSuppliersResponse> => {
    return api.get<ListSuppliersResponse>('/inventory/suppliers', {
      params: {
        ...(params?.search ? { search: params.search } : {}),
        ...(params?.activeOnly !== undefined ? { activeOnly: String(params.activeOnly) } : {}),
        ...(params?.page ? { page: String(params.page) } : {}),
        ...(params?.limit ? { limit: String(params.limit) } : {}),
        ...(params?.sortBy ? { sortBy: params.sortBy } : {}),
        ...(params?.sortOrder ? { sortOrder: params.sortOrder } : {}),
      },
    });
  },

  getSupplier: async (id: string): Promise<SupplierDetail> => {
    return api.get<SupplierDetail>(`/inventory/suppliers/${id}`);
  },

  createSupplier: async (
    payload: CreateSupplierPayload
  ): Promise<{ supplier: Supplier; duplicateWarning: string | null }> => {
    return api.post<{ supplier: Supplier; duplicateWarning: string | null }>(
      '/inventory/suppliers',
      payload
    );
  },

  updateSupplier: async (id: string, payload: UpdateSupplierPayload): Promise<Supplier> => {
    return api.patch<Supplier>(`/inventory/suppliers/${id}`, payload);
  },

  deactivateSupplier: async (id: string): Promise<{ id: string; isActive: boolean; message: string }> => {
    return api.post<{ id: string; isActive: boolean; message: string }>(
      `/inventory/suppliers/${id}/deactivate`
    );
  },

  activateSupplier: async (id: string): Promise<{ id: string; isActive: boolean; message: string }> => {
    return api.post<{ id: string; isActive: boolean; message: string }>(
      `/inventory/suppliers/${id}/activate`
    );
  },

  checkDuplicates: async (payload: CheckDuplicatesPayload): Promise<CheckDuplicatesResponse> => {
    return api.post<CheckDuplicatesResponse>('/inventory/suppliers/check-duplicates', payload);
  },
};
