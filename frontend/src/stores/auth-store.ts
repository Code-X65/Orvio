import { create } from 'zustand';
import { isJwtValid } from '../lib/api/token-utils';

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
  lastActivityAt: number | null;
  recordActivity: () => void;
  checkIdleTimeout: (maxIdleMs?: number) => boolean;
  setSession: (accessToken: string, user: AuthUser, organization: AuthOrganization, status?: AuthStatus, fromSync?: boolean) => void;
  setAccessToken: (accessToken: string, fromSync?: boolean) => void;
  clearSession: (fromSync?: boolean, preserveDrafts?: boolean) => void;
  hydrate: (force?: boolean) => Promise<void>;
}

let inFlightHydrationPromise: Promise<void> | null = null;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('orvio_auth_mesh') : null;

export const AUTH_STORAGE_KEY = 'orvio_auth_session';

function loadPersistedSession(): {
  accessToken: string | null;
  user: AuthUser | null;
  organization: AuthOrganization | null;
  status: AuthStatus;
  isHydrated: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      accessToken: null,
      user: null,
      organization: null,
      status: 'anonymous',
      isHydrated: false,
    };
  }
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.accessToken && isJwtValid(parsed.accessToken) && parsed.user && parsed.organization) {
        return {
          accessToken: parsed.accessToken,
          user: parsed.user,
          organization: parsed.organization,
          status: parsed.status || (parsed.user.emailVerifiedAt ? 'authenticated' : 'pending-verification'),
          isHydrated: true,
        };
      }
    }
  } catch {
    // Ignore parse errors
  }
  return {
    accessToken: null,
    user: null,
    organization: null,
    status: 'anonymous',
    isHydrated: false,
  };
}

