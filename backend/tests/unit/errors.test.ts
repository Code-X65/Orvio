import { describe, expect, it } from 'vitest';
import { AppError, toErrorResponse } from '../../src/lib/errors.js';

describe('Error Handling Utilities', () => {
  it('creates AppError with code, message, statusCode, and details', () => {
    const error = new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email', 403, {
      userId: '123',
    });

    expect(error.name).toBe('AppError');
    expect(error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(error.message).toBe('Please verify your email');
    expect(error.statusCode).toBe(403);
    expect(error.details).toEqual({ userId: '123' });
  });

  it('formats toErrorResponse with requestId and details', () => {
    const response = toErrorResponse(
      {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { fields: ['email'] },
      },
      'req-xyz'
    );

    expect(response).toEqual({
      status: 'error',
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { fields: ['email'] },
      },
      requestId: 'req-xyz',
    });
  });

  it('formats toErrorResponse without details when details undefined', () => {
    const response = toErrorResponse({
      code: 'UNAUTHORIZED',
      message: 'Missing header',
    });

    expect(response).toEqual({
      status: 'error',
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing header',
      },
    });
  });
});
