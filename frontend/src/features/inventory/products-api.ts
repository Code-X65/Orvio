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
  sku: string;
  barcode: string | null;
  cost_price: number;
  selling_price: number;
  attributes: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchStockItem {
  branch_id: string;
  branch_name: string;
  quantity_on_hand: number;
  reserved: number;
  available: number;
}

export interface Product {
  id: string;
  org_id: string;
  category_id: string | null;
  category_name?: string | null;
  name: string;
  description: string | null;
  sku: string;
  barcode: string | null;
  cost_price: number;
  selling_price: number;
  unit_of_measure: MeasurementUnit;
  track_quantity: boolean;
  low_stock_threshold: number;
  has_variants: boolean;
  variants_count?: number;
  image_url: string | null;
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
  costPrice: number;
  sellingPrice: number;
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
  costPrice?: number;
  sellingPrice?: number;
  unitOfMeasure?: MeasurementUnit;
  trackQuantity?: boolean;
  lowStockThreshold?: number;
  hasVariants?: boolean;
  isActive?: boolean;
  imageUrl?: string | null;
  metadata?: Record<string, any> | null;
}

export interface CreateVariantPayload {
  sku?: string;
  barcode?: string | null;
  costPrice: number;
  sellingPrice: number;
  attributes: Record<string, string>;
  isActive?: boolean;
  initialStock?: number;
  branchId?: string;
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

export const productApi = {
  listProducts: async (params?: {
    page?: number;
    limit?: number;
    categoryId?: string;
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
  getProducts: async (params?: {
    page?: number;
    limit?: number;
    categoryId?: string;
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
  deleteProduct: async (id: string) => {
    return await api.delete<{ success: boolean }>(`/inventory/products/${id}`);
  },
  toggleProductStatus: async (id: string) => {
    return await api.patch<ProductSingleResponse>(`/inventory/products/${id}/toggle-status`);
  },
  createVariant: async (productId: string, payload: CreateVariantPayload) => {
    return await api.post<VariantResponse>(`/inventory/products/${productId}/variants`, payload);
  },
  searchProducts: async (q: string, branchId?: string) => {
    return await api.get<SearchProductsResponse>('/inventory/products/search', {
      params: { q, branchId },
    });
  },
};