// Multi-tab sync via window storage events
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === AUTH_STORAGE_KEY) {
      if (!event.newValue) {
        useAuthStore.getState().clearSession(true);
      } else {
        try {
          const parsed = JSON.parse(event.newValue);
          if (parsed.accessToken && isJwtValid(parsed.accessToken) && parsed.user && parsed.organization) {
            useAuthStore.getState().setSession(
              parsed.accessToken,
              parsed.user,
              parsed.organization,
              parsed.status,
              true
            );
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  });
}

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

const initialPersisted = loadPersistedSession();

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: initialPersisted.accessToken,
  user: initialPersisted.user,
  organization: initialPersisted.organization,
  status: initialPersisted.status,
  isHydrated: initialPersisted.isHydrated,
  lastActivityAt: typeof window !== 'undefined' ? Date.now() : null,

  recordActivity: () => {
    set({ lastActivityAt: Date.now() });
  },

  checkIdleTimeout: (maxIdleMs = 3 * 60 * 60 * 1000) => {
    const last = get().lastActivityAt;
    const currentStatus = get().status;
    if (!last || (currentStatus !== 'authenticated' && currentStatus !== 'pending-verification')) return false;
    const idleTime = Date.now() - last;
    if (idleTime > maxIdleMs) {
      const currentPath =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '/';
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('orvio_redirect_after_login', currentPath);
        window.dispatchEvent(
          new CustomEvent('orvio:auth:session-expired', {
            detail: { redirectPath: currentPath, reason: 'IDLE_TIMEOUT' },
          })
        );
      }
      get().clearSession(false, true); // preserve drafts
      return true;
    }
    return false;
  },

  setSession: (accessToken, user, organization, customStatus, fromSync = false) => {
    const finalStatus = customStatus ?? (user.emailVerifiedAt ? 'authenticated' : 'pending-verification');
    set({
      accessToken,
      user,
      organization,
      status: finalStatus,
      isHydrated: true,
      lastActivityAt: Date.now(),
    });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({ accessToken, user, organization, status: finalStatus })
        );
        sessionStorage.setItem(
          'orvio_session_state',
          JSON.stringify({ user, organization, status: finalStatus })
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
    set({ accessToken, lastActivityAt: Date.now() });
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          parsed.accessToken = accessToken;
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
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

  clearSession: (fromSync = false, preserveDrafts = false) => {
    if (!preserveDrafts && typeof window !== 'undefined') {
      try {
        Object.keys(sessionStorage).forEach((key) => {
          if (key.startsWith('orvio_draft_')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch {
        // Ignore storage errors
      }
    }
    set({
      accessToken: null,
      user: null,
      organization: null,
      status: 'anonymous',
      isHydrated: true,
      lastActivityAt: null,
    });
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
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

  hydrate: (force = false) => {
    const currentToken = get().accessToken;
    if (!force && get().isHydrated && currentToken && isJwtValid(currentToken)) {
      return Promise.resolve();
    }
    if (inFlightHydrationPromise) return inFlightHydrationPromise;

    inFlightHydrationPromise = (async () => {
      try {
        // 1. Check for cross-subdomain single-use handoff ticket (RFC 9700 §2.1.3 compliant)
        if (typeof window !== 'undefined') {
          const searchParams = new URLSearchParams(window.location.search);
          const handoffTicket = searchParams.get('ticket');

          // Immediately scrub ticket and any legacy token parameters from the URL bar and history
          if (searchParams.has('token') || searchParams.has('sessionToken') || searchParams.has('ticket')) {
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('ticket');
            cleanUrl.searchParams.delete('token');
            cleanUrl.searchParams.delete('sessionToken');
            window.history.replaceState({}, document.title, cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : ''));
          }

          if (handoffTicket) {
            try {
              const { exchangeHandoffTicket } = await import('../lib/api/auth');
              const res = await exchangeHandoffTicket(handoffTicket);
              if (res.accessToken && res.user && res.organization) {
                get().setSession(
                  res.accessToken,
                  res.user,
                  res.organization,
                  res.user.emailVerifiedAt ? 'authenticated' : 'pending-verification'
                );
                return;
              }
            } catch {
              // Fall through to local storage or cookie refresh
            }
          }
        }

        // 2. Synchronous check of localStorage persisted session
        if (typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem(AUTH_STORAGE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed.accessToken && isJwtValid(parsed.accessToken) && parsed.user && parsed.organization) {
                const finalStatus = parsed.status || (parsed.user.emailVerifiedAt ? 'authenticated' : 'pending-verification');
                set({
                  accessToken: parsed.accessToken,
                  user: parsed.user,
                  organization: parsed.organization,
                  status: finalStatus,
                  isHydrated: true,
                  lastActivityAt: Date.now(),
                });
                // If token has plenty of life left (> 2 minutes), no immediate blocking network refresh needed
                if (isJwtValid(parsed.accessToken, 120_000)) {
                  return;
                }
              }
            }
          } catch {
            // Ignore parse errors
          }
        }

        // If we still have no valid token in memory, indicate authenticating
        if (!get().accessToken) {
          set({ status: 'authenticating' });
        }

        // 3. Background refresh via HttpOnly cookie
        const { refreshSession } = await import('../lib/api/auth');
        const { AuthError } = await import('../lib/api/error-types');
        const { ApiError } = await import('../lib/api/client');

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
        } catch (err: unknown) {
          const authError =
            err instanceof AuthError
              ? err
              : err instanceof ApiError
              ? AuthError.fromApiError(err)
              : null;

          const storedToken = get().accessToken;
          const isStoredTokenStillValid = storedToken ? isJwtValid(storedToken) : false;

          if (authError && authError.code === 'REFRESH_EXPIRED') {
            if (!isStoredTokenStillValid) {
              const currentPath =
                typeof window !== 'undefined'
                  ? window.location.pathname + window.location.search
                  : '/';
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('orvio_redirect_after_login', currentPath);
                window.dispatchEvent(
                  new CustomEvent('orvio:auth:session-expired', {
                    detail: { redirectPath: currentPath },
                  })
                );
              }
              get().clearSession(false, true); // preserveDrafts = true
            }
          } else if (authError && (authError.code === 'NETWORK_ERROR' || authError.status === 0)) {
            // Network drop / offline: keep user logged in if token or local session state exists
            if (!isStoredTokenStillValid && !get().accessToken) {
              get().clearSession();
            }
          } else {
            if (!isStoredTokenStillValid && !get().accessToken) {
              get().clearSession();
            }
          }
        }
      } catch {
        const storedToken = get().accessToken;
        if (!storedToken || !isJwtValid(storedToken)) {
          get().clearSession();
        }
      } finally {
        set({ isHydrated: true });
        inFlightHydrationPromise = null;
      }
    })();
    return inFlightHydrationPromise;
  },
}));
