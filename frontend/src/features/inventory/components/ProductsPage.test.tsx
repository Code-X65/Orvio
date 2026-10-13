import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ProductsPage } from './ProductsPage';
import { productApi } from '../products-api';
import { categoryApi } from '../categories-api';
import { brandApi } from '../brands-api';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
}

vi.mock('../products-api', () => ({
  productApi: {
    listProducts: vi.fn(),
    getProductById: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
    getProductUsage: vi.fn(),
    createVariant: vi.fn(),
    updateVariant: vi.fn(),
    deleteVariant: vi.fn(),
    getVariantPriceHistory: vi.fn(),
    restoreProduct: vi.fn(),
    getPriceHistory: vi.fn(),
  },
}));

vi.mock('../categories-api', () => ({
  categoryApi: {
    getCategories: vi.fn(),
  },
}));

vi.mock('../brands-api', () => ({
  brandApi: {
    getBrands: vi.fn().mockResolvedValue({ brands: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 1 } }),
  },
}));

describe('ProductsPage Component', () => {
  const mockProductsResponse = {
    products: [
      {
        id: 'p-1',
        name: 'Golden Penny Spaghetti',
        sku: 'GPS-500G',
        barcode: '123456789012',
        category_id: 'cat-1',
        category_name: 'Pasta & Noodles',
        description: '500g durum wheat pasta',
        cost_price: 350,
        selling_price: 550,
        compare_at_price: 700,
        unit_of_measure: 'pcs' as const,
        track_quantity: true,
        low_stock_threshold: 10,
        has_variants: true,
        variants_count: 2,
        is_active: true,
        image_url: null,
        metadata: null,
        business_type: null,
        total_stock: 45,
        reserved_stock: 0,
        available_stock: 45,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    pagination: {
      page: 1,
      limit: 15,
      total: 1,
      totalPages: 1,
    },
  };

  const mockCategoriesResponse = {
    categories: [
      {
        id: 'cat-1',
        org_id: 'org-1',
        name: 'Pasta & Noodles',
        slug: 'pasta-noodles',
        description: null,
        parent_id: null,
        sort_order: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        children: [],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (productApi.listProducts as any).mockResolvedValue(mockProductsResponse);
    (categoryApi.getCategories as any).mockResolvedValue(mockCategoriesResponse);
  });

  it('renders products table with item details, prices, and stock', async () => {
    renderWithProviders(<ProductsPage organization={{ name: 'Test Market', currency: 'NGN' }} />);

    await waitFor(() => {
      expect(screen.getByText('Golden Penny Spaghetti')).toBeInTheDocument();
    });

    expect(screen.getByText('GPS-500G')).toBeInTheDocument();
    expect(screen.getAllByText('Pasta & Noodles').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/45 in stock/i)).toBeInTheDocument();
    expect(screen.getByText('2 variants')).toBeInTheDocument();
  });

  it('expands product row to display variants', async () => {
    const mockDetail = {
      product: {
        ...mockProductsResponse.products[0],
        variants: [
          {
            id: 'v-1',
            product_id: 'p-1',
            sku: 'GPS-500G-SM',
            barcode: null,
            name: 'Small Pack',
            attributes: { size: 'Small' },
            cost_price: 300,
            selling_price: 500,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      },
    };
    (productApi.getProductById as any).mockResolvedValue(mockDetail);

    renderWithProviders(<ProductsPage organization={{ name: 'Test Market', currency: 'NGN' }} />);

    await waitFor(() => {
      expect(screen.getByText('Golden Penny Spaghetti')).toBeInTheDocument();
    });

    // Find and click expand button
    const expandBtn = screen.getByTitle('Expand variants');
    fireEvent.click(expandBtn);

    await waitFor(() => {
      expect(screen.getByText('Variants for Golden Penny Spaghetti')).toBeInTheDocument();
      expect(screen.getByText('Small Pack')).toBeInTheDocument();
      expect(screen.getByText('GPS-500G-SM')).toBeInTheDocument();
    });
  });

  it('displays promotional compare-at price and discount pill in table row', async () => {
    renderWithProviders(<ProductsPage organization={{ name: 'Test Market', currency: 'NGN' }} />);

    await waitFor(() => {
      expect(screen.getByText('Golden Penny Spaghetti')).toBeInTheDocument();
    });

    // Compare at price is 700, selling is 550, discount is -21%
    expect(screen.getByText('NGN 700')).toBeInTheDocument();
    expect(screen.getByText('-21%')).toBeInTheDocument();
  });

  it('opens price history modal and displays revision audit logs', async () => {
    const mockHistory = {
      history: [
        {
          id: 'hist-1',
          org_id: 'org-1',
          product_id: 'p-1',
          variant_id: null,
          old_cost_price: 300,
          new_cost_price: 350,
          old_selling_price: 500,
          new_selling_price: 550,
          reason: 'Supplier inflation hike',
          changed_by_user_id: 'user-1',
          created_at: new Date().toISOString(),
        },
      ],
    };
    (productApi.getPriceHistory as any).mockResolvedValue(mockHistory);

    renderWithProviders(<ProductsPage organization={{ name: 'Test Market', currency: 'NGN' }} />);

    await waitFor(() => {
      expect(screen.getByText('Golden Penny Spaghetti')).toBeInTheDocument();
    });

    // Click Price History button
    const historyBtn = screen.getByTitle('View price revision history');
    fireEvent.click(historyBtn);

    await waitFor(() => {
      expect(screen.getByText('Price Revision History')).toBeInTheDocument();
      expect(screen.getByText('Supplier inflation hike', { exact: false })).toBeInTheDocument();
    });

    expect(productApi.getPriceHistory).toHaveBeenCalledWith('p-1');
  });

  it('blocks archiving when product has active reserved stock (State 1)', async () => {
    (productApi.getProductUsage as any).mockResolvedValue({
      usage: {
        totalOnHand: 20,
        totalReserved: 5,
        variantCount: 0,
        hasReservedStock: true,
        canDelete: false,
        branchStock: [
          { branchId: 'b-1', branchName: 'HQ Branch', onHand: 20, reserved: 5 },
        ],
      },
    });

    renderWithProviders(<ProductsPage organization={{ name: 'Test Market', currency: 'NGN' }} />);

    await waitFor(() => {
      expect(screen.getByText('Golden Penny Spaghetti')).toBeInTheDocument();
    });

    // Click delete button
    const deleteBtn = screen.getByTitle('Archive product');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Cannot Archive: Active Reserved Stock')).toBeInTheDocument();
      expect(screen.getByText(/5 reserved unit\(s\)/i)).toBeInTheDocument();
    });

    const archiveBtn = screen.getByTestId('confirm-archive-product-btn');
    expect(archiveBtn).toBeDisabled();
  });

  it('requires confirmation checkbox and reason when product has on-hand stock (State 2)', async () => {
    (productApi.getProductUsage as any).mockResolvedValue({
      usage: {
        totalOnHand: 45,
        totalReserved: 0,
        variantCount: 2,
        hasReservedStock: false,
        canDelete: true,
        branchStock: [
          { branchId: 'b-1', branchName: 'Main Store', onHand: 45, reserved: 0 },
        ],
      },
    });
    (productApi.deleteProduct as any).mockResolvedValue({ success: true });

    renderWithProviders(<ProductsPage organization={{ name: 'Test Market', currency: 'NGN' }} />);

    await waitFor(() => {
      expect(screen.getByText('Golden Penny Spaghetti')).toBeInTheDocument();
    });

    // Click delete button
    const deleteBtn = screen.getByTitle('Archive product');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Active Stock Detected')).toBeInTheDocument();
      expect(screen.getByText(/45 unit\(s\)/i)).toBeInTheDocument();
    });

    const archiveBtn = screen.getByTestId('confirm-archive-product-btn');
    expect(archiveBtn).toBeDisabled();

    // Check confirmation checkbox
    const checkbox = screen.getByTestId('confirm-stock-checkbox');
    fireEvent.click(checkbox);
    expect(archiveBtn).toBeDisabled(); // Still disabled because reason is required

    // Enter reason
    const reasonInput = screen.getByTestId('archive-product-reason-input');
    fireEvent.change(reasonInput, { target: { value: 'Discontinued product line write-off' } });

    expect(archiveBtn).not.toBeDisabled();
    fireEvent.click(archiveBtn);

    await waitFor(() => {
      expect(productApi.deleteProduct).toHaveBeenCalledWith('p-1', {
        confirmWithStock: true,
        reason: 'Discontinued product line write-off',
      });
    });
  });

  it('allows clean archiving when product has 0 stock (State 3)', async () => {
    (productApi.getProductUsage as any).mockResolvedValue({
      usage: {
        totalOnHand: 0,
        totalReserved: 0,
        variantCount: 0,
        hasReservedStock: false,
        canDelete: true,
        branchStock: [],
      },
    });
    (productApi.deleteProduct as any).mockResolvedValue({ success: true });

    renderWithProviders(<ProductsPage organization={{ name: 'Test Market', currency: 'NGN' }} />);

    await waitFor(() => {
      expect(screen.getByText('Golden Penny Spaghetti')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle('Archive product');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText(/No active stock units detected across branches/i)).toBeInTheDocument();
    });

    const archiveBtn = screen.getByTestId('confirm-archive-product-btn');
    expect(archiveBtn).not.toBeDisabled();
    fireEvent.click(archiveBtn);

    await waitFor(() => {
      expect(productApi.deleteProduct).toHaveBeenCalledWith('p-1', {
        confirmWithStock: false,
        reason: undefined,
      });
    });
  });

  it('renders Archived status badge and Restore button for archived products and calls restoreProduct', async () => {
    (productApi.listProducts as any).mockResolvedValue({
      products: [
        {
          ...mockProductsResponse.products[0],
          id: 'p-archived',
          name: 'Archived Indomie Noodles',
          is_deleted: true,
          is_active: false,
        },
      ],
      pagination: { page: 1, limit: 15, total: 1, totalPages: 1 },
    });
    (productApi.restoreProduct as any).mockResolvedValue({ success: true });

    renderWithProviders(<ProductsPage organization={{ name: 'Test Market', currency: 'NGN' }} />);

    await waitFor(() => {
      expect(screen.getByText('Archived Indomie Noodles')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Archived/i).length).toBeGreaterThanOrEqual(2);
    const restoreBtn = screen.getByRole('button', { name: /restore/i });
    expect(restoreBtn).toBeInTheDocument();

    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(productApi.restoreProduct).toHaveBeenCalledWith('p-archived');
    });
  });

  it('allows archiving a variant with stock confirmation and reason', async () => {
    (productApi.getProductById as any).mockResolvedValue({
      product: {
        ...mockProductsResponse.products[0],
        variants: [
          {
            id: 'v-1',
            org_id: 'org-1',
            product_id: 'p-1',
            name: '500g Pack',
            sku: 'GPS-500G-PK',
            barcode: null,
            cost_price: 350,
            selling_price: 550,
            compare_at_price: null,
            attributes: { size: '500g' },
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      },
    });
    (productApi.deleteVariant as any).mockResolvedValue({ success: true });

    renderWithProviders(<ProductsPage organization={{ name: 'Test Market', currency: 'NGN' }} />);

    await waitFor(() => {
      expect(screen.getByText('Golden Penny Spaghetti')).toBeInTheDocument();
    });

    // Expand row to view variants
    const expandBtn = screen.getByTitle('Expand variants');
    fireEvent.click(expandBtn);

    await waitFor(() => {
      expect(screen.getByText('500g Pack')).toBeInTheDocument();
    });

    const archiveVariantBtn = screen.getByTitle('Archive variant');
    fireEvent.click(archiveVariantBtn);

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to archive variant/i)).toBeInTheDocument();
    });

    // Fill reason and check confirmation
    const reasonInput = screen.getByPlaceholderText(/Discontinued variant option/i);
    fireEvent.change(reasonInput, { target: { value: 'Supplier discontinued 500g pack' } });

    const checkbox = screen.getByRole('checkbox', { name: /Confirm archiving even if active inventory exists/i });
    fireEvent.click(checkbox);

    const confirmArchiveBtn = screen.getByRole('button', { name: 'Archive Variant' });
    fireEvent.click(confirmArchiveBtn);

    await waitFor(() => {
      expect(productApi.deleteVariant).toHaveBeenCalledWith('p-1', 'v-1', {
        confirmWithStock: true,
        reason: 'Supplier discontinued 500g pack',
      });
    });
  });
});
