import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { PrismaClient } from '@prisma/client';

import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';

import { env } from './config/env.js';
import { prisma as defaultPrisma } from './infrastructure/database/client.js';
import { emailSender as defaultEmailSender, type EmailSender } from './modules/email/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { idempotencyOnSendHook } from './middleware/idempotency.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { orgRoutes } from './modules/organizations/org.routes.js';
import { onboardingRoutes } from './modules/onboarding/onboarding.routes.js';
import { inventoryRoutes } from './modules/inventory/routes.js';
import { supplierRoutes } from './modules/inventory/suppliers-routes.js';
import { websocketPlugin } from './infrastructure/websocket/websocket-plugin.js';

export interface AppDeps {
  prisma?: PrismaClient;
  emailSender?: EmailSender;
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    emailSender: EmailSender;
  }
}

export function buildApp(deps?: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
    trustProxy: env.TRUST_PROXY === 'true',
  });

  const prismaClient = deps?.prisma ?? defaultPrisma;
  const activeEmailSender = deps?.emailSender ?? defaultEmailSender;

  // Decorate fastify with DI services
  app.decorate('prisma', prismaClient);
  app.decorate('emailSender', activeEmailSender);

  // Central error handler
  app.setErrorHandler(errorHandler);

  // Global Idempotency response persister
  app.addHook('onSend', idempotencyOnSendHook);

  // Security headers
  app.register(helmet, {
    contentSecurityPolicy: false,
  });

  // CORS configuration
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  const cleanBaseDomain = (env.APP_BASE_DOMAIN || 'orvio.com').split(':')[0];

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        return cb(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      try {
        const url = new URL(origin);
        const hostname = url.hostname;

        // Allow localhost and 127.0.0.1 and any subdomains (e.g. acme.localhost, coreconnect.127.0.0.1)
        if (
          hostname === 'localhost' ||
          hostname.endsWith('.localhost') ||
          hostname === '127.0.0.1' ||
          hostname.endsWith('.127.0.0.1') ||
          hostname === '0.0.0.0'
        ) {
          return cb(null, true);
        }

        // Allow production root domain and all tenant subdomains (e.g. *.orvio.com)
        if (hostname === cleanBaseDomain || hostname.endsWith(`.${cleanBaseDomain}`)) {
          return cb(null, true);
        }
      } catch {
        // Ignore URL parse failures
      }
      return cb(null, false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-tenant-subdomain',
      'X-Tenant-Subdomain',
      'idempotency-key',
      'Idempotency-Key',
      'x-idempotency-key',
      'X-Idempotency-Key',
      'x-request-id',
      'X-Request-Id',
      'Accept',
      'Origin',
      'X-Requested-With',
      'x-csrf-token',
      'X-CSRF-Token',
      'Upgrade',
      'upgrade',
      'Connection',
      'connection',
      'Sec-WebSocket-Key',
      'Sec-WebSocket-Version',
      'Sec-WebSocket-Protocol',
    ],
    exposedHeaders: [
      'x-request-id',
      'X-Request-Id',
      'x-tenant-subdomain',
      'X-Tenant-Subdomain',
      'x-csrf-token',
      'X-CSRF-Token',
      'x-idempotency-key',
      'X-Idempotency-Key',
      'idempotency-key',
      'Idempotency-Key',
      'x-idempotency-replayed',
      'X-Idempotency-Replayed',
    ],
    credentials: true,
  });

  // Cookie parsing & signing
  app.register(cookie, {
    secret: env.COOKIE_SECRET,
  });

  // Global rate limiter setup (global off, enabled per route)
  app.register(rateLimit, {
    global: false,
    max: 100,
    timeWindow: '1 minute',
  });

  // Multipart upload support
  app.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max per file
      files: 10,
    },
  });

  // Static serving for uploads
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Swagger OpenAPI Documentation & Swagger UI at /docs
  app.register(swagger, {
    openapi: {
      info: {
        title: 'Orvio Hub API',
        description: 'Multi-tenant API documentation for Orvio Hub platform',
        version: '0.1.0',
      },
      servers: [
        {
          url: `http://localhost:${env.PORT}`,
          description: 'Development Server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
  });

  // Base Health Check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // Well-Known OpenID JWKS Endpoint
  app.get('/.well-known/jwks.json', async (_req, reply) => {
    const { getPublicJwks } = await import('./lib/tokens.js');
    return reply.code(200).header('Cache-Control', 'public, max-age=3600').send(getPublicJwks());
  });

  // API v1 Routes
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(orgRoutes, { prefix: '/api/v1/orgs' });
  app.register(orgRoutes, { prefix: '/api/v1/organizations' });
  app.register(onboardingRoutes, { prefix: '/api/v1/onboarding' });
  app.register(inventoryRoutes, { prefix: '/api/v1/inventory' });
  app.register(supplierRoutes, { prefix: '/api/v1/suppliers' });

  // Real-Time WebSocket Events
  app.register(websocketPlugin, { prefix: '/api/v1' });

  return app;
}
