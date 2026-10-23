import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidatePersistedCatalog } from '../features/inventory/catalog-cache';
import { invalidatePersistedStock } from '../features/inventory/stock-cache';
import { useAuthStore } from '../stores/auth-store';

export interface RealtimeInventoryEvent {
  type: string;
  orgId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

const CHANNEL_NAME = 'orvio_inventory_events';

let channelInstance: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    if (!channelInstance) {
      try {
        channelInstance = new BroadcastChannel(CHANNEL_NAME);
      } catch {
        // BroadcastChannel may not be supported in some environments
      }
    }
  }
  return channelInstance;
}

export function broadcastCrossTabEvent(event: RealtimeInventoryEvent): void {
  try {
    const ch = getChannel();
    ch?.postMessage(event);
  } catch (err) {
    console.warn('Failed to broadcast inventory event across tabs:', err);
  }
}

export function invalidateInventoryQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  event: RealtimeInventoryEvent
): void {
  const { type, payload } = event;
  const productId = (payload?.id || payload?.productId) as string | undefined;

  // Invalidate persisted Page-1 catalog cache
  if (event.orgId) {
    invalidatePersistedCatalog(event.orgId);
  }

  switch (type) {
    case 'product:created':
    case 'product:deleted':
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'catalog'] });
      break;

    case 'product:updated':
    case 'product_images:updated':
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'catalog'] });
      if (productId) {
        queryClient.invalidateQueries({ queryKey: ['inventory', 'product', productId] });
      }
      break;

    case 'category:created':
    case 'category:updated':
    case 'category:deleted':
    case 'category_image:updated':
      queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'catalog'] });
      break;

    case 'brand:created':
    case 'brand:updated':
    case 'brand:deleted':
      queryClient.invalidateQueries({ queryKey: ['inventory', 'brands'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'catalog'] });
      break;

    case 'branch:created':
    case 'branch:updated':
    case 'branch:deleted':
      queryClient.invalidateQueries({ queryKey: ['inventory', 'branches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'catalog'] });
      break;

    case 'catalog:import_complete':
    case 'catalog:updated':
    case 'stock_level:updated':
    case 'stock:adjusted':
    case 'stock:received':
    case 'stock:opened':
    case 'stock:transferred':
    case 'stock_receipt:created': {
      const branchId = (payload?.branchId as string) || undefined;
      const sourceBranchId = (payload?.sourceBranchId as string) || undefined;
      const destinationBranchId = (payload?.destinationBranchId as string) || undefined;

      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'catalog'] });

      if (event.orgId) {
        if (sourceBranchId || destinationBranchId) {
          if (sourceBranchId) invalidatePersistedStock(event.orgId, sourceBranchId);
          if (destinationBranchId) invalidatePersistedStock(event.orgId, destinationBranchId);
        } else {
          invalidatePersistedStock(event.orgId, branchId);
        }
      }

      const affectedProductIds: string[] = [];
      if (productId) affectedProductIds.push(productId);
      if (Array.isArray(payload?.items)) {
        for (const it of payload.items as Array<{ productId?: string }>) {
          if (it?.productId && !affectedProductIds.includes(it.productId)) {
            affectedProductIds.push(it.productId);
          }
        }
      }

      if (typeof window !== 'undefined' && affectedProductIds.length > 0) {
        window.dispatchEvent(
          new CustomEvent('orvio:stock-updated', {
            detail: {
              ...event,
              productIds: affectedProductIds,
            },
          })
        );
      }
      break;
    }

    case 'staff:branch_revoked':
    case 'staff:suspended':
    case 'staff:removed':
    case 'staff:reactivated':
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'branches'] });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('orvio:access-revoked', { detail: event })
        );
      }
      break;

    case 'staff:updated':
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'branches'] });
      if (typeof window !== 'undefined') {
        const currentUserId = useAuthStore.getState().user?.id;
        const targetUserId = event.payload?.userId as string | undefined;

        // If current authenticated user is the target of the update
        if (targetUserId && currentUserId === targetUserId) {
          // Trigger silent token refresh in background
          useAuthStore.getState().refreshToken();

          // Dispatch role change notification event
          window.dispatchEvent(
            new CustomEvent('orvio:role-changed', {
              detail: {
                oldRole: event.payload?.oldRole,
                newRole: event.payload?.newRole || event.payload?.role,
                membershipId: event.payload?.membershipId,
                branchRoles: event.payload?.branchRoles as Record<string, string> | undefined,
                branchIds: event.payload?.branchIds as string[] | undefined,
                scopeAllBranches: event.payload?.scopeAllBranches as boolean | undefined,
              },
            })
          );
        }

        // Notify for branch access verification & staff directory live updates
        window.dispatchEvent(
          new CustomEvent('orvio:access-revoked', { detail: event })
        );
        window.dispatchEvent(
          new CustomEvent('orvio:staff-updated', { detail: event })
        );
      }
      break;

    default:
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      break;
  }
}

export function useCrossTabSync(currentOrgId?: string | null): void {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!currentOrgId) return;

    const ch = getChannel();
    if (!ch) return;

    const handleMessage = (msgEvt: MessageEvent<RealtimeInventoryEvent>) => {
      const event = msgEvt.data;
      if (!event || event.orgId !== currentOrgId) return;
      invalidateInventoryQueries(queryClient, event);
    };

    ch.addEventListener('message', handleMessage);

    return () => {
      ch.removeEventListener('message', handleMessage);
    };
  }, [currentOrgId, queryClient]);
}
