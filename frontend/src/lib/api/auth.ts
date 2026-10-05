import { api, type RequestOptions } from './client';
import type { AuthUser, AuthOrganization } from '../../stores/auth-store';

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  organizationName: string;
  subdomain: string;
  planCode?: 'inventory' | 'gym' | 'bundle';
  timezone?: string;
  currency?: string;
  termsAccepted?: boolean;
  marketingOptIn?: boolean;
}

export interface RegisterResponse {
  userId: string;
  email: string;
  fullName: string;
  accessToken: string;
  organization: {
    id: string;
    name: string;
    subdomain: string;
    status: string;
    planCode?: string | null;
    url?: string;
  };
}

export interface VerifyEmailPayload {
  token: string;
}

export interface VerifyEmailResponse {
  accessToken?: string;
  user: AuthUser;
  organization: AuthOrganization;
}

export interface ResendVerificationPayload {
  email: string;
}

export interface RefreshSessionResponse {
  accessToken: string;
  user: AuthUser;
  organization: AuthOrganization;
}

export interface CheckSubdomainResponse {
  available: boolean;
  subdomain: string;
  reason?: 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_CHARACTERS' | 'RESERVED' | 'ALREADY_TAKEN';
  suggestions?: string[];
}

export interface CheckEmailResponse {
  available: boolean;
  email: string;
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

export interface CurrentUserResponse {
  user: AuthUser;
  organization: AuthOrganization | null;
  memberships: Array<{
    id: string;
    orgId: string;
    role: string;
    status: string;
  }>;
}

export async function register(payload: RegisterPayload): Promise<RegisterResponse> {
  return api.post<RegisterResponse>('/auth/register', payload);
}

export async function verifyEmail(
  payload: string | VerifyEmailPayload
): Promise<VerifyEmailResponse> {
  const body = typeof payload === 'string' ? { token: payload } : payload;
  return api.post<VerifyEmailResponse>('/auth/verify-email', body);
}

export async function resendVerification(
  payload: string | ResendVerificationPayload
): Promise<{ sent: boolean; message: string }> {
  const body = typeof payload === 'string' ? { email: payload } : payload;
  return api.post<{ sent: boolean; message: string }>('/auth/verify-email/resend', body);
}

export async function refreshSession(): Promise<RefreshSessionResponse> {
  return api.post<RefreshSessionResponse>('/auth/refresh');
}

export async function checkSubdomain(
  subdomain: string,
  options?: RequestOptions
): Promise<CheckSubdomainResponse> {
  return api.get<CheckSubdomainResponse>('/orgs/check-subdomain', {
    ...options,
    params: { subdomain },
  });
}

export async function checkEmail(
  email: string,
  options?: RequestOptions
): Promise<CheckEmailResponse> {
  return api.get<CheckEmailResponse>('/auth/check-email', {
    ...options,
    params: { email },
  });
}

export async function forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>('/auth/forgot-password', { email });
}

export async function resetPassword(
  token: string,
  password: string
): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>('/auth/reset-password', { token, password });
}

export async function logout(): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>('/auth/logout');
}

export interface LoginPayload {
  email: string;
  password: string;
  subdomain?: string;
}

export interface MagicLoginPayload {
  email: string;
  subdomain?: string;
}

export async function requestMagicLogin(payload: MagicLoginPayload): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>('/auth/magic-login', payload);
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  return api.post<LoginResponse>('/auth/login', payload);
}

export async function getCurrentUser(token?: string): Promise<CurrentUserResponse> {
  return api.get<CurrentUserResponse>('/auth/me', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

