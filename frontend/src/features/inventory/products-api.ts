import { api } from '../../lib/api/client';

export type MeasurementUnit =
  | 'pcs'
  | 'kg'
  | 'g'
  | 'liter'
  | 'ml'
  | 'box'
  | 'pack'
  | 'bottle'
  | 'dozen';

export interface ProductVariant {
  id: string;
  org_id: string;
  product_id: string;
  name?: string;
  sku: string;
  barcode: string | null;
  cost_price: number;
  selling_price: number;
  compare_at_price?: number | null;
  attributes: Record<string, string>;
  images?: ProductImage[];
  is_active: boolean;
  total_stock?: number;
  available_stock?: number;
  low_stock_threshold?: number | null;
  created_at: string;
  updated_at: string;
}

export function getVariantDisplayName(v: { name?: string; attributes?: Record<string, any>; sku?: string }): string {
  if (v.name) return v.name;
  if (v.attributes && Object.keys(v.attributes).length > 0) {
    return Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ');
  }
  return v.sku || 'Variant';
}

export const BUSINESS_TYPE_IMAGE_LIMITS: Record<string, number> = {
  retail: 5,
  fashion: 8,
  restaurant: 3,
  electronics: 8,
  supermarket: 4,
  wholesale: 5,
  pharmacy: 3,
  services: 2,
};

export type ProductListItem = Product;

export interface BranchStockItem {
  branch_id: string;
  branch_name: string;
  quantity_on_hand: number;
  reserved: number;
  available: number;
}

export interface ProductImage {
  id: string;
  org_id: string;
  product_id: string;
  variant_id: string | null;
  url: string;
  thumbnail_200: string | null;
  thumbnail_400: string | null;
  thumbnail_800: string | null;
  thumbnail_1200: string | null;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  file_size?: number | null;
  mime_type?: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  org_id: string;
  category_id: string | null;
  category_name?: string | null;
  brand_id?: string | null;
  brand_name?: string | null;
  brand_logo?: string | null;
  source_branch_id?: string | null;
  source_branch_name?: string | null;
  brand?: { id: string; name: string; slug: string; logo_url: string | null } | null;
  name: string;
  description: string | null;
  sku: string;
  barcode: string | null;
  cost_price: number;
  selling_price: number;
  compare_at_price?: number | null;
  unit_of_measure: MeasurementUnit;
  track_quantity: boolean;
  low_stock_threshold: number;
  has_variants: boolean;
  variants_count?: number;
  image_url: string | null;
  primary_image_url?: string | null;
  primary_thumbnail_url?: string | null;
  thumbnail_200?: string | null;
  thumbnail_400?: string | null;
  images?: ProductImage[];
  is_active: boolean;
  is_deleted: boolean;
  business_type: string | null;
  metadata?: unknown;
  total_stock?: number;
  reserved_stock?: number;
  available_stock?: number;
  variants?: ProductVariant[];
  stock_levels?: BranchStockItem[];
  created_at: string;
  updated_at: string;
}

export interface CreateProductPayload {
  name: string;
  description?: string | null;
  sku?: string;
  barcode?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  costPrice: number;
  sellingPrice: number;
  compareAtPrice?: number | null;
  unitOfMeasure?: MeasurementUnit;
  trackQuantity?: boolean;
  lowStockThreshold?: number;
  hasVariants?: boolean;
  isActive?: boolean;
  imageUrl?: string | null;
  initialStock?: number;
  branchId?: string;
  metadata?: Record<string, any> | null;
}

export interface UpdateProductPayload {
  name?: string;
  description?: string | null;
  sku?: string;
  barcode?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  costPrice?: number;
  sellingPrice?: number;
  compareAtPrice?: number | null;
  unitOfMeasure?: MeasurementUnit;
  trackQuantity?: boolean;
  lowStockThreshold?: number;
  hasVariants?: boolean;
  isActive?: boolean;
  imageUrl?: string | null;
  metadata?: Record<string, any> | null;
  priceChangeReason?: string;
}

export interface CreateVariantPayload {
  name?: string;
  sku?: string;
  barcode?: string | null;
  costPrice?: number;
  sellingPrice?: number;
  compareAtPrice?: number | null;
  attributes?: Record<string, string>;
  isActive?: boolean;
  initialStock?: number;
  branchId?: string;
  lowStockThreshold?: number | null;
  priceChangeReason?: string;
}

export interface ProductListResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductDetailResponse {
  product: Product;
}

export interface ProductSingleResponse {
  product: Product;
}

export interface VariantResponse {
  variant: ProductVariant;
}

export interface SearchProductsResponse {
  results: Array<{
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    selling_price: number;
    is_active: boolean;
    available_stock: number;
  }>;
}

export interface ProductPriceHistory {
  id: string;
  org_id: string;
  product_id: string;
  variant_id: string | null;
  old_cost_price: number;
  new_cost_price: number;
  old_selling_price: number;
  new_selling_price: number;
  reason: string | null;
  changed_by_user_id: string | null;
  created_at: string;
}

export interface PriceHistoryResponse {
  history: ProductPriceHistory[];
}

export interface ProductBranchStock {
  branchId: string;
  branchName: string;
  onHand: number;
  reserved: number;
}

