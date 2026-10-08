import { SignJWT, jwtVerify, decodeProtectedHeader } from 'jose';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

function parseKeyRegistry(): Map<string, Uint8Array> {
  const registry = new Map<string, Uint8Array>();

  // 1. Primary signing key
  const primaryKid = env.JWT_KEY_ID || 'primary';
  registry.set(primaryKid, new TextEncoder().encode(env.JWT_SECRET));

  // 2. Additional rotated keys (JSON or comma-separated kid:secret)
  if (env.JWT_ROTATION_KEYS) {
    try {
      if (env.JWT_ROTATION_KEYS.trim().startsWith('{')) {
        const parsed = JSON.parse(env.JWT_ROTATION_KEYS);
        for (const [kid, secret] of Object.entries(parsed)) {
          if (typeof secret === 'string' && secret.length >= 32) {
            registry.set(kid, new TextEncoder().encode(secret));
          }
        }
      } else {
        const pairs = env.JWT_ROTATION_KEYS.split(',');
        for (const pair of pairs) {
          const [kid, secret] = pair.split(':').map((s) => s.trim());
          if (kid && secret && secret.length >= 32) {
            registry.set(kid, new TextEncoder().encode(secret));
          }
        }
      }
    } catch {
      // Invalid rotation string ignored; fallback to primary
    }
  }

  return registry;
}

let keyRegistry = parseKeyRegistry();

export function registerJwtKey(kid: string, secret: string) {
  keyRegistry.set(kid, new TextEncoder().encode(secret));
}

export function getKeyRegistry(): Map<string, Uint8Array> {
  return keyRegistry;
}

export interface JwkKeyInfo {
  kty: string;
  use: string;
  alg: string;
  kid: string;
}

export interface JwksResponse {
  keys: JwkKeyInfo[];
}

export function getPublicJwks(): JwksResponse {
  const keys: JwkKeyInfo[] = [];
  for (const kid of keyRegistry.keys()) {
    keys.push({
      kty: 'oct',
      use: 'sig',
      alg: 'HS256',
      kid,
    });
  }
  return { keys };
}

export interface AccessTokenClaims {
  sub: string; // user id
  email: string;
  org_id?: string;
  role?: string;
  membership_id?: string;
  session_id?: string;
  jti?: string;
  typ?: 'access';
  [key: string]: unknown;
}

export async function signAccessToken(
  claims: AccessTokenClaims,
  options?: { keyId?: string; secret?: string }
): Promise<string> {
  const kid = options?.keyId || env.JWT_KEY_ID || 'primary';
  const key = options?.secret
    ? new TextEncoder().encode(options.secret)
    : keyRegistry.get(kid) || new TextEncoder().encode(env.JWT_SECRET);

  return new SignJWT({ ...claims, typ: 'access' })
    .setProtectedHeader({ alg: 'HS256', kid })
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRY)
    .setIssuer('orvio-hub')
    .setAudience(env.JWT_AUDIENCE)
    .sign(key);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    let targetKey: Uint8Array | undefined;

    try {
      const header = decodeProtectedHeader(token);
      if (header.kid && keyRegistry.has(header.kid)) {
        targetKey = keyRegistry.get(header.kid);
      }
    } catch {
      // If header decode fails, fallback to iterating keys
    }

    if (targetKey) {
      const { payload } = await jwtVerify(token, targetKey, {
        issuer: 'orvio-hub',
        audience: env.JWT_AUDIENCE,
      });
      const claims = payload as unknown as AccessTokenClaims;
      return claims.typ === 'access' ? claims : null;
    }

    // Fallback: try all registered keys in registry (primary first)
    for (const key of keyRegistry.values()) {
      try {
        const { payload } = await jwtVerify(token, key, {
          issuer: 'orvio-hub',
          audience: env.JWT_AUDIENCE,
        });
        const claims = payload as unknown as AccessTokenClaims;
        if (claims.typ === 'access') return claims;
      } catch {
        continue;
      }
    }

    return null;
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
