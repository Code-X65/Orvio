import { useQuery } from '@tanstack/react-query';
import { catalogApi, type BranchCatalogSummary } from '../catalog-api';

export interface UseBranchCatalogSummaryOptions {
  enabled?: boolean;
}

export function useBranchCatalogSummary(
  branchId?: string,
  options: UseBranchCatalogSummaryOptions = {}
) {
  const isSpecificBranch = Boolean(branchId && branchId !== 'all');
  const { enabled = true } = options;

  return useQuery<BranchCatalogSummary, Error>({
    queryKey: ['inventory', 'catalog', branchId, 'summary'],
    queryFn: async () => {
      return await catalogApi.getBranchCatalogSummary(branchId!);
    },
    enabled: enabled && isSpecificBranch,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
