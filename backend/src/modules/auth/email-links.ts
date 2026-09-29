import { createHmac, timingSafeEqual } from 'node:crypto';

import type { AppEnv } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';

export type NotificationEmailType = 'verification' | 'password_reset' | 'welcome' | 'password_changed' | 'new_device_login' | 'onboarding_tips';
type LinkPayload = { purpose: 'click' | 'unsubscribe'; userId: string; type?: NotificationEmailType; destination?: string; exp: number };

function secret(env: AppEnv) { return env.EMAIL_LINK_SECRET ?? env.JWT_SECRET; }
function encode(payload: LinkPayload, env: AppEnv) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret(env)).update(body).digest('base64url');
  return `${body}.${signature}`;
}
function decode(token: string, env: AppEnv): LinkPayload {
  const [body, signature] = token.split('.');
  if (!body || !signature) throw new AppError(400, 'EMAIL_LINK_INVALID', 'This email link is invalid or has expired.');
  const expected = createHmac('sha256', secret(env)).update(body).digest('base64url');
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new AppError(400, 'EMAIL_LINK_INVALID', 'This email link is invalid or has expired.');
  let payload: LinkPayload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as LinkPayload; } catch { throw new AppError(400, 'EMAIL_LINK_INVALID', 'This email link is invalid or has expired.'); }
  if (!payload.userId || !payload.purpose || payload.exp <= Date.now()) throw new AppError(400, 'EMAIL_LINK_INVALID', 'This email link is invalid or has expired.');
  return payload;
}
function allowedDestination(destination: string, env: AppEnv): URL | null {
  try {
    const url = new URL(destination);
    const frontend = new URL(env.FRONTEND_APP_URL);
    const allowedPaths = new Set(['/verify-email', '/reset-password/confirm', '/dashboard', '/login', '/account']);
    return url.origin === frontend.origin && allowedPaths.has(url.pathname) ? url : null;
  } catch { return null; }
}

export function trackedEmailLink(env: AppEnv, userId: string, type: NotificationEmailType, destination: string) {
  if (!allowedDestination(destination, env)) throw new Error('Email destination is not allowlisted.');
  const token = encode({ purpose: 'click', userId, type, destination, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }, env);
  return new URL(`/api/v1/email/click?token=${encodeURIComponent(token)}`, env.PUBLIC_API_URL).toString();
}
export function marketingUnsubscribeLink(env: AppEnv, userId: string) {
  const token = encode({ purpose: 'unsubscribe', userId, exp: Date.now() + 365 * 24 * 60 * 60 * 1000 }, env);
  return new URL(`/api/v1/email/unsubscribe?token=${encodeURIComponent(token)}`, env.PUBLIC_API_URL).toString();
}
export function consumeTrackedEmailLink(token: string, env: AppEnv) {
  const payload = decode(token, env);
  if (payload.purpose !== 'click' || !payload.type || !payload.destination) throw new AppError(400, 'EMAIL_LINK_INVALID', 'This email link is invalid or has expired.');
  const destination = allowedDestination(payload.destination, env);
  if (!destination) throw new AppError(400, 'EMAIL_LINK_INVALID', 'This email link is invalid or has expired.');
  return { userId: payload.userId, type: payload.type, destination };
}
export function consumeUnsubscribeLink(token: string, env: AppEnv) {
  const payload = decode(token, env);
  if (payload.purpose !== 'unsubscribe') throw new AppError(400, 'EMAIL_LINK_INVALID', 'This email link is invalid or has expired.');
  return { userId: payload.userId };
}
