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

export function useStockSummary(branchId?: string, options: { enabled?: boolean } = {}) {
  return useQuery<StockSummary, Error>({
    queryKey: ['inventory', 'stock', 'summary', branchId ?? 'all'],
    queryFn: () => stockApi.getStockSummary(branchId),
    staleTime: 15_000,
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

  return useQuery<StockListResponse, Error>({
    queryKey,
    queryFn: () => stockApi.listStockItems(params),
    staleTime: 15_000,
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

  const invalidateStockQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory', 'catalog'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] }),
    ]);
  };

  const recordOpening = useMutation({
    mutationFn: (payload: RecordOpeningStockPayload) => stockApi.recordOpeningStock(payload),
    onSuccess: invalidateStockQueries,
  });

  const receiveStock = useMutation({
    mutationFn: (payload: ReceiveStockPayload) => stockApi.receiveStock(payload),
    onSuccess: invalidateStockQueries,
  });

  const adjustStock = useMutation({
    mutationFn: (payload: AdjustStockPayload) => stockApi.adjustStock(payload),
    onSuccess: invalidateStockQueries,
  });

  const transferStock = useMutation({
    mutationFn: (payload: TransferStockPayload) => stockApi.transferStock(payload),
    onSuccess: invalidateStockQueries,
  });

  return {
    recordOpening,
    receiveStock,
    adjustStock,
    transferStock,
  };
}
