import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TenantDashboardPage } from './TenantDashboardPage';
import { useAuthStore } from '../../stores/auth-store';
import * as workspaceModule from '../../contexts/WorkspaceContext';

// Mock Workspace Context
vi.mock('../../contexts/WorkspaceContext', async (importOriginal) => {
  const actual = await importOriginal<typeof workspaceModule>();
  return {
    ...actual,
    useWorkspace: vi.fn(),
    WorkspaceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe('TenantDashboardPage Role-based Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: 'test-token',
      user: { id: 'u1', email: 'staff@example.com', fullName: 'Staff User', status: 'active' },
      organization: { id: 'org1', name: 'Acme Supermarket', subdomain: 'acme', status: 'active' },
      status: 'authenticated',
      isHydrated: true,
    });
  });

  it('prunes administrative tiles for Storekeeper, showing only permitted application', () => {
    vi.mocked(workspaceModule.useWorkspace).mockReturnValue({
      user: { id: 'u1', email: 'staff@example.com', fullName: 'Staff User', status: 'active' },
      organization: { id: 'org1', name: 'Acme Supermarket', subdomain: 'acme', status: 'active' },
      membership: {
        id: 'mem1',
        role: 'member',
        org_role: 'storekeeper',
        scope_all_branches: false,
        app_access: ['inventory'],
        status: 'active',
      },
      branch: { id: 'b1', name: 'Ikeja Branch', type: 'store', status: 'active' },
      branches: [{ id: 'b1', name: 'Ikeja Branch', type: 'store', status: 'active' }],
      installedProducts: [
        { id: 'p1', org_id: 'org1', product_key: 'inventory', status: 'active', is_primary: true, created_at: '', updated_at: '' },
        { id: 'p2', org_id: 'org1', product_key: 'pos', status: 'active', is_primary: false, created_at: '', updated_at: '' },
      ],
      isLoading: false,
      isEmailVerified: true,
      isEmailUnverified: false,
      hasProduct: vi.fn(),
      can: vi.fn(),
      installApp: vi.fn(),
      uninstallApp: vi.fn(),
      setPrimaryApp: vi.fn(),
      refreshWorkspace: vi.fn(),
    });

    render(
      <BrowserRouter>
        <TenantDashboardPage />
      </BrowserRouter>
    );

    // Should see Inventory app tile
    expect(screen.getByText('Inventory Management')).toBeInTheDocument();

    // Should NOT see POS (not in app_access)
    expect(screen.queryByText(/pos|point of sale/i)).not.toBeInTheDocument();

    // Should NOT see administrative tiles
    expect(screen.queryByText('Employees')).not.toBeInTheDocument();
    expect(screen.queryByText('Apps')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('displays full application suite and admin tiles for Organization Owner', () => {
    vi.mocked(workspaceModule.useWorkspace).mockReturnValue({
      user: { id: 'u0', email: 'owner@example.com', fullName: 'Owner User', status: 'active' },
      organization: { id: 'org1', name: 'Acme Supermarket', subdomain: 'acme', status: 'active' },
      membership: {
        id: 'mem0',
        role: 'owner',
        org_role: 'owner',
        scope_all_branches: true,
        status: 'active',
      },
      branch: { id: 'b1', name: 'HQ Branch', type: 'store', status: 'active' },
      branches: [{ id: 'b1', name: 'HQ Branch', type: 'store', status: 'active' }],
      installedProducts: [
        { id: 'p1', org_id: 'org1', product_key: 'inventory', status: 'active', is_primary: true, created_at: '', updated_at: '' },
      ],
      isLoading: false,
      isEmailVerified: true,
      isEmailUnverified: false,
      hasProduct: vi.fn(),
      can: vi.fn(),
      installApp: vi.fn(),
      uninstallApp: vi.fn(),
      setPrimaryApp: vi.fn(),
      refreshWorkspace: vi.fn(),
    });

    render(
      <BrowserRouter>
        <TenantDashboardPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Inventory Management')).toBeInTheDocument();
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('Apps')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
