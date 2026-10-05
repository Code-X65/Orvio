import { SignJWT, jwtVerify } from 'jose';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

const secretKey = new TextEncoder().encode(env.JWT_SECRET);

export interface AccessTokenClaims {
  sub: string; // user id
  email: string;
  org_id?: string;
  role?: string;
  membership_id?: string;
  typ?: 'access';
  [key: string]: unknown;
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({ ...claims, typ: 'access' })
    .setProtectedHeader({ alg: 'HS256', kid: env.JWT_KEY_ID })
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRY)
    .setIssuer('orvio-hub')
    .setAudience(env.JWT_AUDIENCE)
    .sign(secretKey);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: 'orvio-hub',
      audience: env.JWT_AUDIENCE,
    });
    const claims = payload as unknown as AccessTokenClaims;
    return claims.typ === 'access' ? claims : null;
  } catch {
    return null;
  }
}

export function generateOpaqueToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

export function generateRefreshToken(): {
  rawToken: string;
  tokenHash: string;
  jti: string;
} {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const jti = crypto.randomUUID();
  return { rawToken, tokenHash, jti };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
