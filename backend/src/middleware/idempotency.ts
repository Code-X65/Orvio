import type { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { prisma as defaultPrisma } from '../infrastructure/database/client.js';
import { AppError } from '../lib/errors.js';

export interface IdempotencyOptions {
  ttlHours?: number;
  required?: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    idempotencyKey?: string;
    idempotencyHash?: string;
  }
}

/**
 * Computes deterministic SHA-256 hash of the request method, path, and serialized body.
 */
export function computeRequestHash(method: string, url: string, body: unknown): string {
  const normalizedBody = body && typeof body === 'object' ? JSON.stringify(body) : String(body ?? '');
  return crypto
    .createHash('sha256')
    .update(`${method.toUpperCase()}:${url}:${normalizedBody}`)
    .digest('hex');
}

/**
 * Fastify preHandler hook for transparent HTTP idempotency support.
 */
export function requireIdempotency(options: IdempotencyOptions = {}) {
  const ttlHours = options.ttlHours ?? 24;

  return async function idempotencyPreHandler(request: FastifyRequest, reply: FastifyReply) {
    const rawKey = request.headers['idempotency-key'] || request.headers['x-idempotency-key'];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (!key) {
      if (options.required) {
        throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required for this request', 400);
      }
      return;
    }

    if (key.length < 4 || key.length > 128) {
      throw new AppError('INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key must be between 4 and 128 characters', 400);
    }

    const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
    const requestHash = computeRequestHash(request.method, request.url, request.body);
    request.idempotencyKey = key;
    request.idempotencyHash = requestHash;

    const existing = await db.idempotencyKey.findUnique({
      where: { key },
    });

    if (existing) {
      const isExpired = new Date() > existing.expires_at;

      if (isExpired) {
        // Expired record: delete and allow fresh execution
        await db.idempotencyKey.delete({ where: { key } }).catch(() => {});
      } else {
        // Verify request payload matches the original
        if (existing.request_hash !== requestHash) {
          throw new AppError(
            'IDEMPOTENCY_PAYLOAD_MISMATCH',
            'This Idempotency-Key was already used with a different request payload or endpoint',
            422
          );
        }

        // If another request is currently executing with this key
        if (existing.status === 'in_progress') {
          throw new AppError(
            'REQUEST_IN_PROGRESS',
            'A request with this Idempotency-Key is currently being processed',
            409
          );
        }

        // Replay cached successful response
        if (existing.status === 'completed' && existing.response_body) {
          reply.header('x-idempotency-replayed', 'true');
          reply.code(existing.status_code ?? 200);
          return reply.send(existing.response_body);
        }
      }
    }

    // Lock the key in "in_progress" status
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    try {
      await db.idempotencyKey.create({
        data: {
          key,
          request_path: request.url,
          request_method: request.method,
          request_hash: requestHash,
          status: 'in_progress',
          expires_at: expiresAt,
        },
      });
    } catch (err: any) {
      // Catch race condition if parallel request inserted between findUnique and create
      if (err?.code === 'P2002') {
        throw new AppError(
          'REQUEST_IN_PROGRESS',
          'A request with this Idempotency-Key is currently being processed',
          409
        );
      }
      throw err;
    }
  };
}

/**
 * Fastify onSend hook to record the final response for an active Idempotency-Key.
 */
export async function idempotencyOnSendHook(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown
): Promise<unknown> {
  const key = request.idempotencyKey;
  if (!key) return payload;

  const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;

  // Only cache successful or client validation responses (e.g. 2xx, 4xx). On 5xx server crash, mark failed so client can retry.
  const isServerCrash = reply.statusCode >= 500;

  try {
    if (isServerCrash) {
      await db.idempotencyKey.delete({ where: { key } }).catch(() => {});
      return payload;
    }

    let parsedBody: any = payload;
    if (typeof payload === 'string') {
      try {
        parsedBody = JSON.parse(payload);
      } catch {
        parsedBody = payload;
      }
    }

    await db.idempotencyKey.update({
      where: { key },
      data: {
        status: 'completed',
        status_code: reply.statusCode,
        response_body: parsedBody as any,
      },
    });
  } catch (err) {
    // Non-blocking catch to prevent response degradation
    request.log?.warn?.({ err, key }, 'Failed to persist idempotency response record');
  }

  return payload;
}
