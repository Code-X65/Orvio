import { useBranchCatalog, type UseBranchCatalogOptions } from './useBranchCatalog';
import type { ProductListResponse } from '../products-api';

export type UseProductsOptions = UseBranchCatalogOptions & {
  activeOnly?: boolean;
};

export function useProducts(options: UseProductsOptions = {}) {
  return useBranchCatalog(options);
}

export { useBranchCatalog };
