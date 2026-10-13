import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getInventoryOnboardingStatus, type InventoryOnboardingStatusResponse } from '../api';

const ONBOARDING_CACHE_KEY_PREFIX = 'orvio_inventory_onboarding_';

export function getCachedOnboardingStatus(orgId?: string): InventoryOnboardingStatusResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = `${ONBOARDING_CACHE_KEY_PREFIX}${orgId || 'default'}`;
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

export function setCachedOnboardingStatus(orgId: string | undefined, data: InventoryOnboardingStatusResponse) {
  if (typeof window === 'undefined') return;
  try {
    const key = `${ONBOARDING_CACHE_KEY_PREFIX}${orgId || 'default'}`;
    const serialized = JSON.stringify(data);
    sessionStorage.setItem(key, serialized);
    localStorage.setItem(key, serialized);
  } catch {
    // Ignore storage error
  }
}

export function useInventoryOnboarding(orgId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery<InventoryOnboardingStatusResponse, Error>({
    queryKey: ['inventory', 'onboarding-status', orgId || 'default'],
    queryFn: async () => {
      const data = await getInventoryOnboardingStatus();
      setCachedOnboardingStatus(orgId, data);
      return data;
    },
    initialData: () => getCachedOnboardingStatus(orgId) ?? undefined,
    staleTime: 5 * 60 * 1000, // 5 minutes fresh
    refetchOnWindowFocus: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory', 'onboarding-status', orgId || 'default'] });
  };

  return {
    ...query,
    invalidate,
  };
}
