import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useInventoryOnboarding,
  getCachedOnboardingStatus,
  setCachedOnboardingStatus,
} from './useInventoryOnboarding';
import * as api from '../api';

vi.mock('../api', () => ({
  getInventoryOnboardingStatus: vi.fn(),
}));

describe('useInventoryOnboarding', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );

  it('immediately returns cached onboarding status from storage as initialData', () => {
    const cachedData = {
      completed: true,
      status: 'completed' as const,
      branch: { id: 'br_1', name: 'Main Branch', type: 'retail', status: 'active', is_primary: true },
      branches: [{ id: 'br_1', name: 'Main Branch', type: 'retail', status: 'active' }],
      organization: { id: 'org_1', name: 'Acme', subdomain: 'acme', currency: 'NGN' },
    };

    setCachedOnboardingStatus('org_1', cachedData as any);
    expect(getCachedOnboardingStatus('org_1')).toEqual(cachedData);

    const { result } = renderHook(() => useInventoryOnboarding('org_1'), { wrapper });

    // Initial data is available immediately without blocking
    expect(result.current.data).toEqual(cachedData);
  });

  it('fetches onboarding status in background and updates storage cache', async () => {
    const freshData = {
      completed: true,
      status: 'completed' as const,
      branch: { id: 'br_2', name: 'Branch 2', type: 'warehouse', status: 'active', is_primary: true },
      branches: [{ id: 'br_2', name: 'Branch 2', type: 'warehouse', status: 'active' }],
      organization: { id: 'org_1', name: 'Acme', subdomain: 'acme', currency: 'NGN' },
    };

    vi.mocked(api.getInventoryOnboardingStatus).mockResolvedValueOnce(freshData as any);

    const { result } = renderHook(() => useInventoryOnboarding('org_1'), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(freshData);
    });

    expect(getCachedOnboardingStatus('org_1')).toEqual(freshData);
  });
});
