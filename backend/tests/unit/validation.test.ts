import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppError } from '../../src/lib/app-error.js';
import { validate } from '../../src/lib/validation.js';

describe('validate', () => {
  it('returns validated data', () => {
    expect(validate(z.object({ name: z.string().min(1) }), { name: 'Orvio' })).toEqual({ name: 'Orvio' });
  });

  it('normalizes invalid input as a contract-safe validation error', () => {
    try {
      validate(z.object({ name: z.string().min(1) }), { name: '' });
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR', message: 'Invalid request.' } satisfies Partial<AppError>);
    }
  });
});
