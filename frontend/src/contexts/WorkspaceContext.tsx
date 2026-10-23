import * as React from 'react';
import { useAuthStore, type AuthUser, type AuthOrganization } from '../stores/auth-store';
import {
  fetchWorkspaceDetails,
  installWorkspaceProduct,
  uninstallWorkspaceProduct,
  setPrimaryWorkspaceProduct,
  type WorkspaceProductItem,
  type WorkspaceDetailsResponse,
} from '../features/apps/api';

export type { WorkspaceDetailsResponse, WorkspaceProductItem };
import { getCurrentUser } from '../lib/api/auth';
import { ApiError } from '../lib/api/client';
import { toast } from 'sonner';

export interface WorkspaceContextValue {
  user: AuthUser | null;
  organization: AuthOrganization | null;
  membership: {
    id: string;
    role: string;
    org_role?: string;
    scope_all_branches?: boolean;
    app_access?: string[];
    status: string;
  } | null;
  branch: { id: string; name: string; type: string; status: string } | null;
  branches: Array<{ id: string; name: string; type: string; status: string }>;
  installedProducts: WorkspaceProductItem[];
  isLoading: boolean;
  isEmailVerified: boolean;
  isEmailUnverified: boolean;
  hasProduct: (productKey: string) => boolean;
  can: (permission: string) => boolean;
  installApp: (productKey: string) => Promise<void>;
  uninstallApp: (productKey: string) => Promise<void>;
  setPrimaryApp: (productKey: string) => Promise<void>;
  refreshWorkspace: () => Promise<void>;
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

const AUTH_BROADCAST_CHANNEL = 'orvio_workspace_sync';
export const WORKSPACE_CACHE_PREFIX = 'orvio_workspace_cache_';

export function getWorkspaceCacheKey(orgId?: string, userId?: string): string | null {
  if (!orgId || !userId) return null;
  return `${WORKSPACE_CACHE_PREFIX}${orgId}_${userId}`;
}

export function loadPersistedWorkspace(orgId?: string, userId?: string): WorkspaceDetailsResponse | null {
  if (typeof window === 'undefined') return null;
  const key = getWorkspaceCacheKey(orgId, userId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

export function savePersistedWorkspace(
  orgId?: string,
  userId?: string,
  data?: WorkspaceDetailsResponse | null
) {
  if (typeof window === 'undefined') return;
  const key = getWorkspaceCacheKey(orgId, userId);
  if (!key) return;
  try {
    if (data) {
      localStorage.setItem(key, JSON.stringify(data));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage quota error
  }
}

export function clearWorkspaceCache() {
  if (typeof window === 'undefined') return;
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith(WORKSPACE_CACHE_PREFIX)) {
        localStorage.removeItem(k);
      }
    });
  } catch {
    // Ignore storage error
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, organization, isHydrated, setSession, accessToken } = useAuthStore();

  const cachedData = React.useMemo(() => {
    return loadPersistedWorkspace(organization?.id, user?.id);
  }, [organization?.id, user?.id]);

  const [workspaceData, setWorkspaceData] = React.useState<WorkspaceDetailsResponse | null>(() => cachedData);
  const [installedProducts, setInstalledProducts] = React.useState<WorkspaceProductItem[]>(
    () => (cachedData?.products && cachedData.products.length > 0 ? cachedData.products : [])
  );
  const [isLoading, setIsLoading] = React.useState(() => !cachedData);

  // Broadcast channel instance for instant real-time multi-tab synchronization
  const broadcastChannelRef = React.useRef<BroadcastChannel | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
      broadcastChannelRef.current = channel;

      channel.onmessage = (event: MessageEvent) => {
        if (event.data?.type === 'EMAIL_VERIFIED') {
          // Immediately sync user verification across all tabs
          loadWorkspace(true);
        } else if (event.data?.type === 'PRODUCTS_UPDATED' && Array.isArray(event.data.products)) {
          setInstalledProducts(event.data.products);
          setWorkspaceData((prev) => {
            if (!prev) return prev;
            const updatedData = { ...prev, products: event.data.products };
            savePersistedWorkspace(organization?.id, user?.id, updatedData);
            return updatedData;
          });
        }
      };

