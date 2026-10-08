import type { PrismaClient } from '@prisma/client';
import { generateOpaqueToken, hashToken } from '../../lib/tokens.js';
import { AppError } from '../../lib/errors.js';

export type TokenPurpose =
  | 'email_verification'
  | 'magic_login'
  | 'password_reset'
  | 'email_change'
  | 'phone_verification';

export interface IssuedToken {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Builds an emailed link carrying the token in the URL fragment (#token=...).
 * Fragments are never sent to servers, so the token does not leak via
 * Referer headers, proxy/CDN access logs, or server request logs.
 */
export function buildTokenLink(baseUrl: string, path: string, rawToken: string): string {
  return `${baseUrl}${path}#token=${encodeURIComponent(rawToken)}`;
}

/**
 * Issues a new single-use token. Any still-pending token for the same user and
 * purpose is revoked first, so only the most recently emailed link works.
 */
export async function issueVerificationToken(
  db: PrismaClient,
  userId: string,
  purpose: TokenPurpose = 'email_verification',
  expiryHours = 24,
  metadata?: Record<string, unknown>
): Promise<IssuedToken> {
  const { rawToken, tokenHash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  await invalidateUserTokens(db, userId, [purpose]);

  await db.verificationToken.create({
    data: {
      user_id: userId,
      token_hash: tokenHash,
      purpose,
      metadata: metadata ? (metadata as any) : undefined,
      expires_at: expiresAt,
    },
  });

  return { rawToken, tokenHash, expiresAt };
}

export async function checkResendCooldown(
  db: PrismaClient,
  userId: string,
  purpose = 'email_verification',
  cooldownSeconds = 60
): Promise<void> {
  const latestToken = await db.verificationToken.findFirst({
    where: { user_id: userId, purpose },
    orderBy: { created_at: 'desc' },
  });

  if (latestToken) {
    const elapsedSeconds = Math.floor((Date.now() - latestToken.created_at.getTime()) / 1000);
    if (elapsedSeconds < cooldownSeconds) {
      const remainingSeconds = cooldownSeconds - elapsedSeconds;
      throw new AppError(
        'RATE_LIMIT_EXCEEDED',
        `Please wait ${remainingSeconds} seconds before requesting a new verification email`,
        429,
        { retryAfter: remainingSeconds }
      );
    }
  }
}

export async function verifyAndConsumeToken(
  db: PrismaClient,
  rawToken: string,
  expectedPurpose: TokenPurpose | TokenPurpose[] = 'email_verification'
) {
  const acceptedPurposes: string[] = Array.isArray(expectedPurpose) ? expectedPurpose : [expectedPurpose];
  const tokenHash = hashToken(rawToken);

  const tokenRecord = await db.verificationToken.findUnique({
    where: { token_hash: tokenHash },
    include: {
      user: {
        include: {
          memberships: {
            include: {
              organization: true,
            },
          },
        },
      },
    },
  });

  if (!tokenRecord || !acceptedPurposes.includes(tokenRecord.purpose)) {
    throw new AppError('INVALID_TOKEN', 'Verification token is invalid or expired', 400);
  }

  if (tokenRecord.consumed_at) {
    throw new AppError('TOKEN_ALREADY_USED', 'This verification token has already been used', 400);
  }

  if (new Date() > tokenRecord.expires_at) {
    throw new AppError('TOKEN_EXPIRED', 'This verification token has expired. Please request a new one.', 400);
  }

  // Atomically mark consumed (guards against two concurrent redemptions of the same link)
  const consumed = await db.verificationToken.updateMany({
    where: { id: tokenRecord.id, consumed_at: null },
    data: { consumed_at: new Date() },
  });
  if (consumed.count === 0) {
    throw new AppError('TOKEN_ALREADY_USED', 'This verification token has already been used', 400);
  }

  return tokenRecord;
}

export async function invalidateUserTokens(
  db: PrismaClient,
  userId: string,
  purposes: TokenPurpose[] = ['email_verification', 'password_reset', 'magic_login']
): Promise<number> {
  const result = await db.verificationToken.updateMany({
    where: {
      user_id: userId,
      purpose: { in: purposes },
      consumed_at: null,
    },
    data: { consumed_at: new Date() },
  });

  return result.count;
}

export async function purgeExpiredTokens(db: PrismaClient): Promise<number> {
  const result = await db.verificationToken.deleteMany({
    where: {
      expires_at: { lt: new Date() },
    },
  });

  return result.count;
}
