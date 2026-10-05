import { create } from 'zustand';
import { getSecureItem, saveSecureItem, deleteSecureItem, StorageKeys } from '../lib/storage/secure-store';

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
  activeSubdomain: string | null;
  status: AuthStatus;
  isHydrated: boolean;

  setSubdomain: (subdomain: string | null) => Promise<void>;
  setSession: (
    accessToken: string,
    user: AuthUser,
    organization: AuthOrganization,
    status?: AuthStatus,
  ) => Promise<void>;
  setAccessToken: (accessToken: string) => Promise<void>;
  clearSession: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  organization: null,
  activeSubdomain: null,
  status: 'anonymous',
  isHydrated: false,

  setSubdomain: async (subdomain: string | null) => {
    if (subdomain) {
      await saveSecureItem(StorageKeys.ACTIVE_SUBDOMAIN, subdomain);
    } else {
      await deleteSecureItem(StorageKeys.ACTIVE_SUBDOMAIN);
    }
    set({ activeSubdomain: subdomain });
  },

  setSession: async (accessToken, user, organization, customStatus) => {
    const status: AuthStatus =
      customStatus ??
      (user.emailVerifiedAt ? 'authenticated' : 'pending-verification');

    await saveSecureItem(
      StorageKeys.USER_SESSION,
      JSON.stringify({ accessToken, user, organization, status })
    );

    if (organization?.subdomain) {
      await saveSecureItem(StorageKeys.ACTIVE_SUBDOMAIN, organization.subdomain);
    }

    set({
      accessToken,
      user,
      organization,
      activeSubdomain: organization?.subdomain || get().activeSubdomain,
      status,
      isHydrated: true,
    });
  },

  setAccessToken: async (accessToken: string) => {
    const stored = await getSecureItem(StorageKeys.USER_SESSION);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        await saveSecureItem(StorageKeys.USER_SESSION, JSON.stringify({ ...parsed, accessToken }));
      } catch {
        // Ignored
      }
    }
    set({ accessToken });
  },

  clearSession: async () => {
    await deleteSecureItem(StorageKeys.USER_SESSION);
    await deleteSecureItem(StorageKeys.REFRESH_TOKEN);

    set({
      accessToken: null,
      user: null,
      organization: null,
      status: 'anonymous',
      isHydrated: true,
    });
  },

  hydrate: async () => {
    try {
      // Purge refresh credentials persisted by older app releases.
      await deleteSecureItem(StorageKeys.REFRESH_TOKEN);
      const storedSubdomain = await getSecureItem(StorageKeys.ACTIVE_SUBDOMAIN);
      const rawSession = await getSecureItem(StorageKeys.USER_SESSION);

      let storedSession: { accessToken: string; user: AuthUser; organization: AuthOrganization; status: AuthStatus } | null = null;
      if (rawSession) {
        storedSession = JSON.parse(rawSession);
      }

      if (storedSubdomain) {
        set({ activeSubdomain: storedSubdomain });
      }

      if (!storedSession?.accessToken) {
        set({ status: 'anonymous', isHydrated: true });
        return;
      }

      if (storedSession && storedSession.user && storedSession.organization) {
        set({
          accessToken: storedSession.accessToken,
          user: storedSession.user,
          organization: storedSession.organization,
          activeSubdomain: storedSession.organization.subdomain || storedSubdomain,
          status: storedSession.status,
          isHydrated: true,
        });
      }

      if (storedSession?.accessToken) {
        const { refreshSession } = await import('../lib/api/auth');
        const response = await refreshSession();

        if (response && response.accessToken && response.user && response.organization) {
          await get().setSession(
            response.accessToken,
            response.user,
            response.organization,
            response.user.emailVerifiedAt ? 'authenticated' : 'pending-verification'
          );
        } else {
          await get().clearSession();
        }
      }
    } catch {
      await get().clearSession();
    } finally {
      set({ isHydrated: true });
    }
  },
}));