      return () => {
        channel.close();
      };
    }
  }, [organization?.id, user?.id]);

  // If auth store hydrates and provides user/org after mount, check cache if state is still empty
  React.useEffect(() => {
    if (!isHydrated) return;
    if (!workspaceData && organization?.id && user?.id) {
      const persisted = loadPersistedWorkspace(organization.id, user.id);
      if (persisted) {
        setWorkspaceData(persisted);
        if (persisted.products && persisted.products.length > 0) {
          setInstalledProducts(persisted.products);
        }
        setIsLoading(false);
      }
    }
  }, [isHydrated, organization?.id, user?.id, workspaceData]);

  const loadWorkspace = React.useCallback(async (silent = false) => {
    const hasCachedContent = Boolean(workspaceData || loadPersistedWorkspace(organization?.id, user?.id));
    if (!silent && !hasCachedContent) {
      setIsLoading(true);
    }
    try {
      const res = await fetchWorkspaceDetails();
      setWorkspaceData(res);
      if (res.products && res.products.length > 0) {
        setInstalledProducts(res.products);
      }
      savePersistedWorkspace(organization?.id, user?.id, res);

      // Sync user verification if updated on backend
      if (res.user && res.user.emailVerifiedAt && user && !user.emailVerifiedAt) {
        const state = useAuthStore.getState();
        if (state.accessToken && state.organization) {
          state.setSession(
            state.accessToken,
            { ...user, emailVerifiedAt: res.user.emailVerifiedAt },
            { ...state.organization, status: 'active' },
            'authenticated'
          );
        }
      }
    } catch {
      // Fallback to default product if initial fetch fails and we have no installed products
      if (installedProducts.length === 0) {
        const defaultKey = organization?.planCode === 'gym' ? 'gym' : 'inventory';
        setInstalledProducts([
          {
            id: 'default',
            org_id: organization?.id || 'org',
            product_key: defaultKey,
            status: 'active',
            is_primary: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [organization?.id, organization?.planCode, user, workspaceData, installedProducts.length]);

  // Initial load when auth store hydrates (silent if we already have cached data)
  React.useEffect(() => {
    if (!isHydrated) return;
    const hasCached = Boolean(workspaceData || loadPersistedWorkspace(organization?.id, user?.id));
    loadWorkspace(hasCached);
  }, [isHydrated, loadWorkspace, organization?.id, user?.id, workspaceData]);

  // Focus listener as secondary fallback for cross-tab sync
  React.useEffect(() => {
    if (!user || user.emailVerifiedAt) return;

    const handleWindowFocus = () => {
      if (document.visibilityState === 'visible') {
        getCurrentUser()
          .then((res) => {
            if (res.user && res.user.emailVerifiedAt) {
              const state = useAuthStore.getState();
              if (state.accessToken && state.organization) {
                state.setSession(
                  state.accessToken,
                  res.user,
                  { ...state.organization, status: 'active' },
                  'authenticated'
                );
              }
              // Broadcast to other tabs
              broadcastChannelRef.current?.postMessage({
                type: 'EMAIL_VERIFIED',
                emailVerifiedAt: res.user.emailVerifiedAt,
              });
              loadWorkspace(true);
            }
          })
          .catch(() => {});
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [user?.emailVerifiedAt, loadWorkspace]);

  const isEmailVerified = Boolean(user?.emailVerifiedAt);
  const isEmailUnverified = !isEmailVerified;

  const hasProduct = React.useCallback(
    (productKey: string) => {
      const cleanKey = productKey.toLowerCase().trim();
      return installedProducts.some(
        (p) => p.product_key.toLowerCase() === cleanKey && p.status === 'active'
      );
    },
    [installedProducts]
  );

  const can = React.useCallback(
    (permission: string) => {
      const role = workspaceData?.membership?.org_role || workspaceData?.membership?.role || 'owner';
      if (role === 'owner' || role === 'admin') return true;
      if (role === 'manager') {
        return permission !== 'manage_billing' && permission !== 'install_apps';
      }
      return false;
    },
    [workspaceData?.membership?.org_role, workspaceData?.membership?.role]
  );

  const installApp = async (productKey: string) => {
    if (isEmailUnverified) {
      toast.error('Please verify your email address to add workspace applications.');
      return;
    }

    try {
      const updated = await installWorkspaceProduct(productKey);
      setInstalledProducts(updated);
      setWorkspaceData((prev) => {
        if (!prev) return prev;
        const updatedData = { ...prev, products: updated };
        savePersistedWorkspace(organization?.id, user?.id, updatedData);
        return updatedData;
      });

      // Broadcast update across open tabs
      broadcastChannelRef.current?.postMessage({
        type: 'PRODUCTS_UPDATED',
        products: updated,
      });

      toast.success('Application activated in your workspace.');
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to install application.';
      toast.error(message);
      throw err;
    }
  };

  const uninstallApp = async (productKey: string) => {
    if (isEmailUnverified) {
      toast.error('Please verify your email address to modify workspace applications.');
      return;
    }

    if (installedProducts.length <= 1) {
      toast.error('You must keep at least one active application in your workspace.');
      return;
    }

    try {
      const updated = await uninstallWorkspaceProduct(productKey);
      setInstalledProducts(updated);
      setWorkspaceData((prev) => {
        if (!prev) return prev;
        const updatedData = { ...prev, products: updated };
        savePersistedWorkspace(organization?.id, user?.id, updatedData);
        return updatedData;
      });

      // Broadcast update across open tabs
      broadcastChannelRef.current?.postMessage({
        type: 'PRODUCTS_UPDATED',
        products: updated,
      });

      toast.success('Application removed.');
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to uninstall application.';
      toast.error(message);
      throw err;
    }
  };

  const setPrimaryApp = async (productKey: string) => {
    if (isEmailUnverified) {
      toast.error('Please verify your email address to set primary applications.');
      return;
    }

    try {
      const updated = await setPrimaryWorkspaceProduct(productKey);
      setInstalledProducts(updated);
      setWorkspaceData((prev) => {
        if (!prev) return prev;
        const updatedData = { ...prev, products: updated };
        savePersistedWorkspace(organization?.id, user?.id, updatedData);
        return updatedData;
      });

      broadcastChannelRef.current?.postMessage({
        type: 'PRODUCTS_UPDATED',
        products: updated,
      });

      toast.success('Default primary application updated.');
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to set primary application.';
      toast.error(message);
      throw err;
    }
  };

  const value = React.useMemo<WorkspaceContextValue>(
    () => ({
      user,
      organization,
      membership: workspaceData?.membership ?? null,
      branch: workspaceData?.branch ?? null,
      branches: workspaceData?.branches ?? [],
      installedProducts,
      isLoading,
      isEmailVerified,
      isEmailUnverified,
      hasProduct,
      can,
      installApp,
      uninstallApp,
      setPrimaryApp,
      refreshWorkspace: () => loadWorkspace(true),
    }),
    [
      user,
      organization,
      workspaceData,
      installedProducts,
      isLoading,
      isEmailVerified,
      isEmailUnverified,
      hasProduct,
      can,
      loadWorkspace,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = React.useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a <WorkspaceProvider>');
  }
  return context;
}
