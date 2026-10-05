import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from './auth-store';

vi.mock('../lib/api/auth', () => ({
  refreshSession: vi.fn(),
}));

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    vi.clearAllMocks();
  });

  it('initializes with anonymous status and null token', () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.organization).toBeNull();
    expect(state.status).toBe('anonymous');
  });

  it('sets authenticated session for verified user', () => {
    const mockUser = {
      id: 'usr_1',
      email: 'alex@example.com',
      fullName: 'Alex Adeleke',
      status: 'active',
      emailVerifiedAt: '2026-09-30T10:00:00Z',
    };
    const mockOrg = {
      id: 'org_1',
      name: 'Adeleke Logistics',
      subdomain: 'adelekelogistics',
      status: 'active',
    };

    useAuthStore.getState().setSession('valid-token-123', mockUser, mockOrg);

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('valid-token-123');
    expect(state.user).toEqual(mockUser);
    expect(state.organization).toEqual(mockOrg);
    expect(state.status).toBe('authenticated');
    expect(state.isHydrated).toBe(true);
  });

  it('sets pending-verification session for unverified user', () => {
    const mockUser = {
      id: 'usr_2',
      email: 'jane@example.com',
      fullName: 'Jane Doe',
      status: 'active',
      emailVerifiedAt: null,
    };
    const mockOrg = {
      id: 'org_2',
      name: 'Jane Fitness',
      subdomain: 'janefitness',
      status: 'pending',
    };

    useAuthStore.getState().setSession('token-abc', mockUser, mockOrg);

    const state = useAuthStore.getState();
    expect(state.status).toBe('pending-verification');
  });

  it('updates in-memory access token via setAccessToken', () => {
    useAuthStore.getState().setAccessToken('new-jwt-token');
    expect(useAuthStore.getState().accessToken).toBe('new-jwt-token');
  });

  it('clears session upon logout / clearSession', () => {
    useAuthStore.getState().setSession(
      'token',
      { id: '1', email: 'test@example.com', fullName: 'Test', status: 'active' },
      { id: '1', name: 'Org', subdomain: 'org', status: 'active' }
    );
    expect(useAuthStore.getState().status).toBe('pending-verification');

    useAuthStore.getState().clearSession();
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.organization).toBeNull();
    expect(state.status).toBe('anonymous');
  });

  it('hydrates session successfully when refreshSession returns valid credentials', async () => {
    localStorage.setItem('orvio_refresh_token', 'valid-refresh-token');
    const { refreshSession } = await import('../lib/api/auth');
    vi.mocked(refreshSession).mockResolvedValueOnce({
      accessToken: 'refreshed-access-token',
      user: {
        id: 'usr_hydrated',
        email: 'hydrated@example.com',
        fullName: 'Hydrated User',
        status: 'active',
        emailVerifiedAt: '2026-09-30T12:00:00Z',
      },
      organization: {
        id: 'org_hydrated',
        name: 'Hydrated Org',
        subdomain: 'hydratedorg',
        status: 'active',
      },
    });

    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('refreshed-access-token');
    expect(state.user?.id).toBe('usr_hydrated');
    expect(state.organization?.subdomain).toBe('hydratedorg');
    expect(state.status).toBe('authenticated');
    expect(state.isHydrated).toBe(true);
  });

  it('resets to anonymous when hydrate fails with error', async () => {
    localStorage.setItem('orvio_refresh_token', 'expired-token');
    const { refreshSession } = await import('../lib/api/auth');
    vi.mocked(refreshSession).mockRejectedValueOnce(new Error('No cookie'));

    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.status).toBe('anonymous');
    expect(state.isHydrated).toBe(true);
  });

  it('does not accept credentials supplied through a URL query string', async () => {
    const handoffData = {
      accessToken: 'handoff-jwt-token',
      user: {
        id: 'usr_handoff',
        email: 'founder@fashben.com',
        fullName: 'Fash Ben',
        status: 'active',
        emailVerifiedAt: null,
      },
      organization: {
        id: 'org_fashben',
        name: 'FashBen Stores',
        subdomain: 'fashben',
        status: 'active',
      },
    };

    const encoded = encodeURIComponent(btoa(JSON.stringify(handoffData)));
    const originalSearch = window.location.search;
    delete (window as any).location;
    (window as any).location = new URL(`http://fashben.localhost:4000/orvio?handoff=${encoded}`);

    const { refreshSession } = await import('../lib/api/auth');
    vi.mocked(refreshSession).mockRejectedValueOnce(new Error('No cookie'));
    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.organization).toBeNull();
    expect(state.status).toBe('anonymous');
    expect(state.isHydrated).toBe(true);

    (window as any).location = new URL(`http://localhost:4000${originalSearch}`);
  });
});
