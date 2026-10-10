import { api } from '../../lib/api/client';

export interface Category {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  depth?: number;
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

export const categoryApi = {
  getCategories: async (params?: { activeOnly?: boolean; parentId?: string; includeInactive?: boolean }) => {
    return await api.get<CategoriesListResponse>('/inventory/categories', { params });
  },
  getCategory: async (id: string) => {
    return await api.get<CategoryDetailResponse>(`/inventory/categories/${id}`);
  },
  createCategory: async (payload: CreateCategoryPayload) => {
    return await api.post<CategoryResponse>('/inventory/categories', payload);
  },
  updateCategory: async (id: string, payload: UpdateCategoryPayload) => {
    return await api.put<CategoryResponse>(`/inventory/categories/${id}`, payload);
  },
  deleteCategory: async (id: string) => {
    return await api.delete<{ success: boolean }>(`/inventory/categories/${id}`);
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
};
