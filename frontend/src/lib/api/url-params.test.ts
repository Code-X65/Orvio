import { describe, it, expect } from 'vitest';
import {
  isSafeParamKey,
  sanitizeParamValue,
  sanitizeQueryParams,
  validateParamWithWhitelist,
  validateEntityId,
} from './url-params';

describe('url-params Utility', () => {
  describe('isSafeParamKey', () => {
    it('blocks prototype pollution keys', () => {
      expect(isSafeParamKey('__proto__')).toBe(false);
      expect(isSafeParamKey('constructor')).toBe(false);
      expect(isSafeParamKey('prototype')).toBe(false);
      expect(isSafeParamKey('__PROTO__')).toBe(false);
    });

    it('blocks keys containing control characters or symbols', () => {
      expect(isSafeParamKey('key<script>')).toBe(false);
      expect(isSafeParamKey('key with spaces')).toBe(false);
      expect(isSafeParamKey('')).toBe(false);
    });

    it('allows valid alphanumeric, hyphen, underscore, and dot keys', () => {
      expect(isSafeParamKey('action')).toBe(true);
      expect(isSafeParamKey('productId')).toBe(true);
      expect(isSafeParamKey('branch_id')).toBe(true);
      expect(isSafeParamKey('filter.status')).toBe(true);
    });
  });

  describe('sanitizeParamValue', () => {
    it('returns null for null, undefined, or empty values', () => {
      expect(sanitizeParamValue(null)).toBeNull();
      expect(sanitizeParamValue(undefined)).toBeNull();
      expect(sanitizeParamValue('')).toBeNull();
      expect(sanitizeParamValue('   ')).toBeNull();
    });

    it('strips null bytes and ASCII control characters', () => {
      expect(sanitizeParamValue('hello\x00world')).toBe('helloworld');
      expect(sanitizeParamValue('\x07alert\x1B')).toBe('alert');
    });

    it('handles parameter pollution arrays by choosing the last scalar', () => {
      expect(sanitizeParamValue(['first', 'second', 'final'])).toBe('final');
      expect(sanitizeParamValue(['first', ''])).toBe('first');
    });

    it('rejects nested objects', () => {
      expect(sanitizeParamValue({ bad: 'object' })).toBeNull();
    });

    it('enforces maximum character length', () => {
      const longString = 'a'.repeat(600);
      const sanitized = sanitizeParamValue(longString, 100);
      expect(sanitized?.length).toBe(100);
    });
  });

  describe('sanitizeQueryParams', () => {
    it('filters out prototype pollution keys and sanitizes values', () => {
      const input = {
        action: 'create-product',
        productId: 'prod_123',
        __proto__: { polluted: true },
        constructor: 'exploit',
        empty: '',
        withControl: 'safe\x00value',
      };

      const result = sanitizeQueryParams(input);

      expect(result).toEqual({
        action: 'create-product',
        productId: 'prod_123',
        withControl: 'safevalue',
      });
      expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
      expect((result as any).polluted).toBeUndefined();
    });

    it('enforces allowedKeys whitelist when supplied', () => {
      const input = {
        action: 'view',
        productId: '123',
        forbidden: 'secret',
      };

      const result = sanitizeQueryParams(input, ['action', 'productId']);
      expect(result).toEqual({
        action: 'view',
        productId: '123',
      });
      expect(result.forbidden).toBeUndefined();
    });
  });

  describe('validateParamWithWhitelist', () => {
    const ALLOWED_ACTIONS = ['create', 'edit', 'delete'] as const;

    it('returns approved values matching the whitelist', () => {
      expect(validateParamWithWhitelist('create', ALLOWED_ACTIONS)).toBe('create');
      expect(validateParamWithWhitelist('edit', ALLOWED_ACTIONS)).toBe('edit');
    });

    it('returns null for values outside the whitelist or malicious inputs', () => {
      expect(validateParamWithWhitelist('drop_table', ALLOWED_ACTIONS)).toBeNull();
      expect(validateParamWithWhitelist('<script>', ALLOWED_ACTIONS)).toBeNull();
      expect(validateParamWithWhitelist(null, ALLOWED_ACTIONS)).toBeNull();
    });
  });

  describe('validateEntityId', () => {
    it('accepts valid alphanumeric, hyphen, and underscore IDs', () => {
      expect(validateEntityId('prod_1234567890')).toBe('prod_1234567890');
      expect(validateEntityId('cuid12345')).toBe('cuid12345');
      expect(validateEntityId('usr-abc_def')).toBe('usr-abc_def');
    });

    it('rejects IDs with illegal characters or spaces', () => {
      expect(validateEntityId('prod/123')).toBeNull();
      expect(validateEntityId('prod; DROP TABLE')).toBeNull();
      expect(validateEntityId('prod<script>')).toBeNull();
      expect(validateEntityId(null)).toBeNull();
    });
  });
});
