import { ApiError } from './client';

export type AuthErrorCode =
  | 'TOKEN_EXPIRED'
  | 'REFRESH_EXPIRED'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'ACCOUNT_SUSPENDED'
  | 'MEMBERSHIP_DEACTIVATED';

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number;
  readonly originalError?: Error;

  constructor(
    message: string,
    code: AuthErrorCode,
    status: number,
    originalError?: Error
  ) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
    this.originalError = originalError;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static fromApiError(error: ApiError | Error): AuthError {
    if (error instanceof AuthError) {
      return error;
    }

    if (error instanceof ApiError) {
      if (
        error.code === 'INVALID_REFRESH_TOKEN' ||
        error.code === 'MISSING_REFRESH_TOKEN' ||
        error.code === 'REFRESH_EXPIRED'
      ) {
        return new AuthError(
          'Your session has expired. Please sign in again.',
          'REFRESH_EXPIRED',
          error.status || 401,
          error
        );
      }

      if (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_TOKEN' || error.code === 'TOKEN_EXPIRED') {
        return new AuthError(
          'Authentication required.',
          'TOKEN_EXPIRED',
          error.status || 401,
          error
        );
      }

      if (error.status === 0 || error.code === 'NETWORK_ERROR') {
        return new AuthError(
          'Network error. Please check your connection.',
          'NETWORK_ERROR',
          0,
          error
        );
      }

      return new AuthError(error.message, 'UNAUTHORIZED', error.status || 401, error);
    }

    // Generic Error check
    const msg = error.message || '';
    if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
      return new AuthError('Network error. Please check your connection.', 'NETWORK_ERROR', 0, error);
    }

    return new AuthError(msg || 'Authentication error', 'UNAUTHORIZED', 401, error);
  }
}
