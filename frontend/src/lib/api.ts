import { useAuthStore } from '../stores/auth-store';
import { identifyUser, resetIdentity } from './analytics';

export interface ApiMeta { requestId: string }
export interface ApiEnvelope<T> { data: T; meta: ApiMeta }
export interface ApiFailure { error: { code: string; message: string; details?: unknown; requestId?: string } }
export class ApiError extends Error { public constructor(public readonly code: string, message: string, public readonly status: number, public readonly requestId?: string, public readonly details?: unknown) { super(message); this.name = 'ApiError'; } }
export class NetworkError extends Error { public constructor() { super('Unable to reach Orvio. Check your connection and try again.'); this.name = 'NetworkError'; } }

function configuredApiBaseUrl(): string {
  const value = (import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:3000/api/v1' : undefined))?.replace(/\/$/, '');
  if (!value) throw new Error('VITE_API_BASE_URL must be configured for production builds.');
  try { const url = new URL(value); if (!/^https?:$/.test(url.protocol)) throw new Error(); return value; } catch { throw new Error('VITE_API_BASE_URL must be a valid HTTP(S) URL.'); }
}
const apiBaseUrl = configuredApiBaseUrl();
let refreshInFlight: Promise<boolean> | null = null;
function isApiFailure(payload: unknown): payload is ApiFailure { return typeof payload === 'object' && payload !== null && 'error' in payload; }
function requestId(): string { return globalThis.crypto?.randomUUID?.() ?? `web-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
export function apiUrl(path: string): string { return `${apiBaseUrl}/${path.replace(/^\//, '')}`; }

async function sendRequest<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers); headers.set('accept', 'application/json'); headers.set('x-request-id', requestId());
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json'); if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  let response: Response; try { response = await fetch(apiUrl(path), { ...init, headers, credentials: 'include' }); } catch { throw new NetworkError(); }
  const payload: unknown = await response.json().catch(() => null);
  if (isApiFailure(payload)) throw new ApiError(payload.error.code, payload.error.message, response.status, payload.error.requestId, payload.error.details);
  if (!response.ok) throw new ApiError('HTTP_ERROR', 'The request could not be completed.', response.status, response.headers.get('x-request-id') ?? undefined);
  if (typeof payload !== 'object' || payload === null || !('data' in payload) || !('meta' in payload)) throw new ApiError('INVALID_RESPONSE', 'The API returned an invalid response.', response.status);
  return payload as ApiEnvelope<T>;
}

export interface AuthSession { accessToken: string; user: { id: string; email: string; firstName: string | null; lastName: string | null; phone: string | null; emailVerified: boolean; phoneVerified: boolean; passwordSet: boolean }; onboarding: { stage: 'PROFILE' | 'EMAIL_VERIFICATION' | 'PHONE_VERIFICATION' | 'COMPLETE'; completed: boolean }; }
export async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) refreshInFlight = sendRequest<AuthSession>('auth/refresh', { method: 'POST' }).then(({ data }) => { useAuthStore.getState().setSession(data); identifyUser(data.user.id); return true; }).catch((error) => { if (error instanceof ApiError && error.status === 401) { useAuthStore.getState().clearSession(); resetIdentity(); } else useAuthStore.getState().setSessionUnavailable(true); return false; }).finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}
export async function apiRequest<T>(path: string, init: RequestInit = {}, accessToken = useAuthStore.getState().accessToken ?? undefined): Promise<ApiEnvelope<T>> {
  try { return await sendRequest<T>(path, init, accessToken); } catch (error) { const isAuthEndpoint = /^\/?auth\/(login|register|refresh|reset-password|verify-email)/.test(path); if (error instanceof ApiError && error.status === 401 && !isAuthEndpoint && await refreshSession()) return sendRequest<T>(path, init, useAuthStore.getState().accessToken ?? undefined); throw error; }
}
