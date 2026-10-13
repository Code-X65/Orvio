import { useQuery } from '@tanstack/react-query';
import { catalogApi, type BranchProductItem } from '../catalog-api';
import { productApi, type ProductListResponse, type Product } from '../products-api';

export interface UseBranchCatalogOptions {
  branchId?: string;
  page?: number;
  limit?: number;
  cursor?: string;
  search?: string;
  categoryId?: string;
  brandId?: string;
  includeExcluded?: boolean;
  status?: 'all' | 'active' | 'inactive' | 'archived';
  lowStock?: boolean;
  enabled?: boolean;
}

export function useBranchCatalog(options: UseBranchCatalogOptions = {}) {
  const {
    branchId,
    page = 1,
    limit = 15,
    cursor,
    search,
    categoryId,
    brandId,
    includeExcluded = false,
    status = 'all',
    lowStock,
    enabled = true,
  } = options;

  const isSpecificBranch = Boolean(branchId && branchId !== 'all');

  const queryKey = [
    'inventory',
    isSpecificBranch ? 'catalog' : 'products',
    isSpecificBranch ? branchId : 'all',
    {
      page,
      limit,
      cursor: cursor || undefined,
      search: search?.trim() || undefined,
      categoryId: categoryId !== 'all' ? categoryId : undefined,
      brandId: brandId !== 'all' ? brandId : undefined,
      includeExcluded: isSpecificBranch ? includeExcluded : undefined,
      status,
      lowStock: lowStock || undefined,
    },
  ];

  return useQuery<ProductListResponse, Error>({
    queryKey,
    queryFn: async () => {
      if (isSpecificBranch) {
        const response = await catalogApi.getBranchCatalog(branchId!, {
          page,
          limit,
          cursor,
          search: search?.trim() || undefined,
          categoryId: categoryId !== 'all' ? categoryId : undefined,
          brandId: brandId !== 'all' ? brandId : undefined,
          includeExcluded,
        });

        const mappedProducts: Product[] = response.items.map((item: BranchProductItem) => {
          return {
            id: item.product.id,
            org_id: item.org_id,
            name: item.product.name,
            sku: item.product.sku,
            barcode: item.product.barcode,
            category_id: item.product.category_id,
            category_name: item.product.category_name,
            brand_id: item.product.brand_id,
            brand_name: item.product.brand_name,
            brand_logo: item.product.brand_logo,
            description: null,
            cost_price: item.product.cost_price,
            selling_price: item.product.selling_price,
            compare_at_price: null,
            unit_of_measure: 'pcs',
            track_quantity: true,
            low_stock_threshold: 10,
            has_variants: item.product.has_variants,
            variants_count: item.product.has_variants ? 1 : 0,
            is_active: item.product.is_active,
            is_deleted: false,
            business_type: (item.product as { business_type?: string | null }).business_type ?? null,
            image_url: item.product.image_url,
            primary_image_url: item.product.image_url,
            primary_thumbnail_url: item.product.primary_thumbnail_url ?? item.product.image_url,
            thumbnail_200: item.product.thumbnail_200 ?? null,
            thumbnail_400: item.product.thumbnail_400 ?? null,
            metadata: null,
            total_stock: item.quantity_on_hand,
            reserved_stock: item.reserved,
            available_stock: item.available,
            source_branch_id: item.source_branch_id,
            source_branch_name: item.source_branch_name,
            created_at: item.added_at,
            updated_at: item.added_at,
          };
        });

        return {
          products: mappedProducts,
          pagination: response.pagination,
        };
      }

      // Global or All Branches view
      return await productApi.listProducts({
        page,
        limit,
        categoryId: categoryId !== 'all' ? categoryId : undefined,
        brandId: brandId !== 'all' ? brandId : undefined,
        status,
        search: search?.trim() || undefined,
        lowStock: lowStock || undefined,
        branchId: branchId || undefined,
      });
    },
    enabled,
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
