import type { WebSocket } from 'ws';

export type RealtimeEventType =
  | 'product:created'
  | 'product:updated'
  | 'product:deleted'
  | 'product_images:updated'
  | 'category:created'
  | 'category:updated'
  | 'category:deleted'
  | 'category_image:updated'
  | 'brand:created'
  | 'brand:updated'
  | 'brand:deleted'
  | 'branch:created'
  | 'branch:updated'
  | 'branch:deleted'
  | 'catalog:import_complete'
  | 'catalog:updated'
  | 'stock_level:updated'
  | 'stock:adjusted'
  | 'stock:received'
  | 'stock:transferred'
  | 'stock:opened'
  | 'stock_receipt:created'
  | 'staff:branch_revoked'
  | 'staff:suspended'
  | 'staff:reactivated'
  | 'staff:removed'
  | 'staff:updated';

export interface RealtimeMessage {
  type: RealtimeEventType;
  orgId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface EventBroadcaster {
  broadcastToOrg(orgId: string, message: { type: RealtimeEventType; payload: Record<string, unknown> }): void;
  registerConnection(orgId: string, socket: WebSocket): void;
  unregisterConnection(orgId: string, socket: WebSocket): void;
  getConnectionCount(orgId?: string): number;
  closeAll(): void;
}

export class InProcessEventBus implements EventBroadcaster {
  private connections = new Map<string, Set<WebSocket>>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  private getOrgKey(orgId: string): string {
    return `org:${orgId}`;
  }

  registerConnection(orgId: string, socket: WebSocket): void {
    const key = this.getOrgKey(orgId);
    let orgSockets = this.connections.get(key);
    if (!orgSockets) {
      orgSockets = new Set<WebSocket>();
      this.connections.set(key, orgSockets);
    }
    orgSockets.add(socket);
  }

  unregisterConnection(orgId: string, socket: WebSocket): void {
    const key = this.getOrgKey(orgId);
    const orgSockets = this.connections.get(key);
    if (orgSockets) {
      orgSockets.delete(socket);
      if (orgSockets.size === 0) {
        this.connections.delete(key);
      }
    }
  }

  getConnectionCount(orgId?: string): number {
    if (orgId) {
      const key = this.getOrgKey(orgId);
      return this.connections.get(key)?.size || 0;
    }
    let total = 0;
    for (const set of this.connections.values()) {
      total += set.size;
    }
    return total;
  }

  broadcastToOrg(orgId: string, message: { type: RealtimeEventType; payload: Record<string, unknown> }): void {
    const key = this.getOrgKey(orgId);
    const orgSockets = this.connections.get(key);
    if (!orgSockets || orgSockets.size === 0) {
      return;
    }

    const fullMessage: RealtimeMessage = {
      type: message.type,
      orgId,
      payload: message.payload,
      timestamp: new Date().toISOString(),
    };

    const payloadStr = JSON.stringify(fullMessage);

    for (const socket of orgSockets) {
      // readyState 1 === OPEN in ws
      if (socket.readyState === 1) {
        try {
          socket.send(payloadStr);
        } catch (err) {
          console.error(`Failed to send WebSocket message to client in ${key}:`, err);
        }
      }
    }
  }

  closeAll(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    for (const [key, sockets] of this.connections.entries()) {
      for (const socket of sockets) {
        try {
          socket.close(1001, 'Server shutting down');
        } catch {
          // ignore
        }
      }
      sockets.clear();
    }
    this.connections.clear();
  }
}

export const eventBus = new InProcessEventBus();
