/**
 * Shared JWT parsing and validation utilities for client-side session management.
 */

export function getJwtPayload<T = Record<string, any>>(token: string): T | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload) as T;
  } catch {
    return null;
  }
}

export function getJwtExpiryMs(token: string): number | null {
  const payload = getJwtPayload<{ exp?: number }>(token);
  if (!payload || typeof payload.exp !== 'number') return null;
  return payload.exp * 1000;
}

export function getTimeUntilExpiryMs(token: string): number | null {
  const expiry = getJwtExpiryMs(token);
  if (expiry === null) return null;
  return expiry - Date.now();
}

/**
 * Checks whether the JWT token is well-formed and unexpired, with an optional safety buffer.
 * @param token JWT string
 * @param bufferMs Safety buffer in milliseconds (default 10,000ms / 10s)
 */
export function isJwtValid(token: string, bufferMs = 10_000): boolean {
  const timeUntilExpiry = getTimeUntilExpiryMs(token);
  if (timeUntilExpiry === null) return false;
  return timeUntilExpiry > bufferMs;
}
