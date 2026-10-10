import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProductsPage } from './ProductsPage';
import { productApi } from '../products-api';
import { categoryApi } from '../categories-api';

vi.mock('../products-api', () => ({
  productApi: {
    listProducts: vi.fn(),
    getProductById: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
    createVariant: vi.fn(),
    getPriceHistory: vi.fn(),
  },
}));

vi.mock('../categories-api', () => ({
  categoryApi: {
    getCategories: vi.fn(),
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
    render(<ProductsPage organization={{ name: 'Test Market', currency: 'NGN' }} />);

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

    render(<ProductsPage organization={{ name: 'Test Market', currency: 'NGN' }} />);

    await waitFor(() => {
      expect(screen.getByText('Golden Penny Spaghetti')).toBeInTheDocument();
    });

    // Find and click expand button
    const expandBtn = screen.getByTitle('Expand variants');
    fireEvent.click(expandBtn);

    await waitFor(() => {
      expect(screen.getByText('Small Pack')).toBeInTheDocument();
      expect(screen.getByText('GPS-500G-SM')).toBeInTheDocument();
    });
  });

  it('displays promotional compare-at price and discount pill in table row', async () => {
    render(<ProductsPage organization={{ name: 'Test Market', currency: 'NGN' }} />);

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

    render(<ProductsPage organization={{ name: 'Test Market', currency: 'NGN' }} />);

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
});
