import { prisma } from '../infrastructure/database/client.js';

export async function cleanupExpiredTokens(): Promise<{
  deletedVerificationTokens: number;
  deletedRefreshTokens: number;
}> {
  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Delete consumed or expired verification tokens older than now
  const verificationRes = await prisma.verificationToken.deleteMany({
    where: {
      OR: [
        { expires_at: { lt: now } },
        { consumed_at: { not: null } },
      ],
    },
  });

  // Delete revoked refresh tokens or expired refresh tokens older than 30 days
  const refreshRes = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expires_at: { lt: thirtyDaysAgo } },
        { revoked_at: { not: null, lt: thirtyDaysAgo } },
      ],
    },
  });

  return {
    deletedVerificationTokens: verificationRes.count,
    deletedRefreshTokens: refreshRes.count,
  };
}

// Run if directly executed
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  console.log('🧹 Purging expired and revoked tokens...');
  cleanupExpiredTokens()
    .then((res) => {
      console.log(
        `✅ Purged ${res.deletedVerificationTokens} verification tokens and ${res.deletedRefreshTokens} refresh tokens.`
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Token cleanup failed:', err);
      process.exit(1);
    });
}
