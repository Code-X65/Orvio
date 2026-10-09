import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';

/**
 * Purges expired verification tokens and revoked/expired refresh tokens from the database.
 */
export async function purgeExpiredAuthData(db: PrismaClient = defaultPrisma) {
  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [deletedVerificationTokens, deletedRefreshTokens] = await Promise.all([
    // Delete expired or old consumed verification tokens
    db.verificationToken.deleteMany({
      where: {
        OR: [
          { expires_at: { lt: now } },
          { consumed_at: { not: null, lt: thirtyDaysAgo } },
        ],
      },
    }),
    // Delete revoked refresh tokens that have expired
    db.refreshToken.deleteMany({
      where: {
        OR: [
          { revoked_at: { not: null }, expires_at: { lt: now } },
          { absolute_expires_at: { not: null, lt: now } },
        ],
      },
    }),
  ]);

  return {
    deletedVerificationTokens: deletedVerificationTokens.count,
    deletedRefreshTokens: deletedRefreshTokens.count,
  };
}

let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Starts an in-process background cleanup timer (hourly by default)
 */
export function startTokenCleanupJob(db: PrismaClient = defaultPrisma, intervalMs = 3600000) {
  if (cleanupTimer) return cleanupTimer;

  cleanupTimer = setInterval(() => {
    purgeExpiredAuthData(db).catch((err) => {
      console.error('[TokenCleanupJob] Error during periodic token purge:', err);
    });
  }, intervalMs);

  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  return cleanupTimer;
}

export function stopTokenCleanupJob() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
