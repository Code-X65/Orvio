import { ApiError } from './client';
import { AuthError } from './error-types';

export type ErrorCategory =
  | 'network'
  | 'database'
  | 'server'
  | 'auth'
  | 'rate-limit'
  | 'validation'
  | 'client'
  | 'unknown';

export interface ParsedError {
  title: string;
  description: string;
  category: ErrorCategory;
  isNetwork: boolean;
  isDatabase: boolean;
  isServer: boolean;
  isAuth: boolean;
  canRetry: boolean;
  statusCode?: number;
  code?: string;
  requestId?: string;
  debugDetails?: string;
}

/**
 * Strips raw code snippets, filepaths, and stack traces from any error string.
 */
function sanitizeMessage(raw: string): string {
  if (!raw) return '';
  // Detect if message contains file paths, newlines with code, or Prisma/DB stack
  const containsCodeOrStack =
    raw.includes('\n') ||
    raw.includes('/home/') ||
    raw.includes('/src/') ||
    raw.includes('invocation in') ||
    raw.includes('connection pool') ||
    raw.includes('PrismaClient');

  if (containsCodeOrStack) {
    return '';
  }
  return raw.trim();
}

/**
 * Centralized parser that translates low-level errors into human-friendly,
 * actionable diagnostics and UI copy.
 */
