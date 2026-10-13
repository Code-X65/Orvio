import crypto from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { AppError } from '../lib/errors.js';
import { env } from '../config/env.js';

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getCsrfCookieOptions(overrides: Record<string, any> = {}) {
  const isProd = env.NODE_ENV === 'production';
  const secure = env.COOKIE_SECURE !== undefined ? env.COOKIE_SECURE : isProd;
  const sameSite: 'strict' | 'lax' | 'none' = env.COOKIE_SAMESITE || 'lax';

  return {
    path: '/',
    httpOnly: false, // Readable by client JS to populate X-CSRF-Token header
    secure,
    sameSite,
    ...overrides,
  };
}

export function verifyOriginAndReferer(request: FastifyRequest): boolean {
  const origin = (request.headers.origin as string | undefined)?.trim();
  const referer = (request.headers.referer as string | undefined)?.trim();

  // If neither Origin nor Referer is present (e.g. server-to-server or same-origin direct), allow
  if (!origin && !referer) {
    return true;
  }

  const targetUrl = origin || referer;
  if (!targetUrl) return true;

  try {
    const parsed = new URL(targetUrl);
    const host = parsed.host;
    const hostname = parsed.hostname;

    // Check allowed base domain and tenant subdomains
    const cleanBaseDomain = (env.APP_BASE_DOMAIN || '').split(':')[0].trim();
    if (cleanBaseDomain && (hostname === cleanBaseDomain || hostname.endsWith(`.${cleanBaseDomain}`))) {
      return true;
    }

    if (env.FRONTEND_URL) {
      try {
        const frontUrl = new URL(env.FRONTEND_URL);
        if (parsed.origin === frontUrl.origin || host === frontUrl.host) return true;
      } catch {
        // Ignore parse error
      }
    }

    if (env.CORS_ORIGIN) {
      const allowed = env.CORS_ORIGIN.split(',').map((s) => s.trim().toLowerCase());
      if (allowed.includes(parsed.origin.toLowerCase()) || allowed.includes('*')) {
        return true;
      }
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function verifyCsrfToken(request: FastifyRequest): void {
  if (!verifyOriginAndReferer(request)) {
    throw new AppError('CSRF_ORIGIN_INVALID', 'Origin or Referer validation failed', 403);
  }

  const cookieToken = request.cookies?.csrfToken;
  const headerToken = (
    (request.headers['x-csrf-token'] || request.headers['X-CSRF-Token']) as string | undefined
  )?.trim();

  // Double-submit cookie verification
  if (cookieToken) {
    if (!headerToken) {
      throw new AppError('CSRF_TOKEN_MISSING', 'Missing X-CSRF-Token header', 403);
    }

    const cookieBuf = Buffer.from(cookieToken);
    const headerBuf = Buffer.from(headerToken);

    if (cookieBuf.length !== headerBuf.length || !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
      throw new AppError('CSRF_TOKEN_MISMATCH', 'Invalid X-CSRF-Token provided', 403);
    }
  }
}
