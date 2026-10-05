import { Platform } from 'react-native';
import { useAuthStore } from '../../stores/auth-store';

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function getDefaultApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // Local development defaults for simulators/emulators
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api/v1';
  }

  return 'http://localhost:3000/api/v1';
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  skipAuth?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

async function executeTokenRefresh(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const baseUrl = getDefaultApiBaseUrl();
      const response = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        await useAuthStore.getState().clearSession();
        return null;
      }

      const json = await response.json();
      const payload = json?.data ?? json;
      const newAccessToken = payload?.accessToken;

      if (newAccessToken && payload?.user && payload?.organization) {
        await useAuthStore.getState().setSession(
          newAccessToken,
          payload.user,
          payload.organization,
          payload.user.emailVerifiedAt ? 'authenticated' : 'pending-verification'
        );
        return newAccessToken;
      } else if (newAccessToken) {
        await useAuthStore.getState().setAccessToken(newAccessToken);
        return newAccessToken;
      }

      await useAuthStore.getState().clearSession();
      return null;
    } catch {
      await useAuthStore.getState().clearSession();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const baseUrl = getDefaultApiBaseUrl();
  const url = endpoint.startsWith('http')
    ? new URL(endpoint)
    : new URL(`${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`);

  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken && !options.skipAuth && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const subdomain = useAuthStore.getState().activeSubdomain;
  if (subdomain && !headers['X-Organization-Subdomain']) {
    headers['X-Organization-Subdomain'] = subdomain;
  }

  let body: BodyInit | undefined = undefined;
  if (options.body !== undefined) {
    body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      ...options,
      headers,
      body,
    });
  } catch (err: any) {
    throw new ApiError('NETWORK_ERROR', err?.message || 'Failed to connect to Orvio server', 0);
  }

  // Handle 401 token refresh automatically
  if (response.status === 401 && !options.skipAuth && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/login')) {
    const newToken = await executeTokenRefresh();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      try {
        response = await fetch(url.toString(), {
          ...options,
          headers,
          body,
        });
      } catch (err: any) {
        throw new ApiError('NETWORK_ERROR', err?.message || 'Network request failed on retry', 0);
      }
    }
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const responseData = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    if (isJson && responseData && typeof responseData === 'object') {
      const errObj = responseData.error || responseData;
      throw new ApiError(
        errObj.code || 'API_ERROR',
        errObj.message || 'An error occurred while processing your request',
        response.status,
        errObj.details
      );
    }
    throw new ApiError('HTTP_ERROR', `HTTP ${response.status}: ${response.statusText}`, response.status);
  }

  if (isJson && responseData && typeof responseData === 'object' && 'data' in responseData) {
    return responseData.data as T;
  }

  return responseData as T;
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
