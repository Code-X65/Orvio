import { useQuery } from '@tanstack/react-query';
import { brandApi, type BrandsListResponse } from '../brands-api';

export interface UseBrandsOptions {
  branchId?: string;
  search?: string;
  activeOnly?: boolean;
  includeDeleted?: boolean;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export function useBrands(options: UseBrandsOptions = {}) {
  const { branchId, search, activeOnly, includeDeleted, page, limit, enabled = true } = options;

  return useQuery<BrandsListResponse, Error>({
    queryKey: ['inventory', 'brands', { branchId, search, activeOnly, includeDeleted, page, limit }],
    queryFn: async () => {
      return await brandApi.getBrands({ branchId, search, activeOnly, includeDeleted, page, limit });
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
}
