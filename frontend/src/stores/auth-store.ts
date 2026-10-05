import { create } from 'zustand';

export type AuthStatus = 'anonymous' | 'authenticating' | 'authenticated' | 'pending-verification';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  status: string;
  emailVerifiedAt?: string | null;
}

export interface AuthOrganization {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  planCode?: string | null;
  timezone?: string;
  currency?: string;
  url?: string;
}

export interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  organization: AuthOrganization | null;
  status: AuthStatus;
  isHydrated: boolean;
  setSession: (accessToken: string, user: AuthUser, organization: AuthOrganization, status?: AuthStatus) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  hydrate: () => Promise<void>;
}

let inFlightHydrationPromise: Promise<void> | null = null;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('orvio-auth') : null;

channel?.addEventListener('message', (event: MessageEvent<'logout'>) => {
  if (event.data === 'logout') {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      organization: null,
      status: 'anonymous',
      isHydrated: true,
    });
  }
});

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  organization: null,
  status: 'anonymous',
  isHydrated: false,

  setSession: (accessToken, user, organization, customStatus) => {
    const finalStatus = customStatus ?? (user.emailVerifiedAt ? 'authenticated' : 'pending-verification');
    set({
      accessToken,
      user,
      organization,
      status: finalStatus,
      isHydrated: true,
    });
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(
          'orvio_session_state',
          JSON.stringify({ accessToken, user, organization, status: finalStatus })
        );
      } catch {
        // Ignore storage errors
      }
    }
  },

  setAccessToken: (accessToken) => {
    set({ accessToken });
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('orvio_session_state');
        if (stored) {
          const parsed = JSON.parse(stored);
          sessionStorage.setItem('orvio_session_state', JSON.stringify({ ...parsed, accessToken }));
        }
      } catch {
        // Ignore storage errors
      }
    }
  },

  clearSession: () => {
    set({ accessToken: null, user: null, organization: null, status: 'anonymous', isHydrated: true });
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('orvio_session_state');
      } catch {
        // Ignore storage errors
      }
    }
    channel?.postMessage('logout');
  },

  hydrate: () => {
    if (get().isHydrated && get().status !== 'anonymous') return Promise.resolve();
    if (inFlightHydrationPromise) return inFlightHydrationPromise;

    inFlightHydrationPromise = (async () => {
      set({ status: 'authenticating' });
      try {
        // 1. Check for cross-subdomain URL token handoff
        if (typeof window !== 'undefined') {
          const searchParams = new URLSearchParams(window.location.search);
          const handoffToken = searchParams.get('token') || searchParams.get('sessionToken');
          if (handoffToken) {
            try {
              const { getCurrentUser } = await import('../lib/api/auth');
              const meResponse = await getCurrentUser(handoffToken);
              if (meResponse.user && meResponse.organization) {
                const cleanUrl = new URL(window.location.href);
                cleanUrl.searchParams.delete('token');
                cleanUrl.searchParams.delete('sessionToken');
                window.history.replaceState({}, document.title, cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : ''));

                get().setSession(
                  handoffToken,
                  meResponse.user,
                  meResponse.organization,
                  meResponse.user.emailVerifiedAt ? 'authenticated' : 'pending-verification'
                );
                return;
              }
            } catch {
              // Fall through to session storage or cookie refresh
            }
          }
        }

        // 2. Check tab session storage for active session
        if (typeof window !== 'undefined') {
          try {
            const stored = sessionStorage.getItem('orvio_session_state');
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed.accessToken && parsed.user && parsed.organization) {
                get().setSession(parsed.accessToken, parsed.user, parsed.organization, parsed.status);
              }
            }
          } catch {
            // Ignore storage parse errors
          }
        }

        // 3. Background refresh via HttpOnly cookie
        const { refreshSession } = await import('../lib/api/auth');
        const response = await refreshSession();
        if (response.accessToken && response.user && response.organization) {
          get().setSession(
            response.accessToken,
            response.user,
            response.organization,
            response.user.emailVerifiedAt ? 'authenticated' : 'pending-verification'
          );
        } else if (!get().accessToken) {
          get().clearSession();
        }
      } catch {
        if (!get().accessToken) {
          get().clearSession();
        }
      } finally {
        inFlightHydrationPromise = null;
      }
    })();
    return inFlightHydrationPromise;
  },
}));
