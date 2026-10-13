import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import type { AddressInfo } from 'node:net';
import { createTestApp, type TestAppContext } from '../helpers/app.js';
import { signAccessToken } from '../../src/lib/tokens.js';

describe('WebSocket Authentication & Heartbeat (Integration Tests)', { timeout: 60000 }, () => {
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

  it('rejects connection without token', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/api/v1/events`);

    const messagePromise = new Promise<{ code?: number; message?: string }>((resolve) => {
      let receivedMsg: any = null;
      ws.on('message', (data) => {
        try {
          receivedMsg = JSON.parse(data.toString());
        } catch {
          // ignore
        }
      });
      ws.on('close', (code) => {
        resolve({ code, message: receivedMsg });
      });
    });

    const res = await messagePromise;
    expect(res.code).toBe(4001);
  });

  it('rejects connection with invalid token', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/api/v1/events?token=invalid.jwt.token`);

    const closePromise = new Promise<number>((resolve) => {
      ws.on('close', (code) => {
        resolve(code);
      });
    });

    const code = await closePromise;
    expect(code).toBe(4001);
  });

  it('accepts connection with valid token, receives welcome, and responds to ping', async () => {
    const orgId = 'test-org-ws-1';
    const validToken = await signAccessToken({
      sub: 'test-user-1',
      email: 'test@example.com',
      org_id: orgId,
    });

    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/api/v1/events?token=${validToken}`);

    const welcomePromise = new Promise<any>((resolve, reject) => {
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'welcome') {
            resolve(msg);
          }
        } catch (err) {
          reject(err);
        }
      });
      ws.on('error', reject);
    });

    const welcomeMsg = await welcomePromise;
    expect(welcomeMsg.type).toBe('welcome');
    expect(welcomeMsg.orgId).toBe(orgId);
    expect(welcomeMsg.userId).toBe('test-user-1');

    // Test ping -> pong
    const pongPromise = new Promise<any>((resolve) => {
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'pong') {
            resolve(msg);
          }
        } catch {
          // ignore
        }
      });
      ws.send(JSON.stringify({ type: 'ping' }));
    });

    const pongMsg = await pongPromise;
    expect(pongMsg.type).toBe('pong');
    expect(pongMsg.timestamp).toBeDefined();

    ws.close();
  });

  it('handles token:refresh message seamlessly', async () => {
    const orgId = 'test-org-ws-2';
    const initialToken = await signAccessToken({
      sub: 'test-user-2',
      email: 'test2@example.com',
      org_id: orgId,
    });

    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/api/v1/events?token=${initialToken}`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => resolve());
    });

    const refreshedToken = await signAccessToken({
      sub: 'test-user-2',
      email: 'test2@example.com',
      org_id: orgId,
    });

    const refreshPromise = new Promise<any>((resolve) => {
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'token:refreshed') {
            resolve(msg);
          }
        } catch {
          // ignore
        }
      });
      ws.send(JSON.stringify({ type: 'token:refresh', payload: { token: refreshedToken } }));
    });

    const refreshMsg = await refreshPromise;
    expect(refreshMsg.type).toBe('token:refreshed');
    expect(refreshMsg.orgId).toBe(orgId);

    ws.close();
  });
});
