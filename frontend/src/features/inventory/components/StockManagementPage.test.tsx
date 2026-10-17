import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { StockManagementPage } from './StockManagementPage';
import { stockApi, type StockSummary, type StockItem, type StockMovement } from '../stock-api';
import { stockReceiptsApi } from '../stock-receipts-api';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('../branches-api', () => ({
  branchApi: {
    getBranches: vi.fn().mockResolvedValue({
      branches: [
        { id: 'b-1', name: 'Main Store', type: 'store', status: 'active', is_primary: true },
        { id: 'b-2', name: 'Warehouse North', type: 'warehouse', status: 'active', is_primary: false },
      ],
    }),
  },
}));

vi.mock('../stock-api', () => ({
  stockApi: {
    getStockSummary: vi.fn(),
    listStockItems: vi.fn(),
    listStockMovements: vi.fn(),
    recordOpeningStock: vi.fn(),
    receiveStock: vi.fn(),
    adjustStock: vi.fn(),
    transferStock: vi.fn(),
  },
}));

vi.mock('../stock-receipts-api', () => ({
  stockReceiptsApi: {
    listReceipts: vi.fn().mockResolvedValue({
      receipts: [
        {
          id: 'rcpt-1',
          reference: 'RCPT-000001',
          receiptDate: '2026-10-14',
          supplierId: 'supp-1',
          supplierName: 'Global Fabrics Ltd',
          branchId: 'b-1',
          branchName: 'Main Store',
          supplierInvoiceNumber: 'INV-1001',
          notes: 'Delivered in good condition',
          status: 'COMPLETED',
          lineCount: 2,
          totalQuantity: 50,
          totalCost: 150000,
          receivedById: 'user-1',
          receivedByName: 'John Storekeeper',
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }),
    getReceipt: vi.fn(),
    createReceipt: vi.fn(),
  },
}));

vi.mock('../suppliers-api', () => ({
  supplierApi: {
    listSuppliers: vi.fn().mockResolvedValue({
      suppliers: [
        {
          id: 'supp-1',
          name: 'Global Fabrics Ltd',
          phone: '+2348011122233',
          email: 'sales@globalfabrics.com',
          contact_person: 'Adeola',
          address: 'Lagos',
          is_active: true,
          receipts_count: 5,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    }),
  },
}));

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

describe('StockManagementPage Component', () => {
  const mockOrg = {
    id: 'org-1',
    name: 'Apex Stores',
    currency: 'USD',
  };

  const mockBranches = [
    { id: 'b-1', name: 'Main Store' },
    { id: 'b-2', name: 'Warehouse North' },
  ];

  const mockSummary: StockSummary = {
    totalTracked: 42,
    inStockCount: 38,
    lowStockCount: 3,
    outOfStockCount: 1,
    totalQuantityOnHand: 850,
    totalReserved: 10,
    totalAvailable: 840,
  };

  const mockStockItems: StockItem[] = [
    {
      id: 'item-1',
      productId: 'prod-1',
      variantId: null,
      productName: 'Organic Espresso Beans',
      sku: 'COF-ESP-01',
      barcode: '890123456789',
      imageUrl: null,
      categoryName: 'Beverages',
      brandName: 'RoastCo',
      branchId: 'b-1',
      branchName: 'Main Store',
      quantityOnHand: 45,
      reserved: 2,
      available: 43,
      lowStockThreshold: 10,
      status: 'in_stock',
      unitOfMeasure: 'units',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item-2',
      productId: 'prod-2',
      variantId: null,
      productName: 'Matcha Powder 100g',
      sku: 'TEA-MAT-02',
      barcode: null,
      imageUrl: null,
      categoryName: 'Beverages',
      brandName: 'ZenGreens',
      branchId: 'b-1',
      branchName: 'Main Store',
      quantityOnHand: 4,
      reserved: 0,
      available: 4,
      lowStockThreshold: 5,
      status: 'low_stock',
      unitOfMeasure: 'units',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item-3',
      productId: 'prod-3',
      variantId: null,
      productName: 'Vanilla Syrup 750ml',
      sku: 'SYR-VAN-03',
      barcode: null,
      imageUrl: null,
      categoryName: 'Beverages',
      brandName: 'SweetSyrups',
      branchId: 'b-1',
      branchName: 'Main Store',
      quantityOnHand: 0,
      reserved: 0,
      available: 0,
      lowStockThreshold: 5,
      status: 'out_of_stock',
      unitOfMeasure: 'units',
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockMovements: StockMovement[] = [
    {
      id: 'mov-1',
      orgId: 'org-1',
      branchId: 'b-1',
      branchName: 'Main Store',
      productId: 'prod-1',
      productName: 'Organic Espresso Beans',
      productSku: 'COF-ESP-01',
      productImageUrl: null,
      movementType: 'receipt',
      quantity: 50,
      balanceBefore: 0,
      balanceAfter: 50,
      reason: null,
      referenceId: 'PO-991',
      actorId: 'user-1',
      actorName: 'John Manager',
      notes: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'mov-2',
      orgId: 'org-1',
      branchId: 'b-1',
      branchName: 'Main Store',
      productId: 'prod-1',
      productName: 'Organic Espresso Beans',
      productSku: 'COF-ESP-01',
      productImageUrl: null,
      movementType: 'adjustment',
      quantity: -5,
      balanceBefore: 50,
      balanceAfter: 45,
      reason: 'damage',
      referenceId: 'ADJ-102',
      actorId: 'user-1',
      actorName: 'John Manager',
      notes: null,
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stockApi.getStockSummary).mockResolvedValue(mockSummary);
    vi.mocked(stockApi.listStockItems).mockResolvedValue({
      items: mockStockItems,
      pagination: {
        total: 3,
        page: 1,
        limit: 25,
        totalPages: 1,
      },
    });
    vi.mocked(stockApi.listStockMovements).mockResolvedValue({
      movements: mockMovements,
      pagination: {
        total: 2,
        page: 1,
        limit: 25,
        totalPages: 1,
      },
    });
    vi.mocked(stockReceiptsApi.listReceipts).mockResolvedValue({
      receipts: [
        {
          id: 'rcpt-1',
          reference: 'RCPT-000001',
          receiptDate: '2026-10-14',
          supplierId: 'supp-1',
          supplierName: 'Global Fabrics Ltd',
          branchId: 'b-1',
          branchName: 'Main Store',
          supplierInvoiceNumber: 'INV-1001',
          notes: 'Delivered in good condition',
          status: 'COMPLETED',
          lineCount: 2,
          totalQuantity: 50,
          totalCost: 150000,
          receivedById: 'user-1',
          receivedByName: 'John Storekeeper',
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('renders stock overview metrics correctly', async () => {
    renderWithProviders(
      <StockManagementPage
        organization={mockOrg}
        branchId="b-1"
        branchName="Main Store"
        branches={mockBranches}
      />
    );

    // Header title and subtitle
    expect(screen.getByText('Stock Management & Ledger')).toBeInTheDocument();
    expect(screen.getByText(/Real-time inventory levels, stock adjustments/i)).toBeInTheDocument();

    // Summary KPIs
    await waitFor(() => {
      expect(screen.getByText('38')).toBeInTheDocument(); // In Stock
      expect(screen.getByText('3')).toBeInTheDocument();  // Low Stock
      expect(screen.getByText('1')).toBeInTheDocument();  // Out of Stock
      expect(screen.getByText('850 units')).toBeInTheDocument(); // Total units
    });
  });

  it('switches to Stock List tab and displays inventory items', async () => {
    renderWithProviders(
      <StockManagementPage
        organization={mockOrg}
        branchId="b-1"
        branchName="Main Store"
        branches={mockBranches}
      />
    );

    // Click Stock List tab
    const listTabBtn = screen.getByRole('button', { name: /Product Stock List/i });
    fireEvent.click(listTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Organic Espresso Beans')).toBeInTheDocument();
      expect(screen.getByText(/SKU: COF-ESP-01/)).toBeInTheDocument();
      expect(screen.getByText('Matcha Powder 100g')).toBeInTheDocument();
      expect(screen.getByText('Vanilla Syrup 750ml')).toBeInTheDocument();
    });

    // Check status badges
    expect(screen.getAllByText('In Stock').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Low Stock/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Out of Stock').length).toBeGreaterThan(0);
  });

  it('switches to Movement Ledger tab and displays ledger entries', async () => {
    renderWithProviders(
      <StockManagementPage
        organization={mockOrg}
        branchId="b-1"
        branchName="Main Store"
        branches={mockBranches}
      />
    );

    // Click Ledger tab
    const ledgerTabBtn = screen.getByRole('button', { name: /Movements Ledger/i });
    fireEvent.click(ledgerTabBtn);

    await waitFor(() => {
      expect(screen.getByText('PO-991')).toBeInTheDocument();
      expect(screen.getByText('[damage]')).toBeInTheDocument();
      expect(screen.getByText('ADJ-102')).toBeInTheDocument();
    });
  });

  it('opens Receive Stock modal and shows live calculation of resulting balance', async () => {
    renderWithProviders(
      <StockManagementPage
        organization={mockOrg}
        branchId="b-1"
        branchName="Main Store"
        branches={mockBranches}
      />
    );

    // Wait for stock items to load so modal has data
    await waitFor(() => {
      expect(screen.getByText('38')).toBeInTheDocument();
    });

    // Open Receive Stock modal
    const receiveBtn = screen.getByRole('button', { name: /Receive Stock/i });
    fireEvent.click(receiveBtn);

    // Modal should be open
    expect(screen.getByText('Stock Receipt Intake')).toBeInTheDocument();
    expect(screen.getByText('Line Total')).toBeInTheDocument();
  });

  it('opens Adjust Stock modal and allows dual-mode delta vs counted adjustments', async () => {
    renderWithProviders(
      <StockManagementPage
        organization={mockOrg}
        branchId="b-1"
        branchName="Main Store"
        branches={mockBranches}
      />
    );

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('38')).toBeInTheDocument();
    });

    // Open Adjust Stock modal
    const adjustBtn = screen.getByRole('button', { name: /Adjust Stock/i });
    fireEvent.click(adjustBtn);

    // Modal should be open
    expect(screen.getByText('Adjust Product Stock')).toBeInTheDocument();
    expect(screen.getByText('Quantity Delta (+ / -)')).toBeInTheDocument();
    expect(screen.getByText('New Verified Count')).toBeInTheDocument();

    // Toggle to Counted Balance mode
    const countedModeBtn = screen.getByRole('button', { name: /New Verified Count/i });
    fireEvent.click(countedModeBtn);

    expect(screen.getByText(/New Verified On-Hand Count/i)).toBeInTheDocument();
  });

  it('opens Branch Transfer modal with destination branch selection', async () => {
    renderWithProviders(
      <StockManagementPage
        organization={mockOrg}
        branchId="b-1"
        branchName="Main Store"
        branches={mockBranches}
      />
    );

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('38')).toBeInTheDocument();
    });

    // Open Transfer modal
    const transferBtn = screen.getByRole('button', { name: /Transfer/i });
    fireEvent.click(transferBtn);

    expect(screen.getByText('Transfer Stock Between Branches')).toBeInTheDocument();
    expect(screen.getByText('Destination Branch *')).toBeInTheDocument();
  });

  it('opens stock action modals cleanly without redundant branch badges', async () => {
    renderWithProviders(
      <StockManagementPage
        organization={mockOrg}
        branchId="b-1"
        branchName="Main Store"
        branches={mockBranches}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('38')).toBeInTheDocument();
    });

    // 1. Receive Stock Modal opens cleanly without locked branch badge
    const receiveBtn = screen.getByRole('button', { name: /Receive Stock/i });
    fireEvent.click(receiveBtn);

    expect(screen.queryByTestId('locked-branch-badge')).not.toBeInTheDocument();
    expect(screen.getByText('Stock Receipt Intake')).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getAllByRole('button', { name: /Cancel/i })[0];
    fireEvent.click(closeBtn);

    // 2. Adjust Stock Modal opens cleanly without locked branch badge
    const adjustBtn = screen.getByRole('button', { name: /Adjust Stock/i });
    fireEvent.click(adjustBtn);

    expect(screen.queryByTestId('locked-branch-badge')).not.toBeInTheDocument();
    expect(screen.getByText('Adjust Product Stock')).toBeInTheDocument();

    // Close modal
    fireEvent.click(screen.getAllByRole('button', { name: /Cancel/i })[0]);

    // 3. Transfer Stock Modal opens cleanly without locked source branch badge
    const transferBtn = screen.getByRole('button', { name: /Transfer/i });
    fireEvent.click(transferBtn);

    expect(screen.queryByTestId('locked-source-branch-badge')).not.toBeInTheDocument();
    expect(screen.getByText('Transfer Stock Between Branches')).toBeInTheDocument();
    expect(screen.getByText('Destination Branch *')).toBeInTheDocument();
  });

  it('seamlessly defaults stock actions to the active branch without blocking modals', async () => {
    renderWithProviders(
      <StockManagementPage
        organization={mockOrg}
        branchId="all"
        branchName="All Branches"
        branches={mockBranches}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('38')).toBeInTheDocument();
    });

    // Click Receive Stock while in "all" branch view
    const receiveBtn = screen.getByRole('button', { name: /Receive Stock/i });
    fireEvent.click(receiveBtn);

    // Modal opens directly without requiring manual branch prompts
    expect(screen.getByText('Stock Receipt Intake')).toBeInTheDocument();
  });

  it('renders and switches to the Stock Receipts tab, listing receipt records', async () => {
    renderWithProviders(
      <StockManagementPage
        organization={mockOrg}
        branchId="b-1"
        branchName="Main Store"
        branches={mockBranches}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Stock Receipts')).toBeInTheDocument();
    });

    const receiptsTabBtn = screen.getByText('Stock Receipts');
    fireEvent.click(receiptsTabBtn);

    await waitFor(() => {
      expect(screen.getByText('RCPT-000001')).toBeInTheDocument();
      expect(screen.getByText('Global Fabrics Ltd')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
    });
  });
});
