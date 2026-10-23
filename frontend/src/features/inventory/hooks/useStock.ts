import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  stockApi,
  type StockSummary,
  type StockListResponse,
  type StockMovementsResponse,
  type RecordOpeningStockPayload,
  type ReceiveStockPayload,
  type AdjustStockPayload,
  type TransferStockPayload,
} from '../stock-api';
import {
  stockReceiptsApi,
  type StockReceiptsResponse,
} from '../stock-receipts-api';
import { useAuthStore } from '../../../stores/auth-store';
import {
  loadPersistedStockSummary,
  savePersistedStockSummary,
  loadPersistedStockList,
  savePersistedStockList,
  loadPersistedReceipts,
  savePersistedReceipts,
  invalidatePersistedStock,
} from '../stock-cache';

export function useStockSummary(branchId?: string, options: { enabled?: boolean } = {}) {
  const organizationId = useAuthStore((state) => state.organization?.id);
  const cached = organizationId ? loadPersistedStockSummary(organizationId, branchId) : null;

  return useQuery<StockSummary, Error>({
    queryKey: ['inventory', 'stock', 'summary', branchId ?? 'all'],
    queryFn: async () => {
      const summary = await stockApi.getStockSummary(branchId);
      if (organizationId) {
        savePersistedStockSummary(organizationId, branchId, summary);
      }
      return summary;
    },
    ...(cached ? { initialData: cached, initialDataUpdatedAt: 0 } : {}),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled: options.enabled ?? true,
  });
}

export interface UseStockListParams {
  branchId?: string;
  search?: string;
  categoryId?: string;
  brandId?: string;
  status?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  page?: number;
  limit?: number;
}

export function useStockList(params: UseStockListParams = {}, options: { enabled?: boolean } = {}) {
  const organizationId = useAuthStore((state) => state.organization?.id);

  const isDefaultPage1 =
    (params.page === undefined || params.page === 1) &&
    (!params.search || params.search.trim() === '') &&
    (!params.categoryId || params.categoryId === 'all') &&
    (!params.brandId || params.brandId === 'all') &&
    (!params.status || params.status === 'all');

  const queryKey = [
    'inventory',
    'stock',
    'items',
    params.branchId ?? 'all',
    {
      search: params.search?.trim() || undefined,
      categoryId: params.categoryId !== 'all' ? params.categoryId : undefined,
      brandId: params.brandId !== 'all' ? params.brandId : undefined,
      status: params.status ?? 'all',
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    },
  ];

  const cached =
    isDefaultPage1 && organizationId ? loadPersistedStockList(organizationId, params.branchId) : null;

  return useQuery<StockListResponse, Error>({
    queryKey,
    queryFn: async () => {
      const list = await stockApi.listStockItems(params);
      if (isDefaultPage1 && organizationId) {
        savePersistedStockList(organizationId, params.branchId, list);
      }
      return list;
    },
    ...(cached ? { initialData: cached, initialDataUpdatedAt: 0 } : {}),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled: options.enabled ?? true,
  });
}

export interface UseStockReceiptsParams {
  branchId?: string;
  supplierId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useStockReceipts(params: UseStockReceiptsParams = {}, options: { enabled?: boolean } = {}) {
  const organizationId = useAuthStore((state) => state.organization?.id);

  const isDefaultPage1 =
    (params.page === undefined || params.page === 1) &&
    (!params.search || params.search.trim() === '') &&
    (!params.supplierId || params.supplierId === 'all');

  const queryKey = [
    'inventory',
    'stock',
    'receipts',
    params.branchId ?? 'all',
    {
      search: params.search?.trim() || undefined,
      supplierId: params.supplierId !== 'all' ? params.supplierId : undefined,
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    },
  ];

  const cached =
    isDefaultPage1 && organizationId ? loadPersistedReceipts(organizationId, params.branchId) : null;

  return useQuery<StockReceiptsResponse, Error>({
    queryKey,
    queryFn: async () => {
      const receipts = await stockReceiptsApi.listReceipts({
        branchId: params.branchId,
        supplierId: params.supplierId !== 'all' ? params.supplierId : undefined,
        search: params.search?.trim() || undefined,
        page: params.page ?? 1,
        limit: params.limit ?? 20,
      });
      if (isDefaultPage1 && organizationId) {
        savePersistedReceipts(organizationId, params.branchId, receipts);
      }
      return receipts;
    },
    ...(cached ? { initialData: cached, initialDataUpdatedAt: 0 } : {}),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled: options.enabled ?? true,
  });
}

export interface UseStockMovementsParams {
  branchId?: string;
  productId?: string;
  movementType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export function useStockMovements(params: UseStockMovementsParams = {}, options: { enabled?: boolean } = {}) {
  const queryKey = [
    'inventory',
    'stock',
    'movements',
    params.branchId ?? 'all',
    {
      productId: params.productId || undefined,
      movementType: params.movementType ?? 'all',
      startDate: params.startDate || undefined,
      endDate: params.endDate || undefined,
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    },
  ];

  return useQuery<StockMovementsResponse, Error>({
    queryKey,
    queryFn: () => stockApi.listStockMovements(params),
    staleTime: 10_000,
    enabled: options.enabled ?? true,
  });
}

export function useStockMutations() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((state) => state.organization?.id);

  const invalidateStockQueries = async (branchId?: string) => {
    if (organizationId) {
      invalidatePersistedStock(organizationId, branchId);
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory', 'catalog'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] }),
    ]);
  };

  const recordOpening = useMutation({
    mutationFn: (payload: RecordOpeningStockPayload) => stockApi.recordOpeningStock(payload),
    onSuccess: (_, vars) => invalidateStockQueries(vars.branchId),
  });

  const receiveStock = useMutation({
    mutationFn: (payload: ReceiveStockPayload) => stockApi.receiveStock(payload),
    onSuccess: (_, vars) => invalidateStockQueries(vars.branchId),
  });

  const adjustStock = useMutation({
    mutationFn: (payload: AdjustStockPayload) => stockApi.adjustStock(payload),
    onSuccess: (_, vars) => invalidateStockQueries(vars.branchId),
  });

  const transferStock = useMutation({
    mutationFn: (payload: TransferStockPayload) => stockApi.transferStock(payload),
    onSuccess: (_, vars) => {
      invalidateStockQueries(vars.sourceBranchId);
      invalidateStockQueries(vars.destinationBranchId);
    },
  });

  return {
    recordOpening,
    receiveStock,
    adjustStock,
    transferStock,
  };
}
