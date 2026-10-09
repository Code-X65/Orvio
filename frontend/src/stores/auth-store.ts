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

export type AuthSyncMessage =
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_LOGIN'; payload: { accessToken: string; user: AuthUser; organization: AuthOrganization; status: AuthStatus } }
  | { type: 'TOKEN_REFRESHED'; payload: { accessToken: string } }
  | { type: 'USER_UPDATED'; payload: { user: AuthUser } }
  | { type: 'EMAIL_VERIFIED'; payload?: { emailVerifiedAt?: string } };

export interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  organization: AuthOrganization | null;
  status: AuthStatus;
  isHydrated: boolean;
  setSession: (accessToken: string, user: AuthUser, organization: AuthOrganization, status?: AuthStatus, fromSync?: boolean) => void;
  setAccessToken: (accessToken: string, fromSync?: boolean) => void;
  clearSession: (fromSync?: boolean) => void;
  hydrate: () => Promise<void>;
}

let inFlightHydrationPromise: Promise<void> | null = null;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('orvio_auth_mesh') : null;

channel?.addEventListener('message', (event: MessageEvent<AuthSyncMessage | string>) => {
  const data = event.data;
  if (!data) return;

  if (data === 'logout' || (typeof data === 'object' && data.type === 'AUTH_LOGOUT')) {
    useAuthStore.getState().clearSession(true);
  } else if (typeof data === 'object') {
    if (data.type === 'AUTH_LOGIN' && data.payload) {
      useAuthStore.getState().setSession(
        data.payload.accessToken,
        data.payload.user,
        data.payload.organization,
        data.payload.status,
        true
      );
    } else if (data.type === 'TOKEN_REFRESHED' && data.payload?.accessToken) {
      useAuthStore.getState().setAccessToken(data.payload.accessToken, true);
    } else if (data.type === 'EMAIL_VERIFIED') {
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.setState({
          user: { ...currentUser, emailVerifiedAt: data.payload?.emailVerifiedAt ?? new Date().toISOString() },
          status: 'authenticated',
        });
      }
    }
  }
});

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  organization: null,
  status: 'anonymous',
  isHydrated: false,

  setSession: (accessToken, user, organization, customStatus, fromSync = false) => {
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
    if (!fromSync && channel) {
      try {
        channel.postMessage({
          type: 'AUTH_LOGIN',
          payload: { accessToken, user, organization, status: finalStatus },
        });
      } catch {
        // Ignore broadcast errors
      }
    }
  },

  setAccessToken: (accessToken, fromSync = false) => {
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
    if (!fromSync && channel) {
      try {
        channel.postMessage({
          type: 'TOKEN_REFRESHED',
          payload: { accessToken },
        });
      } catch {
        // Ignore broadcast errors
      }
    }
  },

  clearSession: (fromSync = false) => {
    set({ accessToken: null, user: null, organization: null, status: 'anonymous', isHydrated: true });
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('orvio_session_state');
      } catch {
        // Ignore storage errors
      }
    }
    if (!fromSync && channel) {
      try {
        channel.postMessage({ type: 'AUTH_LOGOUT' });
      } catch {
        // Ignore broadcast errors
      }
    }
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
        try {
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
          // If we already hold an in-memory access token (e.g. the user just
          // verified their email and the page rehydrates), keep it. Never
          // downgrade an authenticated session to pending-verification.
        } catch {
          if (!get().accessToken) {
            get().clearSession();
          }
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
