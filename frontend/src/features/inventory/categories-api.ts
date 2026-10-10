import { api } from '../../lib/api/client';

export interface Category {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url?: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  is_deleted?: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  depth?: number;
  direct_product_count?: number;
  product_count?: number;
}

export interface CategoryWithPath extends Category {
  children_count: number;
  full_path: string;
}

export interface CreateCategoryPayload {
  name: string;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
}

export interface UpdateCategoryPayload {
  name?: string;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CategoriesListResponse {
  categories: CategoryTreeNode[];
}

export interface CategoryDetailResponse {
  category: CategoryWithPath;
}

export interface CategoryResponse {
  category: Category;
}

export interface ReorderCategoriesResponse {
  categories: Category[];
}

export interface SeedCategoriesResponse {
  count: number;
}

export interface CategoryUsageResponse {
  usage: {
    productCount: number;
    childCount: number;
  };
}

export const categoryApi = {
  getCategories: async (params?: { activeOnly?: boolean; parentId?: string; includeInactive?: boolean }) => {
    return await api.get<CategoriesListResponse>('/inventory/categories', { params });
  },
  getCategory: async (id: string) => {
    return await api.get<CategoryDetailResponse>(`/inventory/categories/${id}`);
  },
  getCategoryUsage: async (id: string) => {
    return await api.get<CategoryUsageResponse>(`/inventory/categories/${id}/usage`);
  },
  createCategory: async (payload: CreateCategoryPayload) => {
    return await api.post<CategoryResponse>('/inventory/categories', payload);
  },
  updateCategory: async (id: string, payload: UpdateCategoryPayload) => {
    return await api.put<CategoryResponse>(`/inventory/categories/${id}`, payload);
  },
  deleteCategory: async (id: string, reassignToCategoryId?: string) => {
    return await api.delete<{ success: boolean; reassignedProductCount?: number }>(
      `/inventory/categories/${id}`,
      { params: reassignToCategoryId ? { reassignToCategoryId } : undefined }
    );
  },
  reorderCategories: async (parentId: string | null | undefined, categoryIds: string[]) => {
    return await api.patch<ReorderCategoriesResponse>('/inventory/categories/reorder', { parentId, categoryIds });
  },
  toggleCategoryStatus: async (id: string) => {
    return await api.patch<CategoryResponse>(`/inventory/categories/${id}/toggle-status`);
  },
  seedDefaultCategories: async (businessType?: string) => {
    return await api.post<SeedCategoriesResponse>('/inventory/categories/seed', { businessType });
  },
  uploadCategoryImage: async (categoryId: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return await api.post<CategoryResponse>(`/inventory/categories/${categoryId}/image`, formData);
  },
  deleteCategoryImage: async (categoryId: string) => {
    return await api.delete<CategoryResponse>(`/inventory/categories/${categoryId}/image`);
  },
};
