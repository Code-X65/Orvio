import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';

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
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'catalog'] });
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
