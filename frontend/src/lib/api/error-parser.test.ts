import { describe, it, expect } from 'vitest';
import { parseApiError } from './error-parser';
import { ApiError } from './client';

describe('parseApiError', () => {
  it('parses network connection error (status 0 / NETWORK_ERROR)', () => {
    const error = new ApiError('Failed to fetch', {
      code: 'NETWORK_ERROR',
      status: 0,
      requestId: 'req-net-123',
    });

    const parsed = parseApiError(error);
    expect(parsed.category).toBe('network');
    expect(parsed.isNetwork).toBe(true);
    expect(parsed.canRetry).toBe(true);
    expect(parsed.requestId).toBe('req-net-123');
    expect(parsed.description).toContain('reach the Orvio servers');
  });

  it('parses database pool timeout (503 / DATABASE_UNAVAILABLE)', () => {
    const error = new ApiError('Database service is temporarily unavailable. Please try again shortly.', {
      code: 'DATABASE_UNAVAILABLE',
      status: 503,
      requestId: 'req-db-456',
    });

    const parsed = parseApiError(error);
    expect(parsed.category).toBe('database');
    expect(parsed.isDatabase).toBe(true);
    expect(parsed.title).toBe('Service Temporarily Busy');
    expect(parsed.description).toBe('Database service is temporarily unavailable. Please try again shortly.');
    expect(parsed.requestId).toBe('req-db-456');
  });

  it('sanitizes accidental raw stack traces and file paths', () => {
    const rawLeak =
      'Invalid `db.user.findUnique()` invocation in /home/kali/Documents/Orvio/backend/src/middleware/auth.ts:40:30 Timed out fetching a new connection from the connection pool.';
    const error = new ApiError(rawLeak, {
      code: 'DATABASE_UNAVAILABLE',
      status: 503,
    });

    const parsed = parseApiError(error);
    expect(parsed.description).not.toContain('/home/kali');
    expect(parsed.description).not.toContain('findUnique');
    expect(parsed.description).toContain('database is experiencing high demand');
  });

  it('parses browser native TypeError: Failed to fetch', () => {
    const err = new TypeError('Failed to fetch');
    const parsed = parseApiError(err);
    expect(parsed.category).toBe('network');
    expect(parsed.isNetwork).toBe(true);
    expect(parsed.canRetry).toBe(true);
  });

  it('parses rate limit 429 error', () => {
    const error = new ApiError('Too many requests', {
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
    });

    const parsed = parseApiError(error);
    expect(parsed.category).toBe('rate-limit');
    expect(parsed.title).toBe('Too Many Requests');
  });

  it('parses gateway timeout 504 error', () => {
    const error = new ApiError('Gateway Timeout', {
      code: 'GATEWAY_TIMEOUT',
      status: 504,
    });

    const parsed = parseApiError(error);
    expect(parsed.category).toBe('server');
    expect(parsed.isNetwork).toBe(true);
    expect(parsed.title).toBe('Request Timed Out');
  });
});
