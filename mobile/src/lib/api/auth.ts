import { api } from './client';
import type { AuthUser, AuthOrganization } from '../../stores/auth-store';

export interface CheckSubdomainResponse {
  available: boolean;
  subdomain: string;
  reason?: 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_CHARACTERS' | 'RESERVED' | 'ALREADY_TAKEN';
  suggestions?: string[];
}

export interface LoginPayload {
  email: string;
  password: string;
  subdomain?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
  organization: AuthOrganization;
}

export interface RefreshSessionResponse {
  accessToken: string;
  user: AuthUser;
  organization: AuthOrganization;
}

export interface MagicLoginPayload {
  email: string;
  subdomain?: string;
}

export async function checkSubdomain(subdomain: string): Promise<CheckSubdomainResponse> {
  return api.get<CheckSubdomainResponse>('/orgs/check-subdomain', {
    params: { subdomain },
    skipAuth: true,
  });
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  return api.post<LoginResponse>('/auth/login', payload, { skipAuth: true });
}

export async function requestMagicLogin(payload: MagicLoginPayload): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>('/auth/magic-login', payload, { skipAuth: true });
}

export async function refreshSession(): Promise<RefreshSessionResponse> {
  return api.post<RefreshSessionResponse>('/auth/refresh', undefined, { skipAuth: true });
}

export async function logout(): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>('/auth/logout');
}

export async function getCurrentUser(): Promise<{ user: AuthUser; organization: AuthOrganization | null }> {
  return api.get<{ user: AuthUser; organization: AuthOrganization | null }>('/auth/me');
}
