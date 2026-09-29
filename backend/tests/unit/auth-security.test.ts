import { describe, expect, it } from 'vitest';

import { authTiming, createOpaqueToken, hashPassword, hashToken, issueAccessToken, verifyAccessToken, verifyPassword } from '../../src/modules/auth/security.js';

const secret = 'test-secret-that-is-longer-than-32-characters';

describe('authentication security primitives', () => {
  it('hashes passwords with Argon2id and verifies them', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toContain('$argon2id$');
    await expect(verifyPassword(hash, 'correct horse battery staple')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'incorrect')).resolves.toBe(false);
  });

  it('issues a 15-minute JWT with session and jti claims', async () => {
    const token = await issueAccessToken({ sub: 'a7f0321a-f9b3-4bee-93f6-c096f6ef1c03', sid: 'b8e1432b-e8c4-4cff-84e7-d1a7f7ef2d14' }, secret);
    const verified = await verifyAccessToken(token, secret);
    expect(verified.sub).toBe('a7f0321a-f9b3-4bee-93f6-c096f6ef1c03');
    expect(verified.sid).toBe('b8e1432b-e8c4-4cff-84e7-d1a7f7ef2d14');
    expect(verified.jti).toBeDefined();
    expect(typeof verified.jti).toBe('string');
    expect(authTiming.accessTokenLifetimeSeconds).toBe(900);
    expect(authTiming.rememberMeAbsoluteLifetimeMs).toBe(30 * 24 * 60 * 60 * 1000);
    expect(authTiming.rememberMeIdleTimeoutMs).toBe(14 * 24 * 60 * 60 * 1000);
    expect(authTiming.transientAbsoluteLifetimeMs).toBe(12 * 60 * 60 * 1000);
    expect(authTiming.transientIdleTimeoutMs).toBe(30 * 60 * 1000);
    expect(authTiming.rotationGraceWindowMs).toBe(30 * 1000);
  });

  it('supports dual-key rotation fallback with previous secret', async () => {
    const oldSecret = 'old-previous-secret-longer-than-32-chars';
    const newSecret = 'new-active-secret-longer-than-32-chars';
    const oldToken = await issueAccessToken({ sub: 'a7f0321a-f9b3-4bee-93f6-c096f6ef1c03', sid: 'b8e1432b-e8c4-4cff-84e7-d1a7f7ef2d14' }, oldSecret);

    // Fails when verified only against newSecret
    await expect(verifyAccessToken(oldToken, newSecret)).rejects.toThrow();

    // Succeeds when previousSecret is provided
    const verified = await verifyAccessToken(oldToken, newSecret, oldSecret);
    expect(verified.sub).toBe('a7f0321a-f9b3-4bee-93f6-c096f6ef1c03');
  });

  it('creates non-reversible opaque-token hashes', () => {
    const token = createOpaqueToken();
    const nextToken = createOpaqueToken();
    expect(token).toHaveLength(64);
    expect(nextToken).toHaveLength(64);
    expect(nextToken).not.toBe(token);
    expect(hashToken(token)).toHaveLength(64);
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(nextToken)).not.toBe(hashToken(token));
  });
});
