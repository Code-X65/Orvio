import { describe, expect, it, vi } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  assertPasswordPolicy,
  assertPasswordSecurity,
  getPwnedCount,
} from '../../src/lib/password.js';
import { AppError } from '../../src/lib/errors.js';

describe('Password Utilities (Argon2id)', () => {
  it('hashes and verifies matching password', async () => {
    const password = 'SuperSecretPassword123!';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash.startsWith('$argon2id$')).toBe(true);

    const isValid = await verifyPassword(hash, password);
    expect(isValid).toBe(true);
  });

  it('fails verification for incorrect password', async () => {
    const hash = await hashPassword('CorrectPassword123');
    const isValid = await verifyPassword(hash, 'WrongPassword123');
    expect(isValid).toBe(false);
  });

  describe('assertPasswordPolicy', () => {
    it('passes for strong password', () => {
      expect(() => assertPasswordPolicy('ValidPass12345!')).not.toThrow();
    });

    it('throws AppError if shorter than 12 characters', () => {
      expect(() => assertPasswordPolicy('ShortPass1!')).toThrow(AppError);
    });

    it('throws AppError if missing uppercase letter', () => {
      expect(() => assertPasswordPolicy('lowercase12345!')).toThrow(AppError);
    });

    it('throws AppError if missing lowercase letter', () => {
      expect(() => assertPasswordPolicy('UPPERCASE12345!')).toThrow(AppError);
    });

    it('throws AppError if missing digit', () => {
      expect(() => assertPasswordPolicy('NoDigitsHereSpecial!')).toThrow(AppError);
    });

    it('throws AppError if missing special character', () => {
      expect(() => assertPasswordPolicy('ValidPass12345')).toThrow(AppError);
    });
  });

  describe('assertPasswordSecurity', () => {
    it('rejects password containing user email local part', async () => {
      await expect(
        assertPasswordSecurity('SuperAlexander123!', { email: 'alexander@example.com' })
      ).rejects.toThrow(AppError);
    });

    it('rejects password containing user name', async () => {
      await expect(
        assertPasswordSecurity('JohnsonSecure2026#', { fullName: 'Bob Johnson' })
      ).rejects.toThrow(AppError);
    });

    it('allows strong unique password without personal info', async () => {
      await expect(
        assertPasswordSecurity('K9#mX2$vL9pQ8wZ!', { email: 'john@example.com', fullName: 'John Doe' })
      ).resolves.toBeUndefined();
    });
  });
});
