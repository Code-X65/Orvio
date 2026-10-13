import { describe, it, expect } from 'vitest';
import { AuthError } from './error-types';
import { ApiError } from './client';

describe('AuthError', () => {
  it('instantiates AuthError with code, status and originalError', () => {
    const orig = new Error('original');
    const err = new AuthError('Session expired', 'REFRESH_EXPIRED', 401, orig);

    expect(err.name).toBe('AuthError');
    expect(err.message).toBe('Session expired');
    expect(err.code).toBe('REFRESH_EXPIRED');
    expect(err.status).toBe(401);
    expect(err.originalError).toBe(orig);
  });

  describe('fromApiError', () => {
    it('maps INVALID_REFRESH_TOKEN to REFRESH_EXPIRED', () => {
      const apiErr = new ApiError('Invalid token', {
        code: 'INVALID_REFRESH_TOKEN',
        status: 401,
      });
      const authErr = AuthError.fromApiError(apiErr);

      expect(authErr.code).toBe('REFRESH_EXPIRED');
      expect(authErr.status).toBe(401);
      expect(authErr.message).toBe('Your session has expired. Please sign in again.');
    });

    it('maps MISSING_REFRESH_TOKEN to REFRESH_EXPIRED', () => {
      const apiErr = new ApiError('No cookie', {
        code: 'MISSING_REFRESH_TOKEN',
        status: 401,
      });
      const authErr = AuthError.fromApiError(apiErr);

      expect(authErr.code).toBe('REFRESH_EXPIRED');
      expect(authErr.status).toBe(401);
    });

    it('maps UNAUTHORIZED / INVALID_TOKEN to TOKEN_EXPIRED', () => {
      const apiErr = new ApiError('Unauthorized', {
        code: 'UNAUTHORIZED',
        status: 401,
      });
      const authErr = AuthError.fromApiError(apiErr);

      expect(authErr.code).toBe('TOKEN_EXPIRED');
      expect(authErr.message).toBe('Authentication required.');
    });

    it('maps status 0 or NETWORK_ERROR to NETWORK_ERROR', () => {
      const apiErr = new ApiError('Failed to fetch', {
        code: 'NETWORK_ERROR',
        status: 0,
      });
      const authErr = AuthError.fromApiError(apiErr);

      expect(authErr.code).toBe('NETWORK_ERROR');
      expect(authErr.status).toBe(0);
      expect(authErr.message).toBe('Network error. Please check your connection.');
    });

    it('returns existing AuthError unchanged', () => {
      const existing = new AuthError('test', 'REFRESH_EXPIRED', 401);
      expect(AuthError.fromApiError(existing)).toBe(existing);
    });
  });
});
