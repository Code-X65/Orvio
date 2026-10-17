import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InventoryWorkspacePage } from './InventoryWorkspacePage';

import { useAuthStore } from '../../stores/auth-store';

// Mock branchApi
vi.mock('../../features/inventory/branches-api', () => ({
  branchApi: {
    getBranches: vi.fn().mockResolvedValue({
      branches: [
        { id: 'b-1', name: 'Main Store', type: 'retail', is_primary: true },
        { id: 'b-2', name: 'Downtown Annex', type: 'warehouse', is_primary: false },
      ],
    }),
  },
}));

// Mock catalog APIs for CatalogSearchModal
vi.mock('../../features/inventory/products-api', () => ({
  productApi: {
    searchProducts: vi.fn().mockResolvedValue({ products: [], total: 0 }),
  },
}));

vi.mock('../../features/inventory/categories-api', () => ({
  categoryApi: {
    getCategories: vi.fn().mockResolvedValue({ categories: [] }),
  },
}));

vi.mock('../../features/inventory/brands-api', () => ({
  brandApi: {
    getBrands: vi.fn().mockResolvedValue({ brands: [] }),
  },
}));

// Mock ProductsPage
vi.mock('../../features/inventory/components/ProductsPage', () => ({
  ProductsPage: ({ initialCategoryId }: { initialCategoryId?: string }) => (
    <div data-testid="products-page-mock">
      <span>Products View Mock</span>
      {initialCategoryId && <span data-testid="filter-cat-badge">{initialCategoryId}</span>}
    </div>
  ),
}));

// Mock CategoriesPage
vi.mock('../../features/inventory/components/CategoriesPage', () => ({
  CategoriesPage: ({ onNavigateToProducts }: { onNavigateToProducts?: (catId: string) => void }) => (
    <div data-testid="categories-page-mock">
      <span>Categories View Mock</span>
      <button
        data-testid="mock-cat-nav-btn"
        onClick={() => onNavigateToProducts?.('cat-123')}
      >
        View Products in Cat
      </button>
    </div>
  ),
}));

// Mock StockManagementPage
vi.mock('../../features/inventory/components/StockManagementPage', () => ({
  StockManagementPage: ({ branchName }: { branchName?: string }) => (
    <div data-testid="stock-management-page-mock">
      <span>Stock & Inventory Management</span>
      <span>Branch: {branchName}</span>
    </div>
  ),
}));

