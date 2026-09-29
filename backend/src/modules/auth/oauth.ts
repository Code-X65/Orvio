import { createRemoteJWKSet, jwtVerify } from 'jose';

import type { AppEnv } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';

export type OAuthProviderName = 'google' | 'facebook';
export interface ProviderProfile { subject: string; email: string }

function callbackUrl(env: AppEnv, provider: OAuthProviderName): string {
  return new URL(`/api/v1/auth/oauth/${provider}/callback`, env.PUBLIC_API_URL).toString();
}

export function isOAuthProvider(value: string): value is OAuthProviderName { return value === 'google' || value === 'facebook'; }

export function providerAuthorizationUrl(env: AppEnv, provider: OAuthProviderName, state: string, nonce: string): string {
  if (provider === 'google') {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new AppError(503, 'OAUTH_NOT_CONFIGURED', 'Google sign-in is not configured.');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: callbackUrl(env, provider), response_type: 'code', scope: 'openid email profile', state, nonce, prompt: 'select_account' }).toString();
    return url.toString();
  }
  if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) throw new AppError(503, 'OAUTH_NOT_CONFIGURED', 'Facebook sign-in is not configured.');
  const url = new URL('https://www.facebook.com/v20.0/dialog/oauth');
  url.search = new URLSearchParams({ client_id: env.FACEBOOK_APP_ID, redirect_uri: callbackUrl(env, provider), response_type: 'code', scope: 'email,public_profile', state }).toString();
  return url.toString();
}

export async function resolveProviderProfile(env: AppEnv, provider: OAuthProviderName, code: string, nonce: string | null): Promise<ProviderProfile> {
  if (provider === 'google') return resolveGoogleProfile(env, code, nonce);
  return resolveFacebookProfile(env, code);
}

async function resolveGoogleProfile(env: AppEnv, code: string, nonce: string | null): Promise<ProviderProfile> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new AppError(503, 'OAUTH_NOT_CONFIGURED', 'Google sign-in is not configured.');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: callbackUrl(env, 'google'), grant_type: 'authorization_code' }) });
  const payload = await response.json().catch(() => null) as { id_token?: string } | null;
  if (!response.ok || !payload?.id_token) throw new AppError(401, 'OAUTH_FAILED', 'Google sign-in could not be completed.');
  try {
    const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
    const { payload: claims } = await jwtVerify(payload.id_token, jwks, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: env.GOOGLE_CLIENT_ID });
    if (typeof claims.sub !== 'string' || typeof claims.email !== 'string' || claims.email_verified !== true || (nonce && claims.nonce !== nonce)) throw new Error('Invalid Google claims');
    return { subject: claims.sub, email: claims.email.toLowerCase() };
  } catch { throw new AppError(401, 'OAUTH_FAILED', 'Google sign-in could not be verified.'); }
}

async function resolveFacebookProfile(env: AppEnv, code: string): Promise<ProviderProfile> {
  if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) throw new AppError(503, 'OAUTH_NOT_CONFIGURED', 'Facebook sign-in is not configured.');
  const base = env.FACEBOOK_GRAPH_API_URL.replace(/\/$/, '');
  const tokenResponse = await fetch(`${base}/oauth/access_token?${new URLSearchParams({ client_id: env.FACEBOOK_APP_ID, client_secret: env.FACEBOOK_APP_SECRET, redirect_uri: callbackUrl(env, 'facebook'), code })}`);
  const tokenPayload = await tokenResponse.json().catch(() => null) as { access_token?: string } | null;
  if (!tokenResponse.ok || !tokenPayload?.access_token) throw new AppError(401, 'OAUTH_FAILED', 'Facebook sign-in could not be completed.');
  const debugResponse = await fetch(`${base}/debug_token?${new URLSearchParams({ input_token: tokenPayload.access_token, access_token: `${env.FACEBOOK_APP_ID}|${env.FACEBOOK_APP_SECRET}` })}`);
  const debug = await debugResponse.json().catch(() => null) as { data?: { is_valid?: boolean; app_id?: string } } | null;
  if (!debugResponse.ok || !debug?.data?.is_valid || debug.data.app_id !== env.FACEBOOK_APP_ID) throw new AppError(401, 'OAUTH_FAILED', 'Facebook sign-in could not be verified.');
  const profileResponse = await fetch(`${base}/me?${new URLSearchParams({ fields: 'id,email', access_token: tokenPayload.access_token })}`);
  const profile = await profileResponse.json().catch(() => null) as { id?: string; email?: string } | null;
  if (!profileResponse.ok || !profile?.id || !profile.email) throw new AppError(400, 'OAUTH_EMAIL_REQUIRED', 'Facebook did not provide a verified email address.');
  return { subject: profile.id, email: profile.email.toLowerCase() };
}
