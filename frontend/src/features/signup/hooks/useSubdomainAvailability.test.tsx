import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubdomainAvailability } from './useSubdomainAvailability';
import * as authApi from '../../../lib/api/auth';

vi.mock('../../../lib/api/auth', () => ({
  checkSubdomain: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSubdomainAvailability Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial null state for empty input', () => {
    const { result } = renderHook(() => useSubdomainAvailability(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isAvailable).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.suggestions).toEqual([]);
  });

  it('returns false immediately for invalid format without calling API', () => {
    const { result } = renderHook(() => useSubdomainAvailability('ab'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isAvailable).toBe(false);
    expect(result.current.reason).toBe('TOO_SHORT');
    expect(authApi.checkSubdomain).not.toHaveBeenCalled();
  });

  it('returns false immediately for reserved word without calling API', () => {
    const { result } = renderHook(() => useSubdomainAvailability('admin'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isAvailable).toBe(false);
    expect(result.current.reason).toBe('RESERVED');
    expect(authApi.checkSubdomain).not.toHaveBeenCalled();
  });

  it('queries API after debounce and resolves available: true', async () => {
    vi.mocked(authApi.checkSubdomain).mockResolvedValueOnce({
      available: true,
      subdomain: 'uniqueshop',
    });

    const { result } = renderHook(() => useSubdomainAvailability('uniqueshop'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isAvailable).toBe(true);
    });

    expect(authApi.checkSubdomain).toHaveBeenCalledWith('uniqueshop', expect.anything());
  });

  it('queries API and returns taken status with suggestions', async () => {
    vi.mocked(authApi.checkSubdomain).mockResolvedValueOnce({
      available: false,
      subdomain: 'takenshop',
      reason: 'ALREADY_TAKEN',
      suggestions: ['takenshop1', 'takenshop2'],
    });

    const { result } = renderHook(() => useSubdomainAvailability('takenshop'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isAvailable).toBe(false);
    });

    expect(result.current.reason).toBe('ALREADY_TAKEN');
    expect(result.current.suggestions).toEqual(['takenshop1', 'takenshop2']);
  });
});
