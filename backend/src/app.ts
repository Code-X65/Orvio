import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { PrismaClient } from '@prisma/client';

import { env } from './config/env.js';
import { prisma as defaultPrisma } from './infrastructure/database/client.js';
import { emailSender as defaultEmailSender, type EmailSender } from './modules/email/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { idempotencyOnSendHook } from './middleware/idempotency.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { orgRoutes } from './modules/organizations/org.routes.js';
import { onboardingRoutes } from './modules/onboarding/onboarding.routes.js';

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

        // Allow localhost and any tenant subdomains on localhost (e.g. coreconnectacademy.localhost)
        if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
          return cb(null, true);
        }

        // Allow production root domain and all tenant subdomains (e.g. *.orvio.com)
        const baseDomain = env.APP_BASE_DOMAIN || 'orvio.com';
        if (hostname === baseDomain || hostname.endsWith(`.${baseDomain}`)) {
          return cb(null, true);
        }
      } catch {
        // Ignore URL parse failures
      }
      cb(new Error('Not allowed by CORS'), false);
    },
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

  // API v1 Routes
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(orgRoutes, { prefix: '/api/v1/orgs' });
  app.register(orgRoutes, { prefix: '/api/v1/organizations' });
  app.register(onboardingRoutes, { prefix: '/api/v1/onboarding' });

  return app;
}
