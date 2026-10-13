import { api } from '../../lib/api/client';

export interface StockItem {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  sku: string;
  barcode: string | null;
  imageUrl: string | null;
  categoryName: string | null;
  brandName: string | null;
  branchId: string;
  branchName: string;
  quantityOnHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  unitOfMeasure: string;
  updatedAt: string;
}

export interface StockSummary {
  totalTracked: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalQuantityOnHand: number;
  totalReserved: number;
  totalAvailable: number;
}

export interface StockMovement {
  id: string;
  orgId: string;
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  productSku: string;
  productImageUrl: string | null;
  movementType: 'opening' | 'receipt' | 'adjustment' | 'transfer_out' | 'transfer_in' | 'sale' | 'sale_void';
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: 'damage' | 'loss' | 'found' | 'correction' | 'count_reconciliation' | 'other' | null;
  referenceId: string | null;
  actorId: string | null;
  actorName: string;
  notes: string | null;
  createdAt: string;
}

export interface StockListResponse {
  items: StockItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface StockMovementsResponse {
  movements: StockMovement[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface RecordOpeningStockPayload {
  branchId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  notes?: string;
}

export interface ReceiveStockPayload {
  branchId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  reference?: string;
  notes?: string;
}

export interface AdjustStockPayload {
  branchId: string;
  productId: string;
  variantId?: string;
  mode: 'delta' | 'counted';
  value: number;
  reason: 'damage' | 'loss' | 'found' | 'correction' | 'count_reconciliation' | 'other';
  notes?: string;
}

export interface TransferStockPayload {
  sourceBranchId: string;
  destinationBranchId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  notes?: string;
}

export const stockApi = {
  getStockSummary: async (branchId?: string): Promise<StockSummary> => {
    const params = branchId && branchId !== 'all' ? { branchId } : undefined;
    return api.get<StockSummary>('/inventory/stock/summary', { params });
  },

  listStockItems: async (params?: {
    branchId?: string;
    search?: string;
    categoryId?: string;
    brandId?: string;
    status?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
    page?: number;
    limit?: number;
  }): Promise<StockListResponse> => {
    return api.get<StockListResponse>('/inventory/stock/items', { params });
  },

  listStockMovements: async (params?: {
    branchId?: string;
    productId?: string;
    movementType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<StockMovementsResponse> => {
    return api.get<StockMovementsResponse>('/inventory/stock/movements', { params });
  },

  recordOpeningStock: async (payload: RecordOpeningStockPayload) => {
    return api.post('/inventory/stock/opening', payload);
  },

  receiveStock: async (payload: ReceiveStockPayload) => {
    return api.post('/inventory/stock/receive', payload);
  },

  adjustStock: async (payload: AdjustStockPayload) => {
    return api.post('/inventory/stock/adjust', payload);
  },

  transferStock: async (payload: TransferStockPayload) => {
    return api.post('/inventory/stock/transfer', payload);
  },
};
