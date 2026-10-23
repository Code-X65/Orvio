import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWorkspaceCacheKey,
  loadPersistedWorkspace,
  savePersistedWorkspace,
  clearWorkspaceCache,
  type WorkspaceDetailsResponse,
} from './WorkspaceContext';

describe('WorkspaceContext SWR LocalStorage Cache', () => {
  const mockOrgId = 'org-123';
  const mockUserId = 'user-456';

  const mockData: WorkspaceDetailsResponse = {
    user: {
      id: mockUserId,
      email: 'owner@example.com',
      fullName: 'Owner Jane',
      emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    },
    organization: {
      id: mockOrgId,
      name: 'Jane Store',
      subdomain: 'janestore',
      status: 'active',
      timezone: 'UTC',
      currency: 'NGN',
      plan_code: 'standard',
      url: 'https://janestore.orvio.app',
    },
    membership: {
      id: 'mem-1',
      role: 'owner',
      org_role: 'owner',
      status: 'active',
    },
    branch: null,
    branches: [],
    products: [
      {
        id: 'p-1',
        org_id: mockOrgId,
        product_key: 'inventory',
        status: 'active',
        is_primary: true,
        created_at: '',
        updated_at: '',
      },
    ],
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('correctly constructs scoped cache keys', () => {
    expect(getWorkspaceCacheKey(mockOrgId, mockUserId)).toBe(
      `orvio_workspace_cache_${mockOrgId}_${mockUserId}`
    );
    expect(getWorkspaceCacheKey(undefined, mockUserId)).toBeNull();
    expect(getWorkspaceCacheKey(mockOrgId, undefined)).toBeNull();
  });

  it('saves and loads workspace data from localStorage', () => {
    expect(loadPersistedWorkspace(mockOrgId, mockUserId)).toBeNull();

    savePersistedWorkspace(mockOrgId, mockUserId, mockData);

    const loaded = loadPersistedWorkspace(mockOrgId, mockUserId);
    expect(loaded).toEqual(mockData);
    expect(loaded?.products).toHaveLength(1);
    expect(loaded?.products[0].product_key).toBe('inventory');
  });

  it('clears all workspace caches on clearWorkspaceCache()', () => {
    savePersistedWorkspace('org-1', 'user-1', mockData);
    savePersistedWorkspace('org-2', 'user-2', mockData);
    localStorage.setItem('unrelated_key', 'keep_me');

    clearWorkspaceCache();

    expect(loadPersistedWorkspace('org-1', 'user-1')).toBeNull();
    expect(loadPersistedWorkspace('org-2', 'user-2')).toBeNull();
    expect(localStorage.getItem('unrelated_key')).toBe('keep_me');
  });
});
