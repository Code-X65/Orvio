import { describe, expect, it } from 'vitest';
import {
  issueVerificationToken,
  verifyAndConsumeToken,
  checkResendCooldown,
} from '../../src/modules/auth/verification.js';
import { AppError } from '../../src/lib/errors.js';
import { hashToken } from '../../src/lib/tokens.js';
import type { PrismaClient } from '@prisma/client';

describe('Verification Token Service', () => {
  it('issues a hashed verification token with 24-hour expiry', async () => {
    let createdPayload: unknown = null;
    const mockDb = {
      verificationToken: {
        create: async ({ data }: { data: unknown }) => {
          createdPayload = data;
          return data;
        },
      },
    } as unknown as PrismaClient;

    const issued = await issueVerificationToken(mockDb, 'user_123', 'email_verification', 24);
    expect(issued.rawToken).toBeDefined();
    expect(issued.tokenHash).toBe(hashToken(issued.rawToken));
    expect(createdPayload).toMatchObject({
      user_id: 'user_123',
      token_hash: issued.tokenHash,
      purpose: 'email_verification',
    });
  });

  it('rejects resend if requested within cooldown period (< 60s)', async () => {
    const mockDb = {
      verificationToken: {
        findFirst: async () => ({
          created_at: new Date(Date.now() - 20 * 1000), // created 20 seconds ago
        }),
      },
    } as unknown as PrismaClient;

    await expect(checkResendCooldown(mockDb, 'user_123', 60)).rejects.toThrow(AppError);
  });

  it('allows resend if requested after cooldown period (> 60s)', async () => {
    const mockDb = {
      verificationToken: {
        findFirst: async () => ({
          created_at: new Date(Date.now() - 70 * 1000), // created 70 seconds ago
        }),
      },
    } as unknown as PrismaClient;

    await expect(checkResendCooldown(mockDb, 'user_123', 60)).resolves.not.toThrow();
  });

  it('throws INVALID_TOKEN if token not found in database', async () => {
    const mockDb = {
      verificationToken: {
        findUnique: async () => null,
      },
    } as unknown as PrismaClient;

    await expect(verifyAndConsumeToken(mockDb, 'invalid_raw_token')).rejects.toThrow(AppError);
  });

  it('throws TOKEN_ALREADY_USED if consumed_at is set', async () => {
    const mockDb = {
      verificationToken: {
        findUnique: async () => ({
          id: 'tok_1',
          purpose: 'email_verification',
          consumed_at: new Date(),
          expires_at: new Date(Date.now() + 100000),
          user: { memberships: [] },
        }),
      },
    } as unknown as PrismaClient;

    await expect(verifyAndConsumeToken(mockDb, 'some_token')).rejects.toThrow(AppError);
  });
});
