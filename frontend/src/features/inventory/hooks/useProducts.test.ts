import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useProducts } from './useProducts';
import { productApi } from '../products-api';

vi.mock('../products-api', () => ({
  productApi: {
    listProducts: vi.fn(),
  },
}));

describe('useProducts Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );

  it('fetches products with given params and returns pagination data', async () => {
    const mockResponse = {
      products: [
        { id: 'p-1', name: 'Sample Item', sku: 'SMPL-1', selling_price: 1500 },
      ],
      pagination: {
        total: 1,
        page: 1,
        limit: 15,
        totalPages: 1,
      },
    };

    (productApi.listProducts as any).mockResolvedValue(mockResponse);

    const { result } = renderHook(
      () => useProducts({ page: 1, limit: 15, status: 'active' }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(productApi.listProducts).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 15, status: 'active' })
    );
    expect(result.current.data?.products).toEqual(mockResponse.products);
    expect(result.current.data?.pagination.total).toBe(1);
  });
});
