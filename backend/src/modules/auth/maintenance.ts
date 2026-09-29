import type { DatabaseClient } from '../../infrastructure/database/prisma.js';

export interface MaintenanceOptions {
  sessionRetentionDays?: number;
  auditRetentionDays?: number;
  intervalMs?: number;
  logger?: { info: (msg: string, ...args: unknown[]) => void; error: (err: unknown, msg: string) => void };
}

export interface CleanupResult {
  deletedSessions: number;
  deletedRateLimitBuckets: number;
  deletedAuditLogs: number;
}

export async function cleanupExpiredAuthData(
  database: DatabaseClient,
  options: { sessionRetentionDays?: number; auditRetentionDays?: number } = {},
): Promise<CleanupResult> {
  const sessionRetentionDays = options.sessionRetentionDays ?? 30;
  const auditRetentionDays = options.auditRetentionDays ?? 1825;
  const now = new Date();

  // 1. Sessions: delete expired sessions and sessions revoked longer ago than retention days
  const sessionCutoff = new Date(now.getTime() - sessionRetentionDays * 24 * 60 * 60 * 1000);
  const sessionResult = await database.authSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { absoluteExpiresAt: { lt: now } },
        { revokedAt: { lt: sessionCutoff } },
      ],
    },
  });

  // 2. Rate limit buckets: delete buckets older than 24 hours
  const bucketCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const bucketResult = await database.rateLimitBucket.deleteMany({
    where: {
      windowStart: { lt: bucketCutoff },
    },
  });

  // 3. Audit logs: a database-owned procedure is the only allowed purge path.
  const auditResult = await database.$queryRawUnsafe<Array<{ deleted_count: number }>>(
    'SELECT purge_expired_audit_logs($1) AS deleted_count',
    auditRetentionDays,
  );

  return {
    deletedSessions: sessionResult.count,
    deletedRateLimitBuckets: bucketResult.count,
    deletedAuditLogs: auditResult[0]?.deleted_count ?? 0,
  };
}

export interface MaintenanceScheduler {
  stop: () => void;
}

export function startAuthMaintenanceScheduler(
  database: DatabaseClient,
  options: MaintenanceOptions = {},
): MaintenanceScheduler {
  const intervalMs = options.intervalMs ?? 3_600_000;
  const logger = options.logger;

  const timer = setInterval(() => {
    void (async () => {
      try {
        const result = await cleanupExpiredAuthData(database, options);
        logger?.info(
          `Auth maintenance cleanup completed: purged ${result.deletedSessions} sessions, ${result.deletedRateLimitBuckets} buckets, ${result.deletedAuditLogs} audit logs.`,
        );
      } catch (err) {
        logger?.error(err, 'Failed to perform auth maintenance cleanup');
      }
    })();
  }, intervalMs);

  // Allow Node process to exit without waiting on interval
  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return {
    stop: () => clearInterval(timer),
  };
}
