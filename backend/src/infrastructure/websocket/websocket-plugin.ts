import type { FastifyPluginAsync } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { verifyAccessToken } from '../../lib/tokens.js';
import { eventBus } from './event-bus.js';

export const websocketPlugin: FastifyPluginAsync = async (app) => {
  await app.register(fastifyWebsocket, {
    options: {
      maxPayload: 1048576, // 1MB
    },
  });

  app.get('/events', { websocket: true }, async (socket, request) => {
    const query = request.query as Record<string, string | undefined>;
    const rawToken =
      query.token ||
      (typeof request.headers['sec-websocket-protocol'] === 'string'
        ? request.headers['sec-websocket-protocol'].split(',')[0]?.trim()
        : undefined) ||
      (request.headers.authorization?.startsWith('Bearer ')
        ? request.headers.authorization.slice(7).trim()
        : undefined);

    if (!rawToken) {
      socket.send(
        JSON.stringify({
          type: 'error',
          code: 'UNAUTHORIZED',
          message: 'Authentication token is required to connect to real-time events.',
        })
      );
      socket.close(4001, 'Unauthorized');
      return;
    }

    const claims = await verifyAccessToken(rawToken);
    if (!claims) {
      socket.send(
        JSON.stringify({
          type: 'error',
          code: 'INVALID_TOKEN',
          message: 'The provided authentication token is invalid or expired.',
        })
      );
      socket.close(4001, 'Invalid or expired token');
      return;
    }

    const initialOrgId = (claims.org_id as string | undefined) || query.org;
    if (!initialOrgId) {
      socket.send(
        JSON.stringify({
          type: 'error',
          code: 'NO_ORG_CONTEXT',
          message: 'No active organization found for token.',
        })
      );
      socket.close(4003, 'Missing organization context');
      return;
    }

    let currentOrgId: string = initialOrgId;

    // Register with event bus
    eventBus.registerConnection(currentOrgId, socket);

    // Send initial welcome handshake
    socket.send(
      JSON.stringify({
        type: 'welcome',
        orgId: currentOrgId,
        userId: claims.sub,
        timestamp: new Date().toISOString(),
      })
    );

    // Heartbeat monitoring
    let isAlive = true;
    socket.on('pong', () => {
      isAlive = true;
    });

    const heartbeatInterval = setInterval(() => {
      if (!isAlive) {
        clearInterval(heartbeatInterval);
        socket.terminate();
        return;
      }
      isAlive = false;
      try {
        socket.ping();
      } catch {
        clearInterval(heartbeatInterval);
      }
    }, 25000);

    // Handle incoming client messages (heartbeat pings, token refresh)
    socket.on('message', async (data) => {
      try {
        const text = data.toString();
        if (text === 'ping') {
          socket.send('pong');
          return;
        }

        const msg = JSON.parse(text);
        if (msg.type === 'ping') {
          socket.send(
            JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString(),
            })
          );
          return;
        }

        if (msg.type === 'token:refresh' && msg.payload?.token) {
          const newClaims = await verifyAccessToken(msg.payload.token);
          if (!newClaims) {
            socket.send(
              JSON.stringify({
                type: 'token:expired',
                message: 'Failed to refresh token: new token is invalid or expired.',
              })
            );
            socket.close(4001, 'Token refresh failed');
            return;
          }

          const newOrgId = (newClaims.org_id as string | undefined) || currentOrgId;
          if (newOrgId !== currentOrgId) {
            eventBus.unregisterConnection(currentOrgId, socket);
            currentOrgId = newOrgId;
            eventBus.registerConnection(currentOrgId, socket);
          }

          socket.send(
            JSON.stringify({
              type: 'token:refreshed',
              orgId: currentOrgId,
              timestamp: new Date().toISOString(),
            })
          );
        }
      } catch {
        // Non-JSON or malformed client messages ignored
      }
    });

    // Cleanup on disconnect
    const cleanup = () => {
      clearInterval(heartbeatInterval);
      eventBus.unregisterConnection(currentOrgId, socket);
    };

    socket.on('close', cleanup);
    socket.on('error', cleanup);
  });
};
