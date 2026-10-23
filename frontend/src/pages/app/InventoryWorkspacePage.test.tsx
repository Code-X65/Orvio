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
    sessionStorage.clear();
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

  it('handles orvio:role-changed event by pulsing the role badge and showing toast notification', async () => {
    const dummyToken = 'header.' + btoa(JSON.stringify({ role: 'manager', org_role: 'manager', sub: 'u-123' })) + '.sig';
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
    expect(userProfile).toHaveTextContent('Manager');

    // Dispatch real-time role change event
    window.dispatchEvent(
      new CustomEvent('orvio:role-changed', {
        detail: {
          oldRole: 'manager',
          newRole: 'storekeeper',
        },
      })
    );

    // Verify role badge has pulse/bounce styling applied
    await waitFor(() => {
      const badge = userProfile.querySelector('span.text-\\[9px\\]');
      expect(badge?.className).toContain('animate-bounce');
    });
  });

  it('redirects to products when downgraded role is on a restricted path', async () => {
    const dummyToken = 'header.' + btoa(JSON.stringify({ role: 'manager', org_role: 'manager', sub: 'u-123' })) + '.sig';
    useAuthStore.setState({
      accessToken: dummyToken,
      user: {
        id: 'u-123',
        fullName: 'Amina Bello',
        email: 'amina@example.com',
        status: 'active',
      },
    });

    renderWorkspaceAt('/inventory/branches?branch=b-1');

    // Dispatch downgrade event to cashier
    window.dispatchEvent(
      new CustomEvent('orvio:role-changed', {
        detail: {
          oldRole: 'manager',
          newRole: 'cashier',
        },
      })
    );

    // Verify redirected away from restricted branches view to products
    await waitFor(() => {
      expect(screen.getByTestId('products-page-mock')).toBeInTheDocument();
    });
  });

  describe('Role-Tailored Inventory Dashboard Views', () => {
    it('renders CashierDashboardView for cashier role without executive revenue & profit charts', async () => {
      const cashierToken = 'header.' + btoa(JSON.stringify({ role: 'cashier', org_role: 'cashier', sub: 'u-cashier' })) + '.sig';
      useAuthStore.setState({
        accessToken: cashierToken,
        user: {
          id: 'u-cashier',
          fullName: 'Tola Cashier',
          email: 'tola@example.com',
          status: 'active',
        },
      });

      renderWorkspaceAt('/inventory?branch=b-1');

      // Cashier view elements must be present
      await waitFor(() => {
        expect(screen.getByTestId('cashier-dashboard-view')).toBeInTheDocument();
        expect(screen.getByText(/POS Terminal & Shift Register/i)).toBeInTheDocument();
        expect(screen.getByText(/Cash in Register Drawer/i)).toBeInTheDocument();
        expect(screen.getByText(/Shift Sales/i)).toBeInTheDocument();
        expect(screen.getByText(/Today's Shift Receipts/i)).toBeInTheDocument();
      });

      // Executive dashboard view and perspective switcher pill must NOT be rendered for cashier
      expect(screen.queryByTestId('executive-dashboard-view')).not.toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-perspective-pill')).not.toBeInTheDocument();
    });

    it('renders StorekeeperDashboardView for storekeeper role with warehouse logistics & stock health', async () => {
      const storekeeperToken = 'header.' + btoa(JSON.stringify({ role: 'storekeeper', org_role: 'storekeeper', sub: 'u-sk' })) + '.sig';
      useAuthStore.setState({
        accessToken: storekeeperToken,
        user: {
          id: 'u-sk',
          fullName: 'Kola Storekeeper',
          email: 'kola@example.com',
          status: 'active',
        },
      });

      renderWorkspaceAt('/inventory?branch=b-1');

      // Storekeeper view elements must be present
      await waitFor(() => {
        expect(screen.getByTestId('storekeeper-dashboard-view')).toBeInTheDocument();
        expect(screen.getByText(/Warehouse & Stock Operations/i)).toBeInTheDocument();
        expect(screen.getByText(/Catalog SKUs/i)).toBeInTheDocument();
        expect(screen.getByText(/Urgent Stock Replenishment/i)).toBeInTheDocument();
      });

      // Executive financial graphs and perspective switcher pill must NOT be rendered for storekeeper
      expect(screen.queryByTestId('executive-dashboard-view')).not.toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-perspective-pill')).not.toBeInTheDocument();
    });

    it('renders ExecutiveDashboardView with perspective pill for manager and allows switching views', async () => {
      const managerToken = 'header.' + btoa(JSON.stringify({ role: 'manager', org_role: 'manager', sub: 'u-mgr' })) + '.sig';
      useAuthStore.setState({
        accessToken: managerToken,
        user: {
          id: 'u-mgr',
          fullName: 'Boss Manager',
          email: 'boss@example.com',
          status: 'active',
        },
      });

      renderWorkspaceAt('/inventory?branch=b-1');

      // Manager starts on Executive perspective
      await waitFor(() => {
        expect(screen.getByTestId('executive-dashboard-view')).toBeInTheDocument();
      });

      // Perspective switcher pill is visible
      expect(screen.getByTestId('dashboard-perspective-pill')).toBeInTheDocument();
      const storekeeperPillBtn = screen.getByRole('button', { name: /Storekeeper/i });

      // Click Storekeeper pill
      fireEvent.click(storekeeperPillBtn);

      // Storekeeper view now mounts
      await waitFor(() => {
        expect(screen.getByTestId('storekeeper-dashboard-view')).toBeInTheDocument();
      });

      // Click Cashier pill
      const cashierPillBtn = screen.getByRole('button', { name: /Cashier/i });
      fireEvent.click(cashierPillBtn);

      // Cashier view now mounts
      await waitFor(() => {
        expect(screen.getByTestId('cashier-dashboard-view')).toBeInTheDocument();
      });
    });

    it('switches dashboard perspective immediately upon orvio:role-changed event in real time', async () => {
      const managerToken = 'header.' + btoa(JSON.stringify({ role: 'manager', org_role: 'manager', sub: 'u-test' })) + '.sig';
      useAuthStore.setState({
        accessToken: managerToken,
        user: {
          id: 'u-test',
          fullName: 'Staff Realtime',
          email: 'staff@example.com',
          status: 'active',
        },
      });

      renderWorkspaceAt('/inventory?branch=b-1');

      // Initially Executive
      await waitFor(() => {
        expect(screen.getByTestId('executive-dashboard-view')).toBeInTheDocument();
      });

      // Dispatch real-time role change event to Cashier
      window.dispatchEvent(
        new CustomEvent('orvio:role-changed', {
          detail: {
            oldRole: 'manager',
            newRole: 'cashier',
          },
        })
      );

      // 1. Role Change Transition Overlay mounts with 3s countdown
      await waitFor(() => {
        expect(screen.getByTestId('role-change-transition-overlay')).toBeInTheDocument();
        expect(screen.getByTestId('role-change-countdown')).toHaveTextContent(/3s/i);
      });

      // 2. Click "Switch Now" to immediately transition without waiting for 3s timer
      fireEvent.click(screen.getByTestId('role-change-switch-now-btn'));

      // 3. Dashboard should seamlessly transition to Cashier view without page reload
      await waitFor(() => {
        expect(screen.getByTestId('cashier-dashboard-view')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('executive-dashboard-view')).not.toBeInTheDocument();
      expect(screen.queryByTestId('role-change-transition-overlay')).not.toBeInTheDocument();
    });

    it('dynamically re-hydrates perspective when switching between branches with split roles', async () => {
      const staffToken = 'header.' + btoa(JSON.stringify({ role: 'storekeeper', org_role: 'storekeeper', sub: 'u-split' })) + '.sig';
      useAuthStore.setState({
        accessToken: staffToken,
        user: {
          id: 'u-split',
          fullName: 'Chidi SplitRole',
          email: 'chidi@example.com',
          status: 'active',
        },
      });

      renderWorkspaceAt('/inventory?branch=b-1');

      // Staff starts on Branch 1 (b-1) as Storekeeper
      await waitFor(() => {
        expect(screen.getByTestId('storekeeper-dashboard-view')).toBeInTheDocument();
      });

      // Dispatch branch-scoped role splitting: Branch 1 is storekeeper, Branch 2 is cashier
      window.dispatchEvent(
        new CustomEvent('orvio:role-changed', {
          detail: {
            branchRoles: {
              'b-1': 'storekeeper',
              'b-2': 'cashier',
            },
          },
        })
      );

      // Select Branch 2 (Downtown Annex) from the top branch selector
      const branchSelect = screen.getByRole('combobox', { name: /active branch selection/i });
      fireEvent.change(branchSelect, { target: { value: 'b-2' } });

      // After switching branch, perspective re-hydrates to Cashier
      await waitFor(() => {
        expect(screen.getByTestId('cashier-dashboard-view')).toBeInTheDocument();
      });
    });

    it('silently updates non-active branch role in background with toast notice and does not open transition overlay', async () => {
      const managerToken = 'header.' + btoa(JSON.stringify({ role: 'manager', org_role: 'manager', sub: 'u-multi' })) + '.sig';
      useAuthStore.setState({
        accessToken: managerToken,
        user: {
          id: 'u-multi',
          fullName: 'Staff Multi',
          email: 'multi@example.com',
          status: 'active',
        },
      });

      renderWorkspaceAt('/inventory?branch=b-1');

      // Staff starts on b-1 as Executive
      await waitFor(() => {
        expect(screen.getByTestId('executive-dashboard-view')).toBeInTheDocument();
      });

      // Update role for branch b-2 only
      window.dispatchEvent(
        new CustomEvent('orvio:role-changed', {
          detail: {
            branchRoles: {
              'b-2': 'cashier',
            },
          },
        })
      );

      // Verify Role Change Transition Overlay is NOT opened because active branch is b-1
      expect(screen.queryByTestId('role-change-transition-overlay')).not.toBeInTheDocument();
      expect(screen.getByTestId('executive-dashboard-view')).toBeInTheDocument();

      // Now switch to branch b-2 using selector
      const branchSelect = screen.getByRole('combobox', { name: /active branch selection/i });
      fireEvent.change(branchSelect, { target: { value: 'b-2' } });

      // View on b-2 now dynamically adapts to Cashier view
      await waitFor(() => {
        expect(screen.getByTestId('cashier-dashboard-view')).toBeInTheDocument();
      });
    });

    it('initializes branch roles from jwt claims branch_roles mapping', async () => {
      const tokenWithBranchRoles =
        'header.' +
        btoa(
          JSON.stringify({
            role: 'member',
            org_role: 'member',
            sub: 'u-claims',
            branch_roles: {
              'b-1': 'storekeeper',
              'b-2': 'cashier',
            },
          })
        ) +
        '.sig';

      useAuthStore.setState({
        accessToken: tokenWithBranchRoles,
        user: {
          id: 'u-claims',
          fullName: 'Claims User',
          email: 'claims@example.com',
          status: 'active',
        },
      });

      // Render at b-1
      renderWorkspaceAt('/inventory?branch=b-1');

      // Should render storekeeper view on b-1 from JWT branch_roles
      await waitFor(() => {
        expect(screen.getByTestId('storekeeper-dashboard-view')).toBeInTheDocument();
      });

      // Switch to b-2
      const branchSelect = screen.getByRole('combobox', { name: /active branch selection/i });
      fireEvent.change(branchSelect, { target: { value: 'b-2' } });

      // Should render cashier view on b-2 from JWT branch_roles
      await waitFor(() => {
        expect(screen.getByTestId('cashier-dashboard-view')).toBeInTheDocument();
      });
    });

    it('always redirects to /inventory upon transition completion to showcase new perspective', async () => {
      const managerToken = 'header.' + btoa(JSON.stringify({ role: 'manager', org_role: 'manager', sub: 'u-nav' })) + '.sig';
      useAuthStore.setState({
        accessToken: managerToken,
        user: {
          id: 'u-nav',
          fullName: 'Nav User',
          email: 'nav@example.com',
          status: 'active',
        },
      });

      renderWorkspaceAt('/inventory/categories?branch=b-1');

      await waitFor(() => {
        expect(screen.getByTestId('categories-page-mock')).toBeInTheDocument();
      });

      // Role changed for active branch
      window.dispatchEvent(
        new CustomEvent('orvio:role-changed', {
          detail: {
            oldRole: 'manager',
            newRole: 'cashier',
          },
        })
      );

      // Overlay opens
      await waitFor(() => {
        expect(screen.getByTestId('role-change-transition-overlay')).toBeInTheDocument();
      });

      // Click switch now to complete transition
      fireEvent.click(screen.getByTestId('role-change-switch-now-btn'));

      // Should be redirected to /inventory?branch=b-1 and render CashierDashboardView
      await waitFor(() => {
        expect(screen.getByTestId('test-location')).toHaveTextContent('/inventory?branch=b-1');
        expect(screen.getByTestId('cashier-dashboard-view')).toBeInTheDocument();
      });
    });
  });
});

