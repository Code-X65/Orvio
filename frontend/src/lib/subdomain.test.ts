import { describe, expect, it } from 'vitest';
import {
  sanitizeSubdomain,
  validateSubdomainFormat,
  RESERVED_SUBDOMAINS,
} from './subdomain';
import fixture from '../test/fixtures/subdomain-cases.json';

describe('Frontend Subdomain Utilities (Shared Fixture Parity)', () => {
  describe('sanitizeSubdomain', () => {
    it('normalizes all fixture cases with diacritic removal matching backend', () => {
      for (const item of fixture.normalizations) {
        expect(sanitizeSubdomain(item.input)).toBe(item.expected);
      }
    });

    it('limits output to 30 characters', () => {
      const longString = 'a'.repeat(50);
      expect(sanitizeSubdomain(longString).length).toBe(30);
    });
  });

  describe('validateSubdomainFormat against shared fixture', () => {
    it('validates 3-30 character alphanumeric strings', () => {
      for (const valid of fixture.validFormats) {
        expect(validateSubdomainFormat(valid).valid).toBe(true);
      }
    });

    it('rejects invalid subdomains matching reason', () => {
      for (const invalid of fixture.invalidFormats) {
        const res = validateSubdomainFormat(invalid.input);
        expect(res.valid).toBe(false);
        expect(res.reason).toBe(invalid.reason);
      }
    });

    it('rejects all reserved subdomains in fixture', () => {
      for (const word of fixture.reserved) {
        expect(RESERVED_SUBDOMAINS.has(word)).toBe(true);
        const res = validateSubdomainFormat(word);
        expect(res.valid).toBe(false);
        expect(res.reason).toBe('RESERVED');
      }
    });
  });
});
