import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RbacRouteGuard } from './RbacRouteGuard';
import { useAuthStore } from '../../stores/auth-store';
import { toast } from 'sonner';
import { signAccessToken } from '../../../../backend/src/lib/tokens'; // Or mock token

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

// Helper to create a base64url-encoded JWT token string for unit testing
function createMockJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mocksignature`;
}

describe('RbacRouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows access when user is organization Owner', () => {
    const token = createMockJwt({
      sub: 'u-owner',
      role: 'owner',
      org_role: 'owner',
      scope_all_branches: true,
      app_access: ['inventory', 'pos'],
    });

    useAuthStore.setState({ accessToken: token });

    render(
      <MemoryRouter initialEntries={['/admin-only']}>
        <Routes>
          <Route
            path="/admin-only"
            element={
              <RbacRouteGuard requireRole={['owner', 'manager']}>
                <div>Protected Admin Page</div>
              </RbacRouteGuard>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Admin Page')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('redirects subordinate staff (Storekeeper) away from administrative route with error toast', () => {
    const token = createMockJwt({
      sub: 'u-storekeeper',
      role: 'member',
      org_role: 'storekeeper',
      scope_all_branches: false,
      branch_scope: ['branch-1'],
      app_access: ['inventory'],
    });

    useAuthStore.setState({ accessToken: token });

    render(
      <MemoryRouter initialEntries={['/admin-only']}>
        <Routes>
          <Route
            path="/admin-only"
            element={
              <RbacRouteGuard requireRole={['owner', 'manager']}>
                <div>Protected Admin Page</div>
              </RbacRouteGuard>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Should redirect to /dashboard
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Admin Page')).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      'Access Denied',
      expect.objectContaining({
        description: expect.stringContaining('administrative permission'),
      })
    );
  });

  it('blocks staff from accessing an application not in their app_access', () => {
    const token = createMockJwt({
      sub: 'u-storekeeper',
      role: 'member',
      org_role: 'storekeeper',
      scope_all_branches: false,
      branch_scope: ['branch-1'],
      app_access: ['pos'], // Only has POS, not Inventory
    });

    useAuthStore.setState({ accessToken: token });

    render(
      <MemoryRouter initialEntries={['/inventory']}>
        <Routes>
          <Route
            path="/inventory"
            element={
              <RbacRouteGuard requireApp="inventory">
                <div>Inventory App Workspace</div>
              </RbacRouteGuard>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    expect(screen.queryByText('Inventory App Workspace')).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      'Application Restricted',
      expect.objectContaining({
        description: expect.stringContaining('inventory'),
      })
    );
  });

  it('allows staff with matching app_access to enter the application workspace', () => {
    const token = createMockJwt({
      sub: 'u-storekeeper',
      role: 'member',
      org_role: 'storekeeper',
      scope_all_branches: false,
      branch_scope: ['branch-1'],
      app_access: ['inventory'],
    });

    useAuthStore.setState({ accessToken: token });

    render(
      <MemoryRouter initialEntries={['/inventory']}>
        <Routes>
          <Route
            path="/inventory"
            element={
              <RbacRouteGuard requireApp="inventory">
                <div>Inventory App Workspace</div>
              </RbacRouteGuard>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Inventory App Workspace')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
