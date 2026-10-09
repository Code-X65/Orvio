import { useAuthStore } from '../../stores/auth-store';
import { getSubdomainFromHostname } from '../../app/config/authUrls';

export interface ApiErrorOptions {
  code?: string;
  status: number;
  details?: Record<string, unknown>;
  requestId?: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;

  constructor(message: string, options: ApiErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code ?? 'UNKNOWN_ERROR';
    this.status = options.status;
    this.details = options.details;
    this.requestId = options.requestId;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  _retry?: boolean;
}

export interface ApiResponseEnvelope<T> {
  status?: string;
  data?: T;
  meta?: {
    requestId?: string;
  };
}

export interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId?: string;
  };
  requestId?: string;
  message?: string;
  code?: string;
}

const DEFAULT_BASE_URL = 'http://localhost:3000/api/v1';

export function getBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  return DEFAULT_BASE_URL;
}

function isJwtValid(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + 10000;
  } catch {
    return false;
  }
}

// Single-flight refresh mutex
let refreshPromise: Promise<string | null> | null = null;

async function executeTokenRefresh(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const runNetworkRefresh = async (): Promise<string | null> => {
    try {
      const baseUrl = getBaseUrl();
      const currentSub = getSubdomainFromHostname();
      const response = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentSub ? { 'x-tenant-subdomain': currentSub } : {}),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        useAuthStore.getState().clearSession();
        return null;
      }

      const json = await response.json();
      const payload = json?.data ?? json;
      const newAccessToken = payload?.accessToken;

      if (newAccessToken && payload?.user && payload?.organization) {
        useAuthStore.getState().setSession(
          newAccessToken,
          payload.user,
          payload.organization,
          payload.user.emailVerifiedAt ? 'authenticated' : 'pending-verification'
        );
        return newAccessToken;
      } else if (newAccessToken) {
        useAuthStore.getState().setAccessToken(newAccessToken);
        return newAccessToken;
      }

      useAuthStore.getState().clearSession();
      return null;
    } catch {
      useAuthStore.getState().clearSession();
      return null;
    }
  };

  refreshPromise = (async () => {
    try {
      // Enterprise Web Locks API: coordinates across all open browser tabs
      if (typeof navigator !== 'undefined' && 'locks' in navigator) {
        return await navigator.locks.request('orvio_auth_refresh_lock', async () => {
          // If another tab refreshed while we waited for the cross-tab lock, reuse that token
          const currentToken = useAuthStore.getState().accessToken;
          if (currentToken && isJwtValid(currentToken)) {
            return currentToken;
          }
          return await runNetworkRefresh();
        });
      }
      return await runNetworkRefresh();
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// In-flight GET request deduplication map
const inFlightGetRequests = new Map<string, Promise<any>>();

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const baseUrl = getBaseUrl();
  const url = endpoint.startsWith('http')
    ? new URL(endpoint)
    : new URL(`${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`);

  if (options.params) {
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        url.searchParams.append(key, String(val));
      }
    });
  }

  const token = useAuthStore.getState().accessToken;
  const currentSubdomain = getSubdomainFromHostname();

  // Deduplicate concurrent identical GET requests
  const isGet = method === 'GET' && !options.body;
  const inFlightKey = isGet
    ? `GET:${url.toString()}:${currentSubdomain || ''}:${token ? token.slice(-16) : 'anon'}`
    : null;

  if (inFlightKey && inFlightGetRequests.has(inFlightKey)) {
    return inFlightGetRequests.get(inFlightKey) as Promise<T>;
  }

  const executeRequest = async (): Promise<T> => {
    const { body, headers: customHeaders, _retry = false, signal, ...fetchOptions } = options;

    const headers = new Headers(customHeaders);

    if (!headers.has('Content-Type') && body !== undefined && !(body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (currentSubdomain && !headers.has('x-tenant-subdomain')) {
      headers.set('x-tenant-subdomain', currentSubdomain);
    }

    const requestBody =
      body !== undefined && !(body instanceof FormData) ? JSON.stringify(body) : (body as BodyInit | null | undefined);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        ...fetchOptions,
        method,
        headers,
        body: requestBody,
        credentials: 'include',
        signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      const errorMsg = err instanceof Error ? err.message : 'Network request failed';
      throw new ApiError(errorMsg, {
        code: 'NETWORK_ERROR',
        status: 0,
      });
    }

    // Handle 401 Unauthorized single-flight refresh & retry
    const isAuthEndpoint =
      endpoint.includes('/auth/refresh') ||
      endpoint.includes('/auth/login') ||
      endpoint.includes('/auth/register');

    if (response.status === 401 && !_retry && !isAuthEndpoint) {
      const newToken = await executeTokenRefresh();
      if (newToken) {
        return apiClient<T>(endpoint, {
          ...options,
          _retry: true,
        });
      }
    }

    // Parse JSON response
    let responseData: unknown = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch {
        responseData = null;
      }
    }

    if (!response.ok) {
      const errEnvelope = responseData as ApiErrorEnvelope | null;
      const errorMessage =
        errEnvelope?.error?.message ||
        errEnvelope?.message ||
        response.statusText ||
        'An unexpected error occurred';
      const errorCode = errEnvelope?.error?.code || errEnvelope?.code || 'API_ERROR';
      const errorDetails = errEnvelope?.error?.details;
      const requestId = errEnvelope?.requestId || errEnvelope?.meta?.requestId;

      throw new ApiError(errorMessage, {
        code: errorCode,
        status: response.status,
        details: errorDetails,
        requestId,
      });
    }

    // Unwrap envelope `{ data: ... }` if present
    if (responseData && typeof responseData === 'object' && 'data' in responseData) {
      return (responseData as ApiResponseEnvelope<T>).data as T;
    }

    return responseData as T;
  };

  if (inFlightKey) {
    const promise = executeRequest().finally(() => {
      inFlightGetRequests.delete(inFlightKey);
    });
    inFlightGetRequests.set(inFlightKey, promise);
    return promise;
  }

  return executeRequest();
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'POST', body }),
  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'PUT', body }),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'PATCH', body }),
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'DELETE' }),
};
