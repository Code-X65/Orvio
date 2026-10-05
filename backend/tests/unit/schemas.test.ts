import { describe, expect, it } from 'vitest';
import {
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginSchema,
  isValidTimezone,
} from '../../src/modules/auth/schemas.js';

describe('Auth Validation Schemas', () => {
  describe('registerSchema', () => {
    it('accepts and normalizes valid registration payload with defaults', () => {
      const parsed = registerSchema.parse({
        email: '  ALEX@EXAMPLE.COM  ',
        password: 'Password123!',
        fullName: '  Alex Adeleke  ',
        organizationName: '  Apex Store  ',
        subdomain: '  apexstore  ',
      });

      expect(parsed.email).toBe('alex@example.com');
      expect(parsed.fullName).toBe('Alex Adeleke');
      expect(parsed.organizationName).toBe('Apex Store');
      expect(parsed.subdomain).toBe('apexstore');
      expect(parsed.plan).toBe('bundle');
      expect(parsed.currency).toBe('NGN');
      expect(parsed.timezone).toBe('Africa/Lagos');
    });

    it('rejects invalid email formats', () => {
      expect(() =>
        registerSchema.parse({
          email: 'not-an-email',
          password: 'Password123!',
          fullName: 'Alex',
          organizationName: 'Org',
          subdomain: 'org123',
        })
      ).toThrow();
    });

    it('rejects passwords that do not meet policy', () => {
      expect(() =>
        registerSchema.parse({
          email: 'alex@example.com',
          password: 'short',
          fullName: 'Alex',
          organizationName: 'Org',
          subdomain: 'org123',
        })
      ).toThrow();
    });

    it('rejects invalid currency', () => {
      expect(() =>
        registerSchema.parse({
          email: 'alex@example.com',
          password: 'Password123!',
          fullName: 'Alex',
          organizationName: 'Org',
          subdomain: 'org123',
          currency: 'INVALID_CURRENCY',
        })
      ).toThrow();
    });

    it('validates timezone support', () => {
      expect(isValidTimezone('Africa/Lagos')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
    });
  });

  describe('verifyEmailSchema', () => {
    it('requires non-empty token', () => {
      expect(verifyEmailSchema.parse({ token: 'abc123token' }).token).toBe('abc123token');
      expect(() => verifyEmailSchema.parse({ token: '' })).toThrow();
    });
  });

  describe('resendVerificationSchema', () => {
    it('normalizes email address', () => {
      const parsed = resendVerificationSchema.parse({ email: '  User@Example.COM  ' });
      expect(parsed.email).toBe('user@example.com');
    });
  });

  describe('loginSchema', () => {
    it('validates email and non-empty password', () => {
      const parsed = loginSchema.parse({ email: 'user@example.com', password: 'secretpassword' });
      expect(parsed.email).toBe('user@example.com');
    });
  });
});
