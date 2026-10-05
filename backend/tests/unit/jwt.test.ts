import { describe, expect, it } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  generateOpaqueToken,
  generateRefreshToken,
  hashToken,
} from '../../src/modules/auth/jwt.js';

describe('JWT & Token Utilities', () => {
  it('signs and verifies access tokens', async () => {
    const payload = {
      sub: 'usr_123',
      email: 'alex@example.com',
      org_id: 'org_123',
      role: 'owner',
    };

    const token = await signAccessToken(payload);
    expect(typeof token).toBe('string');

    const decoded = await verifyAccessToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe('usr_123');
    expect(decoded?.email).toBe('alex@example.com');
  });

  it('returns null when verifying an invalid token', async () => {
    const decoded = await verifyAccessToken('invalid.jwt.token');
    expect(decoded).toBeNull();
  });

  it('generates opaque verification token and matching SHA-256 hash', () => {
    const { rawToken, tokenHash } = generateOpaqueToken();
    expect(rawToken.length).toBe(64); // 32 bytes in hex = 64 chars
    expect(tokenHash).toBe(hashToken(rawToken));
  });

  it('generates refresh token with unique jti', () => {
    const { rawToken, tokenHash, jti } = generateRefreshToken();
    expect(rawToken.length).toBe(64);
    expect(tokenHash).toBe(hashToken(rawToken));
    expect(jti).toBeDefined();
  });
});
