import { describe, it, expect } from 'vitest';
import { assertPasswordPolicy } from '../../src/lib/password.js';
import { AppError } from '../../src/lib/errors.js';

describe('assertPasswordPolicy (Unit)', () => {
  it('passes for strong compliant passwords', () => {
    expect(() => assertPasswordPolicy('ValidPass12345!')).not.toThrow();
    expect(() => assertPasswordPolicy('SuperSecret99#')).not.toThrow();
  });

  it('rejects passwords shorter than 12 characters', () => {
    expect(() => assertPasswordPolicy('Pass1!')).toThrowError(AppError);
    expect(() => assertPasswordPolicy('ShortPass1!')).toThrowError(AppError);
  });

  it('rejects passwords missing uppercase letters', () => {
    expect(() => assertPasswordPolicy('password12345!')).toThrowError(AppError);
  });

  it('rejects passwords missing lowercase letters', () => {
    expect(() => assertPasswordPolicy('PASSWORD12345!')).toThrowError(AppError);
  });

  it('rejects passwords missing numbers', () => {
    expect(() => assertPasswordPolicy('PasswordNoNumber!')).toThrowError(AppError);
  });

  it('rejects passwords missing special characters', () => {
    expect(() => assertPasswordPolicy('PasswordNoSpecial123')).toThrowError(AppError);
  });
});