export function parseApiError(err: unknown, fallbackMessage?: string): ParsedError {
  // Case 0: AuthError (explicit session/refresh expiry or auth failure)
  if (err instanceof AuthError) {
    if (err.code === 'REFRESH_EXPIRED') {
      return {
        title: 'Session Expired',
        description: err.message || 'Your session has expired. Please sign in again.',
        category: 'auth',
        isNetwork: false,
        isDatabase: false,
        isServer: false,
        isAuth: true,
        canRetry: false,
        statusCode: err.status,
        code: 'REFRESH_EXPIRED',
      };
    }
    if (err.code === 'TOKEN_EXPIRED') {
      return {
        title: 'Authentication Required',
        description: err.message || 'Your authentication token is invalid or expired. Please sign in again.',
        category: 'auth',
        isNetwork: false,
        isDatabase: false,
        isServer: false,
        isAuth: true,
        canRetry: false,
        statusCode: err.status,
        code: 'TOKEN_EXPIRED',
      };
    }
    if (err.code === 'NETWORK_ERROR') {
      return {
        title: 'Network Error',
        description: err.message || 'Network error. Please check your connection and try again.',
        category: 'network',
        isNetwork: true,
        isDatabase: false,
        isServer: false,
        isAuth: false,
        canRetry: true,
        statusCode: 0,
        code: 'NETWORK_ERROR',
      };
    }
    return {
      title: 'Access Restricted',
      description: err.message || 'You are not authorized to perform this action.',
      category: 'auth',
      isNetwork: false,
      isDatabase: false,
      isServer: false,
      isAuth: true,
      canRetry: false,
      statusCode: err.status,
      code: err.code,
    };
  }
  // Case 1: Already a string
  if (typeof err === 'string') {
    const clean = sanitizeMessage(err);
    return {
      title: 'Unable to Complete Request',
      description: clean || fallbackMessage || 'An unexpected error occurred. Please try again.',
      category: 'unknown',
      isNetwork: false,
      isDatabase: false,
      isServer: false,
      isAuth: false,
      canRetry: true,
    };
  }

  // Case 2: Structured ApiError from client
  if (err instanceof ApiError) {
    const status = err.status;
    const code = err.code;
    const requestId = err.requestId;
    const rawMsg = err.message || '';
    const cleanMsg = sanitizeMessage(rawMsg);

    // Network disconnection / fetch failure (status 0)
    if (status === 0 || code === 'NETWORK_ERROR') {
      const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      return {
        title: isBrowserOffline ? 'You Are Offline' : 'Network Connection Lost',
        description: isBrowserOffline
          ? 'Your device is not connected to the internet. Please check your network connection.'
          : 'Unable to reach the Orvio servers. Please check your connection and try again.',
        category: 'network',
        isNetwork: true,
        isDatabase: false,
        isServer: false,
        isAuth: false,
        canRetry: true,
        statusCode: 0,
        code: 'NETWORK_ERROR',
        requestId,
        debugDetails: rawMsg,
      };
    }

    // Database unavailable / connection pool exhaustion (503 or code DATABASE_UNAVAILABLE)
    if (status === 503 || code === 'DATABASE_UNAVAILABLE') {
      return {
        title: 'Service Temporarily Busy',
        description:
          cleanMsg && cleanMsg !== 'An internal server error occurred'
            ? cleanMsg
            : 'Our database is experiencing high demand or temporary maintenance. Please try again in a few moments.',
        category: 'database',
        isNetwork: false,
        isDatabase: true,
        isServer: true,
        isAuth: false,
        canRetry: true,
        statusCode: status,
        code: code || 'DATABASE_UNAVAILABLE',
        requestId,
        debugDetails: rawMsg,
      };
    }

    // Rate limited (429)
    if (status === 429 || code === 'RATE_LIMIT_EXCEEDED') {
      return {
        title: 'Too Many Requests',
        description: 'You have made too many requests in a short period. Please slow down and try again shortly.',
        category: 'rate-limit',
        isNetwork: false,
        isDatabase: false,
        isServer: false,
        isAuth: false,
        canRetry: true,
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        requestId,
      };
    }

    // Gateway / Server timeout (504)
    if (status === 504 || code === 'GATEWAY_TIMEOUT') {
      return {
        title: 'Request Timed Out',
        description: 'The server took too long to respond. Please check your network and try again.',
        category: 'server',
        isNetwork: true,
        isDatabase: false,
        isServer: true,
        isAuth: false,
        canRetry: true,
        statusCode: 504,
        code: 'GATEWAY_TIMEOUT',
        requestId,
      };
    }

    // Bad gateway / Proxy down (502)
    if (status === 502) {
      return {
        title: 'Server Temporarily Unreachable',
        description: 'The Orvio gateway is unable to reach the application server. We are looking into this.',
        category: 'server',
        isNetwork: false,
        isDatabase: false,
        isServer: true,
        isAuth: false,
        canRetry: true,
        statusCode: 502,
        code: 'BAD_GATEWAY',
        requestId,
      };
    }

    // Authentication / Session expired (401)
    if (status === 401 || code === 'UNAUTHORIZED' || code === 'INVALID_TOKEN') {
      return {
        title: 'Session Expired',
        description: 'Your session has expired or is no longer valid. Please sign in again to continue.',
        category: 'auth',
        isNetwork: false,
        isDatabase: false,
        isServer: false,
        isAuth: true,
        canRetry: false,
        statusCode: 401,
        code,
        requestId,
      };
    }

    // Forbidden / Access denied (403)
    if (status === 403 || code === 'FORBIDDEN') {
      return {
        title: 'Access Restricted',
        description: cleanMsg || 'You do not have permission to view or manage this workspace resource.',
        category: 'auth',
        isNetwork: false,
        isDatabase: false,
        isServer: false,
        isAuth: true,
        canRetry: false,
        statusCode: 403,
        code,
        requestId,
      };
    }

    // General 500 internal server error
    if (status >= 500) {
      return {
        title: 'Unexpected Server Error',
        description:
          cleanMsg && cleanMsg !== 'An internal server error occurred'
            ? cleanMsg
            : 'Something went wrong on our servers. Our team has been notified, please try again in a few moments.',
        category: 'server',
        isNetwork: false,
        isDatabase: false,
        isServer: true,
        isAuth: false,
        canRetry: true,
        statusCode: status,
        code,
        requestId,
        debugDetails: rawMsg,
      };
    }

    // Other 4xx client errors
    return {
      title: 'Unable to Process Request',
      description: cleanMsg || fallbackMessage || 'Please check your inputs and try again.',
      category: 'client',
      isNetwork: false,
      isDatabase: false,
      isServer: false,
      isAuth: false,
      canRetry: true,
      statusCode: status,
      code,
      requestId,
      debugDetails: rawMsg,
    };
  }

  // Case 3: Native JavaScript Error (e.g. browser TypeError: Failed to fetch)
  if (err instanceof Error) {
    const rawMsg = err.message || '';
    const isFetchFailure =
      rawMsg.toLowerCase().includes('failed to fetch') ||
      rawMsg.toLowerCase().includes('networkerror') ||
      rawMsg.toLowerCase().includes('load failed') ||
      rawMsg.toLowerCase().includes('network request failed');

    if (isFetchFailure) {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      return {
        title: isOffline ? 'You Are Offline' : 'Connection Problem',
        description: isOffline
          ? 'You seem to be disconnected from the internet. Please check your connection.'
          : 'Unable to connect to Orvio servers. Please verify your internet connection and try again.',
        category: 'network',
        isNetwork: true,
        isDatabase: false,
        isServer: false,
        isAuth: false,
        canRetry: true,
        statusCode: 0,
        code: 'NETWORK_ERROR',
        debugDetails: rawMsg,
      };
    }

    return {
      title: 'Something Went Wrong',
      description: sanitizeMessage(rawMsg) || fallbackMessage || 'An unexpected error occurred.',
      category: 'unknown',
      isNetwork: false,
      isDatabase: false,
      isServer: false,
      isAuth: false,
      canRetry: true,
      debugDetails: rawMsg,
    };
  }

  // Case 4: Default fallback
  return {
    title: 'Unexpected Error',
    description: fallbackMessage || 'An unexpected error occurred while communicating with the server.',
    category: 'unknown',
    isNetwork: false,
    isDatabase: false,
    isServer: false,
    isAuth: false,
    canRetry: true,
  };
}
