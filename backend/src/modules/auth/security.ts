import argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT, type JWTPayload } from 'jose';

const accessTokenLifetimeSeconds = 15 * 60;

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  orgId: string;
  appAccess: Array<'inventory' | 'gym'>;
  authTime?: number;
  jti?: string;
}

export const argon2Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

function secret(secret: string): Uint8Array { return new TextEncoder().encode(secret); }

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, argon2Options);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function needsPasswordRehash(hash: string): boolean {
  return argon2.needsRehash(hash, argon2Options);
}

export function createOpaqueToken(): string { return randomBytes(48).toString('base64url'); }
export function hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }

export async function issueAccessToken(claims: AccessTokenClaims, jwtSecret: string): Promise<string> {
  const jwt = new SignJWT({
    sid: claims.sid,
    org_id: claims.orgId,
    app_access: claims.appAccess,
    ...(claims.authTime ? { auth_time: claims.authTime } : {}),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer('orvio-api')
    .setAudience('orvio-web')
    .setJti(claims.jti ?? randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${accessTokenLifetimeSeconds}s`);

  return jwt.sign(secret(jwtSecret));
}

export async function verifyAccessToken(token: string, jwtSecret: string, previousJwtSecret?: string): Promise<AccessTokenClaims> {
  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(token, secret(jwtSecret), {
      algorithms: ['HS256'],
      issuer: 'orvio-api',
      audience: 'orvio-web',
    });
    payload = verified.payload;
  } catch (primaryErr) {
    if (previousJwtSecret) {
      const verifiedPrev = await jwtVerify(token, secret(previousJwtSecret), {
        algorithms: ['HS256'],
        issuer: 'orvio-api',
        audience: 'orvio-web',
      });
      payload = verifiedPrev.payload;
    } else {
      throw primaryErr;
    }
  }

  if (typeof payload.sub !== 'string') throw new Error('Missing subject');
  if (typeof payload.sid !== 'string') throw new Error('Missing session id');
  if (typeof payload.org_id !== 'string') throw new Error('Missing organization id');
  if (!Array.isArray(payload.app_access) || !payload.app_access.every((app) => app === 'inventory' || app === 'gym')) throw new Error('Invalid app access');
  const authTime = typeof payload.auth_time === 'number' ? payload.auth_time : undefined;
  const jti = typeof payload.jti === 'string' ? payload.jti : undefined;
  return { sub: payload.sub, sid: payload.sid, orgId: payload.org_id, appAccess: payload.app_access as Array<'inventory' | 'gym'>, authTime, jti };
}

export const authTiming = {
  accessTokenLifetimeSeconds,
  refreshTokenLifetimeMs: 30 * 24 * 60 * 60 * 1000,
  shortRefreshTokenLifetimeMs: 12 * 60 * 60 * 1000,
  rememberMeAbsoluteLifetimeMs: 30 * 24 * 60 * 60 * 1000,
  rememberMeIdleTimeoutMs: 14 * 24 * 60 * 60 * 1000,
  transientAbsoluteLifetimeMs: 12 * 60 * 60 * 1000,
  transientIdleTimeoutMs: 30 * 60 * 1000,
  rotationGraceWindowMs: 30 * 1000,
  verificationTokenLifetimeMs: 24 * 60 * 60 * 1000,
  passwordResetTokenLifetimeMs: 60 * 60 * 1000,
};
