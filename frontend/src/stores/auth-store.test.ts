import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from './auth-store';

vi.mock('../lib/api/auth', () => ({
  refreshSession: vi.fn(),
  exchangeHandoffTicket: vi.fn(),
  createHandoffTicket: vi.fn(),
  getCurrentUser: vi.fn(),
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
    const { refreshSession } = await import('../lib/api/auth');
    vi.mocked(refreshSession).mockRejectedValueOnce(new Error('No cookie'));

    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.status).toBe('anonymous');
    expect(state.isHydrated).toBe(true);
  });

  it('hydrates session successfully via single-use ticket exchange and cleans URL', async () => {
    const originalSearch = window.location.search;
    delete (window as any).location;
    (window as any).location = new URL('http://fashben.localhost:4000/orvio?ticket=ht_valid_handoff_ticket_123');

    const { exchangeHandoffTicket } = await import('../lib/api/auth');
    vi.mocked(exchangeHandoffTicket).mockResolvedValueOnce({
      accessToken: 'exchanged-access-token',
      user: {
        id: 'usr_ticket',
        email: 'ticket@example.com',
        fullName: 'Ticket User',
        status: 'active',
        emailVerifiedAt: '2026-09-30T12:00:00Z',
      },
      organization: {
        id: 'org_ticket',
        name: 'Ticket Org',
        subdomain: 'fashben',
        status: 'active',
      },
    });

    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('exchanged-access-token');
    expect(state.user?.id).toBe('usr_ticket');
    expect(state.organization?.subdomain).toBe('fashben');
    expect(state.status).toBe('authenticated');
    expect(state.isHydrated).toBe(true);

    (window as any).location = new URL(`http://localhost:4000${originalSearch}`);
  });

  it('does not accept raw token credentials supplied through a URL query string', async () => {
    const originalSearch = window.location.search;
    delete (window as any).location;
    (window as any).location = new URL('http://fashben.localhost:4000/orvio?token=raw-jwt-attempt&sessionToken=raw-session-jwt');

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

  it('preserves form drafts when clearSession is called with preserveDrafts = true', () => {
    sessionStorage.setItem('orvio_draft_product', JSON.stringify({ name: 'Sneakers' }));
    sessionStorage.setItem('orvio_session_state', 'some_state');

    useAuthStore.getState().clearSession(false, true);

    expect(sessionStorage.getItem('orvio_draft_product')).toBe(JSON.stringify({ name: 'Sneakers' }));
    expect(sessionStorage.getItem('orvio_session_state')).toBeNull();
  });

  it('clears form drafts when clearSession is called with preserveDrafts = false (default)', () => {
    sessionStorage.setItem('orvio_draft_product', JSON.stringify({ name: 'Sneakers' }));

    useAuthStore.getState().clearSession(false, false);

    expect(sessionStorage.getItem('orvio_draft_product')).toBeNull();
  });

  it('handles REFRESH_EXPIRED in hydrate by dispatching event, saving redirect and preserving drafts', async () => {
    sessionStorage.setItem('orvio_draft_category', JSON.stringify({ name: 'Shoes' }));
    const eventSpy = vi.fn();
    window.addEventListener('orvio:auth:session-expired', eventSpy);

    const { refreshSession } = await import('../lib/api/auth');
    const { AuthError } = await import('../lib/api/error-types');
    vi.mocked(refreshSession).mockRejectedValueOnce(
      new AuthError('Your session has expired. Please sign in again.', 'REFRESH_EXPIRED', 401)
    );

    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.status).toBe('anonymous');

    // Event was dispatched
    expect(eventSpy).toHaveBeenCalledTimes(1);

    // Redirect path was saved in sessionStorage
    expect(sessionStorage.getItem('orvio_redirect_after_login')).toBeDefined();

    // Draft was preserved
    expect(sessionStorage.getItem('orvio_draft_category')).toBe(JSON.stringify({ name: 'Shoes' }));

    window.removeEventListener('orvio:auth:session-expired', eventSpy);
  });

  it('discards expired tokens found in sessionStorage and does not restore them', async () => {
    // Construct expired JWT (exp in the past)
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ sub: 'user_1', exp: Math.floor(Date.now() / 1000) - 3600 }));
    const expiredJwt = `${header}.${payload}.signature`;

    sessionStorage.setItem(
      'orvio_session_state',
      JSON.stringify({
        accessToken: expiredJwt,
        user: { id: 'usr_1', email: 'test@example.com', fullName: 'Test', status: 'active' },
        organization: { id: 'org_1', name: 'Test Org', subdomain: 'testorg', status: 'active' },
        status: 'authenticated',
      })
    );

    const { refreshSession } = await import('../lib/api/auth');
    vi.mocked(refreshSession).mockRejectedValueOnce(new Error('No cookie'));

    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    // Must NOT restore the expired token
    expect(state.accessToken).toBeNull();
    expect(state.status).toBe('anonymous');
    // Stale item removed from sessionStorage
    expect(sessionStorage.getItem('orvio_session_state')).toBeNull();
  });

  it('checkIdleTimeout expires session and dispatches event when inactive for >60min', () => {
    const eventSpy = vi.fn();
    window.addEventListener('orvio:auth:session-expired', eventSpy);

    useAuthStore.getState().setSession(
      'active-token',
      { id: 'usr_1', email: 'test@example.com', fullName: 'Test', status: 'active' },
      { id: 'org_1', name: 'Test Org', subdomain: 'testorg', status: 'active' }
    );

    // Set last activity to 70 minutes ago
    useAuthStore.setState({ lastActivityAt: Date.now() - 70 * 60 * 1000 });

    const timedOut = useAuthStore.getState().checkIdleTimeout(60 * 60 * 1000);

    expect(timedOut).toBe(true);
    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(eventSpy).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('orvio_redirect_after_login')).toBeDefined();

    window.removeEventListener('orvio:auth:session-expired', eventSpy);
  });

  it('persists session to localStorage upon setSession and restores on hydrate', async () => {
    // Generate a valid future JWT (exp in 1 hour)
    const futureExpSec = Math.floor(Date.now() / 1000) + 3600;
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ sub: 'usr_valid', exp: futureExpSec }));
    const validJwt = `${header}.${payload}.sig`;

    const mockUser = { id: 'usr_1', email: 'test@example.com', fullName: 'Test', status: 'active', emailVerifiedAt: '2026-01-01' };
    const mockOrg = { id: 'org_1', name: 'Test Org', subdomain: 'testorg', status: 'active' };

    useAuthStore.getState().setSession(validJwt, mockUser, mockOrg);

    const stored = localStorage.getItem('orvio_auth_session');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).accessToken).toBe(validJwt);

    // Clear in-memory state as if page reloaded
    useAuthStore.setState({ accessToken: null, user: null, organization: null, status: 'anonymous', isHydrated: false });

    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe(validJwt);
    expect(state.status).toBe('authenticated');
    expect(state.user).toEqual(mockUser);
  });

  it('syncs logout across tabs when localStorage is cleared in another tab', () => {
    useAuthStore.getState().setSession(
      'active-token',
      { id: 'usr_1', email: 'test@example.com', fullName: 'Test', status: 'active', emailVerifiedAt: '2026-01-01' },
      { id: 'org_1', name: 'Test Org', subdomain: 'testorg', status: 'active' }
    );
    expect(useAuthStore.getState().status).toBe('authenticated');

    // Simulate storage event from another tab
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'orvio_auth_session',
        oldValue: 'some-data',
        newValue: null,
      })
    );

    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

