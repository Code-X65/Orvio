import type { FastifyInstance } from 'fastify';

import { AppError } from '../lib/app-error.js';
import type { DatabaseClient } from '../infrastructure/database/prisma.js';

const serviceResponseSchema = {
  type: 'object',
  required: ['data', 'meta'],
  properties: {
    data: { type: 'object', required: ['status'], properties: { status: { type: 'string' } } },
    meta: { type: 'object', required: ['requestId'], properties: { requestId: { type: 'string' } } },
  },
} as const;

const errorResponseSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message', 'requestId'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: { nullable: true },
        requestId: { type: 'string' },
      },
    },
  },
} as const;

export async function registerHealthRoutes(app: FastifyInstance, database: DatabaseClient): Promise<void> {
  app.get('/health', {
    config: { rateLimit: false },
    schema: { tags: ['Infrastructure'], summary: 'Check service liveness', response: { 200: serviceResponseSchema } },
  }, async (request) => ({
    data: { status: 'ok' },
    meta: { requestId: request.id },
  }));

  app.get('/ready', {
    config: { rateLimit: false },
    schema: { tags: ['Infrastructure'], summary: 'Check database readiness', response: { 200: serviceResponseSchema, 503: errorResponseSchema } },
  }, async (request) => {
    try {
      await database.$queryRawUnsafe('SELECT 1');
    } catch {
      throw new AppError(503, 'DEPENDENCY_FAILURE', 'Database is unavailable.');
    }

    return {
      data: { status: 'ready' },
      meta: { requestId: request.id },
    };
  });
}
