import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

import { type AppEnv, parseEnvironment } from './config/env.js';
import { redactedLogPaths } from './config/logger.js';
import { createDatabaseClient, type DatabaseClient } from './infrastructure/database/prisma.js';
import { AppError } from './lib/app-error.js';
import { registerOpenApi } from './plugins/openapi.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerAuthRoutes } from './modules/auth/routes.js';
import { registerOnboardingRoutes } from './modules/onboarding/routes.js';
import { registerOrganizationRoutes } from './modules/organizations/routes.js';
import { startAuthMaintenanceScheduler } from './modules/auth/maintenance.js';
import { registerDeliveryCaptureRoutes } from './testing/delivery-capture.js';

import type { AuthMailSender } from './modules/auth/mail.js';
import type { PhoneMessageSender } from './modules/auth/sms.js';

export interface BuildAppOptions {
  env?: AppEnv;
  database?: DatabaseClient;
  mailer?: AuthMailSender;
  sms?: PhoneMessageSender;
}

function hasStatusCode(error: unknown): error is { statusCode: number } {
  return typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number';
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = options.env ?? parseEnvironment();
  const database = options.database ?? createDatabaseClient(env.DATABASE_URL);
  const app = Fastify({
    logger: { level: env.LOG_LEVEL, redact: { paths: [...redactedLogPaths], censor: '[REDACTED]' } },
    bodyLimit: 1_048_576,
    trustProxy: (_address, hop) => hop < (env.TRUST_PROXY_HOPS ?? 0),
    genReqId: (request) => {
      const suppliedId = request.headers['x-request-id'];
      return typeof suppliedId === 'string' && suppliedId.length > 0 ? suppliedId : randomUUID();
    },
  });

  await app.register(cors, {
    origin: (origin, callback) => callback(null, origin === undefined || env.CORS_ORIGINS.includes(origin)),
    credentials: true,
  });
  await app.register(helmet);
  await app.register(cookie);
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });
  await registerOpenApi(app);

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
    if (request.url.startsWith('/api/v1/auth')) { reply.header('cache-control', 'no-store, no-cache, must-revalidate, private'); reply.header('pragma', 'no-cache'); }
  });
  app.addHook('onRequest', async (request) => { request.auth = null; });
  app.addHook('onRequest', async (request) => {
    if (env.NODE_ENV === 'production' && request.protocol !== 'https') {
      throw new AppError(400, 'HTTPS_REQUIRED', 'HTTPS is required for this service.');
    }
  });
  app.addHook('onRequest', async (request) => {
    if (request.url.split('?')[0] !== '/api/v1/auth/refresh') return;
    const origin = request.headers.origin ?? request.headers.referer;
    const fetchSite = request.headers['sec-fetch-site'];
    const allowedOrigin = typeof origin === 'string' && (() => { try { const parsed = new URL(origin); return env.CORS_ORIGINS.some((allowed) => new URL(allowed).origin === parsed.origin); } catch { return false; } })();
    if ((typeof origin === 'string' && !allowedOrigin) || fetchSite === 'cross-site') throw new AppError(403, 'ORIGIN_FORBIDDEN', 'This request origin is not allowed.');
  });

  app.setErrorHandler((error, request, reply) => {
    const appError = error instanceof AppError ? error : null;
    const statusCode = appError?.statusCode ?? (hasStatusCode(error) ? error.statusCode : 500);
    const code = appError?.code ?? (statusCode === 429 ? 'RATE_LIMITED' : statusCode === 404 ? 'RESOURCE_NOT_FOUND' : 'INTERNAL_ERROR');
    const message = appError?.message ?? (statusCode < 500 && error instanceof Error ? error.message : 'An unexpected error occurred.');

    if (statusCode >= 500) {
      request.log.error({ err: error }, 'Request failed');
    }

    if (appError?.details && typeof appError.details === 'object' && 'retryAfter' in appError.details) {
      reply.header('retry-after', String((appError.details as { retryAfter: number }).retryAfter));
    }

    reply.status(statusCode).send({
      error: {
        code,
        message,
        details: appError?.details ?? null,
        requestId: request.id,
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: { code: 'RESOURCE_NOT_FOUND', message: 'The requested resource was not found.', details: null, requestId: request.id },
    });
  });

  if (env.NODE_ENV !== 'test') {
    const maintenance = startAuthMaintenanceScheduler(database, {
      sessionRetentionDays: env.AUTH_SESSION_RETENTION_DAYS,
      auditRetentionDays: env.AUDIT_LOG_RETENTION_DAYS,
      intervalMs: env.AUTH_CLEANUP_INTERVAL_MS,
      logger: {
        info: (msg) => app.log.info(msg),
        error: (err, msg) => app.log.error({ err }, msg),
      },
    });
    app.addHook('onClose', async () => {
      maintenance.stop();
    });
  }

  app.addHook('onClose', async () => {
    await database.$disconnect();
  });

  await registerHealthRoutes(app, database);
  await registerDeliveryCaptureRoutes(app, env);
  await registerAuthRoutes(app, { env, database, mailer: options.mailer });
  await registerOrganizationRoutes(app, { env, database });
  await registerOnboardingRoutes(app, { env, database, mailer: options.mailer, sms: options.sms });
  return app;
}
