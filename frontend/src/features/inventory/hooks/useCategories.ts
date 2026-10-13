import { useQuery } from '@tanstack/react-query';
import { categoryApi, type CategoriesListResponse } from '../categories-api';

export interface UseCategoriesOptions {
  branchId?: string;
  activeOnly?: boolean;
  parentId?: string;
  includeInactive?: boolean;
  enabled?: boolean;
}

export function useCategories(options: UseCategoriesOptions = {}) {
  const { branchId, activeOnly, parentId, includeInactive, enabled = true } = options;

  return useQuery<CategoriesListResponse, Error>({
    queryKey: ['inventory', 'categories', { branchId, activeOnly, parentId, includeInactive }],
    queryFn: async () => {
      return await categoryApi.getCategories({ branchId, activeOnly, parentId, includeInactive });
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
}
