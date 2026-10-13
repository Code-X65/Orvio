import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CategoriesPage } from './CategoriesPage';
import { categoryApi } from '../categories-api';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

vi.mock('../categories-api', () => ({
  categoryApi: {
    getCategories: vi.fn(),
    getCategoryUsage: vi.fn(),
    deleteCategory: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    toggleCategoryStatus: vi.fn(),
    reorderCategories: vi.fn(),
  },
}));

describe('CategoriesPage Component', () => {
  const mockCategories = [
    {
      id: 'cat-1',
      org_id: 'org-1',
      name: 'Beverages',
      slug: 'beverages',
      description: null,
      parent_id: null,
      sort_order: 0,
      is_active: true,
      product_count: 12,
      direct_product_count: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      children: [
        {
          id: 'cat-sub-1',
          org_id: 'org-1',
          name: 'Fruit Juices',
          slug: 'fruit-juices',
          description: null,
          parent_id: 'cat-1',
          sort_order: 0,
          is_active: true,
          product_count: 10,
          direct_product_count: 10,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          children: [],
        },
      ],
    },
    {
      id: 'cat-2',
      org_id: 'org-1',
      name: 'Pantry Staples',
      slug: 'pantry-staples',
      description: null,
      parent_id: null,
      sort_order: 1,
      is_active: true,
      product_count: 5,
      direct_product_count: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      children: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (categoryApi.getCategories as any).mockResolvedValue({ categories: mockCategories });
  });

  it('renders category list and tree hierarchy', async () => {
    renderWithProviders(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Beverages')).toBeInTheDocument();
      expect(screen.getByText('Pantry Staples')).toBeInTheDocument();
    });
  });

  it('blocks deletion when category has subcategories', async () => {
    (categoryApi.getCategoryUsage as any).mockResolvedValue({
      usage: { productCount: 0, childCount: 1 },
    });

    renderWithProviders(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Beverages')).toBeInTheDocument();
    });

    // Find and click delete on Beverages
    fireEvent.click(screen.getByTestId('category-delete-cat-1'));

    await waitFor(() => {
      expect(screen.getByText('Cannot Delete: Subcategories Detected')).toBeInTheDocument();
      expect(screen.getByText(/You must delete or move child categories first/i)).toBeInTheDocument();
    });

    // Confirm delete button should not be present
    expect(screen.queryByTestId('confirm-delete-category-btn')).not.toBeInTheDocument();
  });

  it('prompts for reassignment and moves products when deleting category with products', async () => {
    (categoryApi.getCategoryUsage as any).mockResolvedValue({
      usage: { productCount: 5, childCount: 0 },
    });
    (categoryApi.deleteCategory as any).mockResolvedValue({
      success: true,
      reassignedProductCount: 5,
    });

    renderWithProviders(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Pantry Staples')).toBeInTheDocument();
    });

    // Delete Pantry Staples
    fireEvent.click(screen.getByTestId('category-delete-cat-2'));

    await waitFor(() => {
      expect(screen.getByText('Active Products Assigned')).toBeInTheDocument();
      expect(screen.getByText(/5 active products/i)).toBeInTheDocument();
    });

    const submitBtn = screen.getByTestId('confirm-delete-category-btn');
    expect(submitBtn).toBeDisabled();

    // Select destination category
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'cat-1' } });

    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(categoryApi.deleteCategory).toHaveBeenCalledWith('cat-2', 'cat-1');
    });
  });

  it('archives category cleanly when it has 0 subcategories and 0 products', async () => {
    (categoryApi.getCategoryUsage as any).mockResolvedValue({
      usage: { productCount: 0, childCount: 0 },
    });
    (categoryApi.deleteCategory as any).mockResolvedValue({
      success: true,
      reassignedProductCount: 0,
    });

    renderWithProviders(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Pantry Staples')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('category-delete-cat-2'));

    await waitFor(() => {
      expect(screen.getByText(/It has no subcategories and 0 assigned products/i)).toBeInTheDocument();
    });

    const archiveBtn = screen.getByTestId('confirm-delete-category-btn');
    expect(archiveBtn).toBeInTheDocument();
    fireEvent.click(archiveBtn);

    await waitFor(() => {
      expect(categoryApi.deleteCategory).toHaveBeenCalledWith('cat-2', undefined);
    });
  });

  it('displays product count badge with roll-up and breakdown', async () => {
    renderWithProviders(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Beverages')).toBeInTheDocument();
    });

    // Beverages has 12 total, (2 direct)
    expect(screen.getByTestId('category-product-count-cat-1')).toBeInTheDocument();
    expect(screen.getByText('12 products')).toBeInTheDocument();
    expect(screen.getByText('(2 direct)')).toBeInTheDocument();

    // Pantry Staples has 5 products
    expect(screen.getByTestId('category-product-count-cat-2')).toBeInTheDocument();
    expect(screen.getByText('5 products')).toBeInTheDocument();
  });

  it('clicking product count badge calls onNavigateToProducts with category ID', async () => {
    const handleNavigate = vi.fn();
    renderWithProviders(<CategoriesPage onNavigateToProducts={handleNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Beverages')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('category-product-count-cat-1'));
    expect(handleNavigate).toHaveBeenCalledWith('cat-1');
  });

  it('clicking view products in catalog button calls onNavigateToProducts', async () => {
    const handleNavigate = vi.fn();
    renderWithProviders(<CategoriesPage onNavigateToProducts={handleNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Pantry Staples')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('category-view-products-cat-2'));
    expect(handleNavigate).toHaveBeenCalledWith('cat-2');
  });

  it('toggles category active status with optimistic update and calls toggleCategoryStatus', async () => {
    (categoryApi.toggleCategoryStatus as any).mockResolvedValue({
      ...mockCategories[1],
      is_active: false,
    });

    renderWithProviders(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Pantry Staples')).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTestId('category-toggle-cat-2');
    expect(toggleBtn).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(toggleBtn);

    // Optimistically updates immediately
    expect(toggleBtn).toHaveAttribute('aria-checked', 'false');

    await waitFor(() => {
      expect(categoryApi.toggleCategoryStatus).toHaveBeenCalledWith('cat-2');
    });
  });
});
