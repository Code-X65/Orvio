import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { InventoryPage } from './InventoryPage';
import { useAuthStore } from '../../stores/auth-store';
import * as hooksModule from '../../features/inventory/hooks';

// Mock child components
vi.mock('./InventoryWorkspacePage', () => ({
  InventoryWorkspacePage: ({ branch, branches }: any) => (
    <div data-testid="inventory-workspace">
      <span>Active Branch: {branch?.name}</span>
      <span>Total Branches: {branches?.length}</span>
    </div>
  ),
}));

vi.mock('../../features/inventory/components/BranchGatewayScreen', () => ({
  BranchGatewayScreen: ({ branches }: any) => (
    <div data-testid="branch-gateway-screen">
      <span>Select Branch ({branches.length} available)</span>
    </div>
  ),
}));

vi.mock('../../features/inventory/components/InventorySetupWizard', () => ({
  InventorySetupWizard: () => <div>Setup Wizard</div>,
}));

vi.mock('../../features/inventory/hooks', () => ({
  useInventoryOnboarding: vi.fn(),
}));

function createMockJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mocksignature`;
}

describe('InventoryPage Branch Scoping & Gateway Screen Bypass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bypasses BranchGatewayScreen and auto-redirects directly into assigned branch for Storekeeper with 1 branch', () => {
    const token = createMockJwt({
      sub: 'u-storekeeper',
      role: 'member',
      org_role: 'storekeeper',
      scope_all_branches: false,
      branch_scope: ['b-ikeja'],
      app_access: ['inventory'],
    });

    useAuthStore.setState({
      accessToken: token,
      user: { id: 'u-storekeeper', email: 'store@example.com', fullName: 'Store User', status: 'active' },
      organization: { id: 'org-1', name: 'Acme Supermarket', subdomain: 'acme', status: 'active' },
      status: 'authenticated',
      isHydrated: true,
    });

    vi.mocked(hooksModule.useInventoryOnboarding).mockReturnValue({
      data: {
        completed: true,
        status: 'completed',
        branch: { id: 'b-ikeja', name: 'Ikeja Branch', type: 'store', status: 'active', is_primary: false },
        branches: [
          { id: 'b-ikeja', name: 'Ikeja Branch', type: 'store', status: 'active' },
        ],
        organization: { id: 'org-1', name: 'Acme Supermarket', subdomain: 'acme' },
      } as any,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      invalidate: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/inventory']}>
        <Routes>
          <Route path="/inventory" element={<InventoryPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Gateway screen should NOT be rendered
    expect(screen.queryByTestId('branch-gateway-screen')).not.toBeInTheDocument();

    // Inventory workspace should be directly mounted with the assigned branch
    expect(screen.getByTestId('inventory-workspace')).toBeInTheDocument();
    expect(screen.getByText('Active Branch: Ikeja Branch')).toBeInTheDocument();
    expect(screen.getByText('Total Branches: 1')).toBeInTheDocument();
  });

  it('renders BranchGatewayScreen for Owner when org has multiple branches and no ?branch query is set', () => {
    const token = createMockJwt({
      sub: 'u-owner',
      role: 'owner',
      org_role: 'owner',
      scope_all_branches: true,
      branch_scope: [],
      app_access: ['inventory'],
    });

    useAuthStore.setState({
      accessToken: token,
      user: { id: 'u-owner', email: 'owner@example.com', fullName: 'Owner User', status: 'active' },
      organization: { id: 'org-1', name: 'Acme Supermarket', subdomain: 'acme', status: 'active' },
      status: 'authenticated',
      isHydrated: true,
    });

    vi.mocked(hooksModule.useInventoryOnboarding).mockReturnValue({
      data: {
        completed: true,
        status: 'completed',
        branch: { id: 'b-hq', name: 'HQ Branch', type: 'warehouse', status: 'active', is_primary: true },
        branches: [
          { id: 'b-hq', name: 'HQ Branch', type: 'warehouse', status: 'active' },
          { id: 'b-ikeja', name: 'Ikeja Branch', type: 'store', status: 'active' },
        ],
        organization: { id: 'org-1', name: 'Acme Supermarket', subdomain: 'acme' },
      } as any,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      invalidate: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/inventory']}>
        <Routes>
          <Route path="/inventory" element={<InventoryPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Gateway screen SHOULD be rendered
    expect(screen.getByTestId('branch-gateway-screen')).toBeInTheDocument();
    expect(screen.getByText('Select Branch (2 available)')).toBeInTheDocument();
    expect(screen.queryByTestId('inventory-workspace')).not.toBeInTheDocument();
  });
});
