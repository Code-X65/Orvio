import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SuppliersPage } from './SuppliersPage';
import { supplierApi, type Supplier } from '../suppliers-api';

vi.mock('../suppliers-api', () => ({
  supplierApi: {
    listSuppliers: vi.fn(),
    getSupplier: vi.fn(),
    createSupplier: vi.fn(),
    updateSupplier: vi.fn(),
    checkDuplicate: vi.fn().mockResolvedValue({ isDuplicate: false, matchedSupplier: null }),
  },
}));

vi.mock('../stock-receipts-api', () => ({
  stockReceiptsApi: {
    listReceipts: vi.fn().mockResolvedValue({ receipts: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } }),
    getReceipt: vi.fn(),
    createReceipt: vi.fn(),
  },
}));

vi.mock('../products-api', () => ({
  productApi: {
    listProducts: vi.fn().mockResolvedValue({ products: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } }),
    getProduct: vi.fn(),
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

describe('SuppliersPage Component', () => {
  const mockSuppliers: Supplier[] = [
    {
      id: 'supp-1',
      name: 'Global Fabrics Ltd',
      phone: '+2348011122233',
      email: 'sales@globalfabrics.com',
      contactPerson: 'Adeola',
      taxId: null,
      address: 'Plot 4, Textile Way, Ikeja',
      notes: 'Key textiles vendor',
      isActive: true,
      receiptsCount: 7,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'supp-2',
      name: 'Prime Packaging Co',
      phone: '+2348099988877',
      email: 'orders@primepackaging.ng',
      contactPerson: 'Emeka',
      taxId: null,
      address: 'Lagos Island',
      notes: null,
      isActive: false,
      receiptsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supplierApi.listSuppliers).mockResolvedValue({
      suppliers: mockSuppliers,
      pagination: {
        page: 1,
        limit: 50,
        total: 2,
        totalPages: 1,
      },
    });
  });

  it('renders suppliers table with metrics and supplier rows', async () => {
    renderWithProviders(
      <SuppliersPage
        branches={[{ id: 'b-1', name: 'Main Store' }]}
        activeBranchId="b-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Global Fabrics Ltd')).toBeInTheDocument();
      expect(screen.getByText('Prime Packaging Co')).toBeInTheDocument();
    });

    // Check contact information and receipts count badge
    expect(screen.getByText('+2348011122233')).toBeInTheDocument();
    expect(screen.getByText('sales@globalfabrics.com')).toBeInTheDocument();
    expect(screen.getAllByText('7').length).toBeGreaterThan(0);
  });

  it('opens the Supplier Drawer when clicking "+ Add Supplier"', async () => {
    renderWithProviders(
      <SuppliersPage
        branches={[{ id: 'b-1', name: 'Main Store' }]}
        activeBranchId="b-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Global Fabrics Ltd')).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /Add Supplier/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('Add New Supplier')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. Apex Global Foods Ltd')).toBeInTheDocument();
    });
  });

  it('filters suppliers by search term', async () => {
    renderWithProviders(
      <SuppliersPage
        branches={[{ id: 'b-1', name: 'Main Store' }]}
        activeBranchId="b-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Global Fabrics Ltd')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by vendor name/i);
    fireEvent.change(searchInput, { target: { value: 'Global' } });

    await waitFor(() => {
      expect(supplierApi.listSuppliers).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Global',
        })
      );
    });
  });
});
