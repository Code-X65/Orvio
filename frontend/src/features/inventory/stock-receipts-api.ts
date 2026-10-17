import { api } from '../../lib/api/client';

export interface StockReceiptItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  variantId: string | null;
  variantSku?: string | null;
  quantityReceived: number;
  unitCost: number | null;
  totalCost: number | null;
  notes: string | null;
}

export interface StockReceipt {
  id: string;
  reference: string;
  receiptDate: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  branchName: string;
  supplierInvoiceNumber: string | null;
  notes: string | null;
  status: string;
  lineCount: number;
  totalQuantity: number;
  totalCost: number | null;
  receivedById: string | null;
  receivedByName: string | null;
  createdAt: string;
  items?: StockReceiptItem[];
}

export interface StockReceiptDetail extends StockReceipt {
  supplierDetails?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    contact_person: string | null;
    address: string | null;
  };
  createdByName?: string | null;
  items: StockReceiptItem[];
  movements: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    quantity: number;
    balanceBefore: number;
    balanceAfter: number;
    createdAt: string;
  }>;
}

export interface ListStockReceiptsResponse {
  receipts: StockReceipt[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateStockReceiptPayload {
  branchId: string;
  supplierId: string;
  reference?: string | null;
  receiptDate?: string | null;
  supplierInvoiceNumber?: string | null;
  notes?: string | null;
  items: Array<{
    productId: string;
    variantId?: string | null;
    quantityReceived: number;
    unitCost?: number | null;
    notes?: string | null;
  }>;
}

export const stockReceiptsApi = {
  listReceipts: async (params?: {
    branchId?: string;
    supplierId?: string;
    productId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortBy?: 'receipt_date' | 'reference' | 'created_at';
    sortOrder?: 'asc' | 'desc';
  }): Promise<ListStockReceiptsResponse> => {
    return api.get<ListStockReceiptsResponse>('/inventory/stock/receipts', {
      params: {
        ...(params?.branchId && params.branchId !== 'all' ? { branchId: params.branchId } : {}),
        ...(params?.supplierId ? { supplierId: params.supplierId } : {}),
        ...(params?.productId ? { productId: params.productId } : {}),
        ...(params?.search ? { search: params.search } : {}),
        ...(params?.startDate ? { startDate: params.startDate } : {}),
        ...(params?.endDate ? { endDate: params.endDate } : {}),
        ...(params?.page ? { page: String(params.page) } : {}),
        ...(params?.limit ? { limit: String(params.limit) } : {}),
        ...(params?.sortBy ? { sortBy: params.sortBy } : {}),
        ...(params?.sortOrder ? { sortOrder: params.sortOrder } : {}),
      },
    });
  },

  getReceipt: async (id: string): Promise<StockReceiptDetail> => {
    return api.get<StockReceiptDetail>(`/inventory/stock/receipts/${id}`);
  },

  createReceipt: async (payload: CreateStockReceiptPayload): Promise<StockReceipt> => {
    return api.post<StockReceipt>('/inventory/stock/receipts', payload);
  },
};
