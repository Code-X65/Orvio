import { describe, expect, it } from 'vitest';
import {
  normalizeOrganizationName,
  deriveSubdomain,
  assertValidSubdomain,
  isReserved,
  nextAvailableCandidates,
} from '../../src/modules/organizations/subdomain.js';
import { AppError } from '../../src/lib/errors.js';
import fixture from '../fixtures/subdomain-cases.json';

describe('Subdomain Utilities (Pure & Shared Fixture Parity)', () => {
  describe('normalizeOrganizationName', () => {
    it('trims leading/trailing and condenses multiple whitespace characters', () => {
      expect(normalizeOrganizationName('   Prime   Global   Store   ')).toBe('Prime Global Store');
      expect(normalizeOrganizationName('Apex Gym')).toBe('Apex Gym');
    });
  });

  describe('deriveSubdomain against shared fixtures', () => {
    it('normalizes all fixture cases correctly', () => {
      for (const item of fixture.normalizations) {
        expect(deriveSubdomain(item.input)).toBe(item.expected);
      }
    });

    it('limits derived subdomain length to 30 characters', () => {
      const longName = 'Very Long Business Name That Exceeds Thirty Characters Easily';
      const derived = deriveSubdomain(longName);
      expect(derived.length).toBe(30);
      expect(derived).toBe('verylongbusinessnamethatexceed');
    });
  });

  describe('isReserved', () => {
    it('returns true for all fixture reserved subdomains', () => {
      for (const word of fixture.reserved) {
        expect(isReserved(word)).toBe(true);
        expect(isReserved(word.toUpperCase())).toBe(true);
      }
    });

    it('returns false for custom tenant subdomains', () => {
      expect(isReserved('mygym')).toBe(false);
      expect(isReserved('acmestore')).toBe(false);
    });
  });

  describe('assertValidSubdomain against valid/invalid fixtures', () => {
    it('does not throw for fixture valid subdomains', () => {
      for (const sub of fixture.validFormats) {
        expect(() => assertValidSubdomain(sub)).not.toThrow();
      }
    });

    it('throws AppError for fixture invalid subdomains', () => {
      for (const item of fixture.invalidFormats) {
        expect(() => assertValidSubdomain(item.input)).toThrow(AppError);
      }
    });

    it('throws AppError for reserved subdomains', () => {
      for (const word of fixture.reserved) {
        expect(() => assertValidSubdomain(word)).toThrow(AppError);
      }
    });
  });

  describe('nextAvailableCandidates', () => {
    it('generates specified number of valid candidate suggestions', () => {
      const candidates = nextAvailableCandidates('prime', 3);
      expect(candidates.length).toBe(3);
      candidates.forEach((c) => {
        expect(c.startsWith('prime')).toBe(true);
        expect(c.length).toBeGreaterThanOrEqual(3);
        expect(c.length).toBeLessThanOrEqual(30);
        expect(isReserved(c)).toBe(false);
      });
    });
  });
});
