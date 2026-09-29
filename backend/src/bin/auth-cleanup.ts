import 'dotenv/config';
import { parseEnvironment } from '../config/env.js';
import { createDatabaseClient } from '../infrastructure/database/prisma.js';
import { cleanupExpiredAuthData } from '../modules/auth/maintenance.js';

async function main(): Promise<void> {
  const env = parseEnvironment();
  const database = createDatabaseClient(env.DATABASE_URL);

  try {
    console.log('Starting auth data cleanup...');
    const result = await cleanupExpiredAuthData(database, {
      sessionRetentionDays: env.AUTH_SESSION_RETENTION_DAYS,
      auditRetentionDays: env.AUDIT_LOG_RETENTION_DAYS,
    });
    console.log(
      `Cleanup finished: removed ${result.deletedSessions} expired sessions, ${result.deletedRateLimitBuckets} rate limit buckets, ${result.deletedAuditLogs} old audit logs.`,
    );
  } finally {
    await database.$disconnect();
  }
}

main().catch((err) => {
  console.error('Failed to run auth cleanup:', err);
  process.exit(1);
});
