import { describe, it, expect } from 'vitest';
import { getSupportedTimezones, isValidTimezone } from './timezones';
import { SUPPORTED_CURRENCIES, SUPPORTED_CURRENCY_CODES, getCurrencyByCode } from './currencies';

describe('Shared Domain Utilities', () => {
  describe('Timezones', () => {
    it('returns a populated list of timezone options', () => {
      const timezones = getSupportedTimezones();
      expect(timezones.length).toBeGreaterThan(5);
      expect(timezones.some((tz) => tz.value === 'Africa/Lagos')).toBe(true);
    });

    it('validates timezone strings correctly', () => {
      expect(isValidTimezone('Africa/Lagos')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
    });
  });

  describe('Currencies', () => {
    it('includes required core currencies', () => {
      expect(SUPPORTED_CURRENCY_CODES).toContain('NGN');
      expect(SUPPORTED_CURRENCY_CODES).toContain('USD');
      expect(SUPPORTED_CURRENCY_CODES).toContain('GBP');
      expect(SUPPORTED_CURRENCY_CODES).toContain('EUR');
    });

    it('finds currency by code case-insensitively', () => {
      const ngn = getCurrencyByCode('ngn');
      expect(ngn?.code).toBe('NGN');
      expect(ngn?.symbol).toBe('₦');

      const usd = getCurrencyByCode('USD');
      expect(usd?.symbol).toBe('$');

      expect(getCurrencyByCode('XYZ')).toBeUndefined();
    });
  });
});