export interface ProductUsage {
  totalOnHand: number;
  totalReserved: number;
  variantCount: number;
  hasReservedStock: boolean;
  canDelete: boolean;
  branchStock: ProductBranchStock[];
}

export interface ProductUsageResponse {
  usage: ProductUsage;
}

export interface UpdateVariantPayload {
  sku?: string;
  barcode?: string | null;
  costPrice?: number;
  sellingPrice?: number;
  compareAtPrice?: number | null;
  attributes?: Record<string, string>;
  isActive?: boolean;
  lowStockThreshold?: number | null;
  priceChangeReason?: string;
}

export const productApi = {
  listProducts: async (params?: {
    page?: number;
    limit?: number;
    categoryId?: string;
    status?: 'all' | 'active' | 'inactive' | 'archived';
    activeOnly?: boolean;
    search?: string;
    lowStock?: boolean;
    trackQuantity?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    branchId?: string;
    brandId?: string;
  }) => {
    return await api.get<ProductListResponse>('/inventory/products', { params });
  },
  getProducts: async (params?: {
    page?: number;
    limit?: number;
    categoryId?: string;
    brandId?: string;
    status?: 'all' | 'active' | 'inactive' | 'archived';
    activeOnly?: boolean;
    search?: string;
    lowStock?: boolean;
    trackQuantity?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    branchId?: string;
  }) => {
    return await api.get<ProductListResponse>('/inventory/products', { params });
  },
  getProductById: async (id: string) => {
    return await api.get<ProductDetailResponse>(`/inventory/products/${id}`);
  },
  getProduct: async (id: string) => {
    return await api.get<ProductDetailResponse>(`/inventory/products/${id}`);
  },
  createProduct: async (payload: CreateProductPayload) => {
    return await api.post<ProductSingleResponse>('/inventory/products', payload);
  },
  updateProduct: async (id: string, payload: UpdateProductPayload) => {
    return await api.patch<ProductSingleResponse>(`/inventory/products/${id}`, payload);
  },
  restoreProduct: async (id: string) => {
    return await api.patch<ProductSingleResponse>(`/inventory/products/${id}/restore`);
  },
  getProductUsage: async (id: string) => {
    return await api.get<ProductUsageResponse>(`/inventory/products/${id}/usage`);
  },
  deleteProduct: async (id: string, options?: { reason?: string; confirmWithStock?: boolean }) => {
    return await api.delete<{ success: boolean }>(`/inventory/products/${id}`, {
      params: options,
    });
  },
  toggleProductStatus: async (id: string) => {
    return await api.patch<ProductSingleResponse>(`/inventory/products/${id}/toggle-status`);
  },
  createVariant: async (productId: string, payload: CreateVariantPayload) => {
    return await api.post<VariantResponse>(`/inventory/products/${productId}/variants`, payload);
  },
  updateVariant: async (productId: string, variantId: string, payload: UpdateVariantPayload) => {
    return await api.patch<VariantResponse>(`/inventory/products/${productId}/variants/${variantId}`, payload);
  },
  deleteVariant: async (productId: string, variantId: string, options?: { reason?: string; confirmWithStock?: boolean }) => {
    return await api.delete<{ success: boolean }>(`/inventory/products/${productId}/variants/${variantId}`, {
      params: options,
    });
  },
  getVariantPriceHistory: async (productId: string, variantId: string) => {
    return await api.get<PriceHistoryResponse>(`/inventory/products/${productId}/variants/${variantId}/price-history`);
  },
  searchProducts: async (q: string, branchId?: string) => {
    return await api.get<SearchProductsResponse>('/inventory/products/search', {
      params: { q, branchId },
    });
  },
  getPriceHistory: async (productId: string) => {
    return await api.get<PriceHistoryResponse>(`/inventory/products/${productId}/price-history`);
  },
  uploadProductImages: async (productId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    return await api.post<{ images: ProductImage[] }>(`/inventory/products/${productId}/images`, formData);
  },
  uploadVariantImages: async (productId: string, variantId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    return await api.post<{ images: ProductImage[] }>(
      `/inventory/products/${productId}/variants/${variantId}/images`,
      formData
    );
  },
  listProductImages: async (productId: string) => {
    return await api.get<{ images: ProductImage[] }>(`/inventory/products/${productId}/images`);
  },
  listVariantImages: async (variantId: string) => {
    return await api.get<{ images: ProductImage[]; isInherited: boolean }>(
      `/inventory/products/${variantId}/variant-images`
    );
  },
  reorderProductImages: async (
    productId: string,
    images: Array<{ id: string; sortOrder: number; isPrimary?: boolean }>
  ) => {
    return await api.patch<{ images: ProductImage[] }>(`/inventory/products/${productId}/images/reorder`, {
      images,
    });
  },
  updateProductImage: async (
    productId: string,
    imageId: string,
    data: { altText?: string | null; isPrimary?: boolean }
  ) => {
    return await api.patch<{ image: ProductImage }>(`/inventory/products/${productId}/images/${imageId}`, data);
  },
  deleteProductImage: async (productId: string, imageId: string) => {
    return await api.delete<{ success: boolean }>(`/inventory/products/${productId}/images/${imageId}`);
  },
};
