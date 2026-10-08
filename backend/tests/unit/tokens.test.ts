import { describe, expect, it } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  generateOpaqueToken,
  generateRefreshToken,
  hashToken,
} from '../../src/lib/tokens.js';

describe('JWT & Token Utilities', () => {
  it('signs and verifies access tokens', async () => {
    const claims = {
      sub: 'usr_123',
      email: 'alex@example.com',
      org_id: 'org_123',
      role: 'owner',
    };

    const token = await signAccessToken(claims);
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
    expect(rawToken.length).toBe(64); // 32 bytes hex = 64 chars
    expect(tokenHash).toBe(hashToken(rawToken));
  });

  it('generates refresh token with unique jti and hash', () => {
    const { rawToken, tokenHash, jti } = generateRefreshToken();
    expect(rawToken.length).toBe(64);
    expect(tokenHash).toBe(hashToken(rawToken));
    expect(jti).toBeDefined();
  });

  it('supports JWT key rotation with multiple key IDs', async () => {
    const { registerJwtKey, getPublicJwks } = await import('../../src/lib/tokens.js');
    
    // Register rotated key
    const rotatedKid = 'rotation_2026_q4';
    const rotatedSecret = 'a_very_secure_32_character_rotated_secret_key!!';
    registerJwtKey(rotatedKid, rotatedSecret);

    // Sign with rotated key
    const token = await signAccessToken(
      { sub: 'usr_rot', email: 'rot@example.com' },
      { keyId: rotatedKid, secret: rotatedSecret }
    );

    // Verify automatically using key registry
    const decoded = await verifyAccessToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe('usr_rot');

    // Verify JWKS contains both keys
    const jwks = getPublicJwks();
    expect(jwks.keys.length).toBeGreaterThanOrEqual(2);
    expect(jwks.keys.some((k) => k.kid === rotatedKid)).toBe(true);
    expect(jwks.keys.some((k) => k.kid === 'primary')).toBe(true);
  });
});
