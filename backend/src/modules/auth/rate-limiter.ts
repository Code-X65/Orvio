import { createHash } from 'node:crypto';
import type { DatabaseClient } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../lib/app-error.js';

export interface RateLimitOptions {
  database: DatabaseClient;
  action: string;
  ip: string;
  identity?: string;
  max: number;
  ipMax?: number;
  windowMs: number;
}

export function hashRateLimitSubject(prefix: string, identifier: string): string {
  return createHash('sha256').update(`${prefix}:${identifier.trim().toLowerCase()}`).digest('hex');
}

export async function enforceAuthRateLimit(options: RateLimitOptions): Promise<void> {
  const { database, action, ip, identity, max, ipMax = max * 6, windowMs } = options;
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const retryAfter = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000));

  // 1. IP-level rate limit check & increment
  const ipHash = hashRateLimitSubject('ip', ip);
  const ipBucket = await database.rateLimitBucket.upsert({
    where: {
      action_subjectHash_windowStart: {
        action,
        subjectHash: ipHash,
        windowStart,
      },
    },
    create: {
      action,
      subjectHash: ipHash,
      windowStart,
      count: 1,
    },
    update: {
      count: { increment: 1 },
    },
  });

  if (ipBucket.count > ipMax) {
    throw new AppError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests from this IP address. Please try again later.', {
      retryAfter,
      action,
    });
  }

  // 2. Identity-level rate limit check & increment (if identity is supplied)
  if (identity) {
    const identityHash = hashRateLimitSubject(`id:${action}`, identity);
    const identityBucket = await database.rateLimitBucket.upsert({
      where: {
        action_subjectHash_windowStart: {
          action,
          subjectHash: identityHash,
          windowStart,
        },
      },
      create: {
        action,
        subjectHash: identityHash,
        windowStart,
        count: 1,
      },
      update: {
        count: { increment: 1 },
      },
    });

    if (identityBucket.count > max) {
      throw new AppError(429, 'RATE_LIMIT_EXCEEDED', 'Too many attempts for this account. Please try again later.', {
        retryAfter,
        action,
      });
    }
  }
}
