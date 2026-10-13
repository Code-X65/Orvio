import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUrlActionState } from './useUrlActionState';

const mockNavigate = vi.fn();
let mockSearch = '';
let mockPathname = '/inventory';

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    search: mockSearch,
    pathname: mockPathname,
  }),
}));

describe('useUrlActionState Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch = '';
    mockPathname = '/inventory';
  });

  it('initializes with null action and null entityId when no query params exist', () => {
    const { result } = renderHook(() => useUrlActionState());
    expect(result.current.activeAction).toBeNull();
    expect(result.current.activeEntityId).toBeNull();
  });

  it('reads action and entityId from location search', () => {
    mockSearch = '?action=create-product&productId=prod_123';
    const { result } = renderHook(() => useUrlActionState());
    expect(result.current.activeAction).toBe('create-product');
    expect(result.current.activeEntityId).toBe('prod_123');
    expect(result.current.isAction('create-product')).toBe(true);
    expect(result.current.isAction('edit-product')).toBe(false);
  });

  it('enforces allowedActions whitelist when configured', () => {
    mockSearch = '?action=unauthorized-action';
    const { result } = renderHook(() =>
      useUrlActionState<'view' | 'edit'>({
        allowedActions: ['view', 'edit'],
      })
    );
    expect(result.current.activeAction).toBeNull();
  });

  it('rejects malicious or invalid entityId formats', () => {
    mockSearch = '?action=edit&productId=prod<script>alert(1)</script>';
    const { result } = renderHook(() => useUrlActionState());
    expect(result.current.activeEntityId).toBeNull();
  });

  it('openAction sanitizes extraParams and excludes prototype pollution keys', () => {
    const { result } = renderHook(() => useUrlActionState());

    act(() => {
      result.current.openAction('create-product', 'prod_456', {
        branch: 'main',
        __proto__: 'polluted',
        constructor: 'exploit',
        tab: 'general',
      } as any);
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const navArg = mockNavigate.mock.calls[0][0];
    expect(navArg.pathname).toBe('/inventory');
    const searchParams = new URLSearchParams(navArg.search);
    expect(searchParams.get('action')).toBe('create-product');
    expect(searchParams.get('productId')).toBe('prod_456');
    expect(searchParams.get('branch')).toBe('main');
    expect(searchParams.get('tab')).toBe('general');
    expect(searchParams.get('__proto__')).toBeNull();
    expect(searchParams.get('constructor')).toBeNull();
  });

  it('closeAction clears action, entityId, and additional configured params', () => {
    mockSearch = '?action=edit&productId=prod_123&branch=main&draft=temp';
    const { result } = renderHook(() =>
      useUrlActionState({
        additionalParamsToClear: ['branch', 'draft'],
      })
    );

    act(() => {
      result.current.closeAction();
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const navArg = mockNavigate.mock.calls[0][0];
    const searchParams = new URLSearchParams(navArg.search);
    expect(searchParams.get('action')).toBeNull();
    expect(searchParams.get('productId')).toBeNull();
    expect(searchParams.get('branch')).toBeNull();
    expect(searchParams.get('draft')).toBeNull();
  });
});
