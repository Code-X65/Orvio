import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import type { AddressInfo } from 'node:net';
import { createTestApp, type TestAppContext } from '../helpers/app.js';
import { signAccessToken } from '../../src/lib/tokens.js';
import { eventBus } from '../../src/infrastructure/websocket/event-bus.js';

describe('WebSocket Organization Scoped Broadcasting (Integration Tests)', { timeout: 60000 }, () => {
  let ctx: TestAppContext;
  let serverPort: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.listen({ port: 0, host: '127.0.0.1' });
    const address = ctx.app.server.address() as AddressInfo;
    serverPort = address.port;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('broadcasts events only to clients in the matching organization room', async () => {
    const orgA = 'org-scope-alpha';
    const orgB = 'org-scope-beta';

    const tokenA = await signAccessToken({ sub: 'user-a', email: 'a@example.com', org_id: orgA });
    const tokenB = await signAccessToken({ sub: 'user-b', email: 'b@example.com', org_id: orgB });

    const wsA = new WebSocket(`ws://127.0.0.1:${serverPort}/api/v1/events?token=${tokenA}`);
    const wsB = new WebSocket(`ws://127.0.0.1:${serverPort}/api/v1/events?token=${tokenB}`);

    await Promise.all([
      new Promise<void>((resolve) => wsA.on('open', resolve)),
      new Promise<void>((resolve) => wsB.on('open', resolve)),
    ]);

    // Track received messages for both
    const receivedA: any[] = [];
    const receivedB: any[] = [];

    wsA.on('message', (d) => {
      try {
        const msg = JSON.parse(d.toString());
        if (msg.type !== 'welcome') receivedA.push(msg);
      } catch {}
    });

    wsB.on('message', (d) => {
      try {
        const msg = JSON.parse(d.toString());
        if (msg.type !== 'welcome') receivedB.push(msg);
      } catch {}
    });

    // Wait a brief tick for handshake completion
    await new Promise((r) => setTimeout(r, 100));

    // Broadcast to Org A only
    eventBus.broadcastToOrg(orgA, {
      type: 'product:created',
      payload: { id: 'prod-123', name: 'Test Wireless Mouse' },
    });

    // Wait for event delivery
    await new Promise((r) => setTimeout(r, 200));

    expect(receivedA.length).toBe(1);
    expect(receivedA[0].type).toBe('product:created');
    expect(receivedA[0].orgId).toBe(orgA);
    expect(receivedA[0].payload.id).toBe('prod-123');

    // Client B must NOT have received Org A's broadcast
    expect(receivedB.length).toBe(0);

    // Now broadcast to Org B
    eventBus.broadcastToOrg(orgB, {
      type: 'brand:created',
      payload: { id: 'brand-456', name: 'Logitech' },
    });

    await new Promise((r) => setTimeout(r, 200));

    expect(receivedB.length).toBe(1);
    expect(receivedB[0].type).toBe('brand:created');
    expect(receivedB[0].orgId).toBe(orgB);
    expect(receivedB[0].payload.name).toBe('Logitech');

    // Client A still has only 1 message
    expect(receivedA.length).toBe(1);

    wsA.close();
    wsB.close();
  });
});