describe('InventoryWorkspacePage Routing & Navigation', () => {
  const mockOrg = {
    id: 'org-1',
    name: 'Apex Stores',
    subdomain: 'apex',
    currency: 'USD',
  };

  const mockBranches = [
    { id: 'b-1', name: 'Main Store', type: 'retail', is_primary: true },
    { id: 'b-2', name: 'Downtown Annex', type: 'warehouse', is_primary: false },
  ];

  function LocationDisplay() {
    const loc = useLocation();
    return (
      <div data-testid="test-location">
        {loc.pathname}{loc.search}
      </div>
    );
  }

  function renderWorkspaceAt(initialPath: string) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <LocationDisplay />
          <Routes>
            <Route
              path="/inventory/*"
              element={
                <InventoryWorkspacePage
                  organization={mockOrg}
                  branch={mockBranches[0]}
                  branches={mockBranches}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('renders Dashboard metrics when accessing /inventory', () => {
    renderWorkspaceAt('/inventory?branch=b-1');

    // Dashboard metrics rendered
    expect(screen.getAllByText('Recent Orders').length).toBeGreaterThan(0);
    expect(screen.getByText('Total Customers')).toBeInTheDocument();

    // Verify sidebar links exist with proper hrefs
    const productsLink = screen.getByRole('link', { name: /^products$/i });
    expect(productsLink).toHaveAttribute('href', '/inventory/products?branch=b-1');
  });

  it('renders ProductsPage when navigating to /inventory/products', () => {
    renderWorkspaceAt('/inventory/products');

    expect(screen.getByTestId('products-page-mock')).toBeInTheDocument();
    expect(screen.queryByText('Total Customers')).not.toBeInTheDocument();
  });

  it('renders CategoriesPage when navigating to /inventory/categories', () => {
    renderWorkspaceAt('/inventory/categories');

    expect(screen.getByTestId('categories-page-mock')).toBeInTheDocument();
  });

  it('redirects singular alias /inventory/product to /inventory/products', async () => {
    renderWorkspaceAt('/inventory/product?branch=b-1');

    await waitFor(() => {
      const loc = screen.getByTestId('test-location').textContent;
      expect(loc).toBe('/inventory/products?branch=b-1');
    });

    expect(screen.getByTestId('products-page-mock')).toBeInTheDocument();
  });

  it('renders dedicated OperationalSectionView for secondary sections (orders)', () => {
    renderWorkspaceAt('/inventory/orders');

    expect(screen.getByText('Sales Orders & Counter Transactions')).toBeInTheDocument();
    expect(screen.getByText("Today's Orders")).toBeInTheDocument();
    // Modal is NOT open
    expect(screen.queryByText('Close & Continue')).not.toBeInTheDocument();
  });

  it('renders dedicated StockManagementPage for stock/inventory', () => {
    renderWorkspaceAt('/inventory/stock');

    expect(screen.getByTestId('stock-management-page-mock')).toBeInTheDocument();
    expect(screen.getByText('Stock & Inventory Management')).toBeInTheDocument();
  });

  it('preserves branch query param when navigating between sidebar sections', () => {
    renderWorkspaceAt('/inventory?branch=b-2');

    const ordersLink = screen.getByRole('link', { name: /^orders$/i });
    expect(ordersLink).toHaveAttribute('href', '/inventory/orders?branch=b-2');
  });

  it('wires category query param from CategoriesPage to ProductsPage', async () => {
    renderWorkspaceAt('/inventory/categories');

    const catBtn = screen.getByTestId('mock-cat-nav-btn');
    fireEvent.click(catBtn);

    await waitFor(() => {
      expect(screen.getByTestId('products-page-mock')).toBeInTheDocument();
      expect(screen.getByTestId('filter-cat-badge').textContent).toBe('cat-123');
    });
  });

  it('renders CATALOG parent menu as a collapsible dropdown consolidating Products, Categories, and Brands', () => {
    renderWorkspaceAt('/inventory?branch=b-1');

    const catalogToggle = screen.getByTestId('catalog-menu-toggle');
    expect(catalogToggle).toBeInTheDocument();
    expect(catalogToggle).toHaveTextContent(/CATALOG/i);

    // Initial state: expanded, sub-items are present
    expect(screen.getByRole('link', { name: /^products$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^categories$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^brands$/i })).toBeInTheDocument();

    // Clicking toggle collapses CATALOG menu
    fireEvent.click(catalogToggle);
    expect(screen.queryByTestId('catalog-submenu')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^products$/i })).not.toBeInTheDocument();

    // Clicking again expands CATALOG menu
    fireEvent.click(catalogToggle);
    expect(screen.getByTestId('catalog-submenu')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^products$/i })).toBeInTheDocument();
  });

  it('toggles sidebar display mode between Icon + Name and Icon Only', () => {
    renderWorkspaceAt('/inventory?branch=b-1');

    const sidebar = screen.getByTestId('inventory-sidebar');
    expect(sidebar).toHaveAttribute('data-sidebar-mode', 'icon-and-name');

    // Switch to Icon Only mode using collapse button
    const collapseBtn = screen.getByTestId('sidebar-collapse-btn');
    fireEvent.click(collapseBtn);

    expect(sidebar).toHaveAttribute('data-sidebar-mode', 'icon-only');
    expect(localStorage.getItem('orvio.sidebar.mode')).toBe('icon-only');

    // In Icon Only mode, expand button exists
    const expandBtn = screen.getByTestId('sidebar-expand-btn');
    fireEvent.click(expandBtn);

    expect(sidebar).toHaveAttribute('data-sidebar-mode', 'icon-and-name');
    expect(localStorage.getItem('orvio.sidebar.mode')).toBe('icon-and-name');
  });

  it('allows expanding CATALOG dropdown in Icon Only mode via flyout menu', () => {
    renderWorkspaceAt('/inventory?branch=b-1');

    // Switch to Icon Only mode
    fireEvent.click(screen.getByTestId('sidebar-collapse-btn'));

    // In icon-only mode, clicking CATALOG toggle opens the flyout menu
    const catalogToggle = screen.getByTestId('catalog-menu-toggle');
    fireEvent.click(catalogToggle);

    const flyout = screen.getByTestId('catalog-flyout-menu');
    expect(flyout).toBeInTheDocument();
    expect(flyout).toHaveTextContent('CATALOG');
    expect(screen.getByRole('link', { name: /products/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /categories/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /brands/i })).toBeInTheDocument();
  });

  it('renders search bar trigger and opens Catalog Search palette on click and on Ctrl+K', async () => {
    renderWorkspaceAt('/inventory?branch=b-1');

    const searchTrigger = screen.getByTestId('catalog-search-trigger');
    expect(searchTrigger).toBeInTheDocument();
    expect(searchTrigger).toHaveTextContent(/Search catalog/i);
    expect(searchTrigger).toHaveTextContent(/Ctrl.*K/i);

    // Click opens modal
    fireEvent.click(searchTrigger);
    expect(screen.getByTestId('catalog-search-modal')).toBeInTheDocument();

    // Close modal via escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('catalog-search-modal')).not.toBeInTheDocument();
    });

    // Ctrl+K opens modal
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByTestId('catalog-search-modal')).toBeInTheDocument();
  });

  it('renders locked NGN currency badge with cursor-not-allowed', () => {
    renderWorkspaceAt('/inventory?branch=b-1');

    const badge = screen.getByTestId('currency-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('₦');
    expect(badge).toHaveTextContent('NGN');
    expect(badge).toHaveClass('cursor-not-allowed');
    expect(badge).toHaveAttribute('title', 'Currency is locked to Nigerian Naira (NGN)');
  });

  it('removes launchpad link and organization initials block from top header', () => {
    renderWorkspaceAt('/inventory?branch=b-1');

    expect(screen.queryByRole('link', { name: /launchpad/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Launchpad')).not.toBeInTheDocument();
    // Org name is 'Apex Stores', 'AS' should not be rendered in an avatar in header
    expect(screen.queryByText('AS')).not.toBeInTheDocument();
  });

  it('renders authenticated user profile with full name, role badge, and initials in the sidebar', () => {
    const dummyToken = 'header.' + btoa(JSON.stringify({ role: 'admin', sub: 'u-123' })) + '.sig';
    useAuthStore.setState({
      accessToken: dummyToken,
      user: {
        id: 'u-123',
        fullName: 'Amina Bello',
        email: 'amina@example.com',
        status: 'active',
      },
    });

    renderWorkspaceAt('/inventory?branch=b-1');

    const userProfile = screen.getByTestId('sidebar-user-profile');
    expect(userProfile).toBeInTheDocument();
    expect(userProfile).toHaveTextContent('Amina Bello');
    expect(userProfile).toHaveTextContent('Admin');
    expect(userProfile).toHaveTextContent('amina@example.com');
    // Initials: Amina Bello -> AB
    expect(userProfile).toHaveTextContent('AB');

    // In collapsed icon-only mode:
    fireEvent.click(screen.getByTestId('sidebar-collapse-btn'));
    const collapsedAvatar = screen.getByTestId('sidebar-user-avatar-collapsed');
    expect(collapsedAvatar).toBeInTheDocument();
    expect(collapsedAvatar).toHaveTextContent('AB');
  });
});
