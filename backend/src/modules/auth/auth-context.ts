import type { FastifyRequest } from 'fastify';
import { AppError } from '../../lib/app-error.js';
import type { AppEnv } from '../../config/env.js';
import type { DatabaseClient } from '../../infrastructure/database/prisma.js';
import { authTiming, verifyAccessToken, type AccessTokenClaims } from './security.js';

declare module 'fastify' { interface FastifyRequest { auth: AccessTokenClaims | null } }

export async function authenticateRequest(request: FastifyRequest, env: AppEnv, database: DatabaseClient): Promise<AccessTokenClaims> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError(401, 'SESSION_EXPIRED', 'Authentication is required.');

  let claims: AccessTokenClaims;
  try {
    claims = await verifyAccessToken(header.slice(7), env.JWT_SECRET, env.JWT_SECRET_PREVIOUS);
  } catch {
    throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired.');
  }

  const session = await database.authSession.findFirst({
    where: {
      id: claims.sid,
      userId: claims.sub,
      revokedAt: null,
    },
    include: { user: true },
  });

  if (!session || !session.user || session.user.status !== 'ACTIVE' || session.user.deletedAt) {
    throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired.');
  }
  if (session.activeOrgId && session.activeOrgId !== claims.orgId) {
    throw new AppError(401, 'SESSION_EXPIRED', 'Your session has changed. Please refresh and try again.');
  }
  const host = request.hostname.toLowerCase().split(':')[0];
  const rootDomain = env.ORVIO_ROOT_DOMAIN.toLowerCase();
  if (host.endsWith(`.${rootDomain}`) && host !== `app.${rootDomain}` && host !== `api.${rootDomain}`) {
    const slug = host.slice(0, -(rootDomain.length + 1));
    const organization = await database.organization.findUnique({ where: { slug } });
    if (!organization || organization.id !== claims.orgId) throw new AppError(403, 'ORGANIZATION_SCOPE_MISMATCH', 'This session is not authorized for this organization.');
  }

  const now = new Date();
  if (session.expiresAt <= now || session.absoluteExpiresAt <= now) {
    throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired.');
  }

  const idleTimeoutMs = session.rememberMe ? authTiming.rememberMeIdleTimeoutMs : authTiming.transientIdleTimeoutMs;
  if (now.getTime() - session.lastActivityAt.getTime() > idleTimeoutMs) {
    await database.authSession.update({ where: { id: session.id }, data: { revokedAt: now } }).catch(() => {});
    throw new AppError(401, 'SESSION_EXPIRED', 'Your session has timed out due to inactivity.');
  }

  if (now.getTime() - session.lastActivityAt.getTime() > 60_000) {
    await database.authSession.update({
      where: { id: session.id },
      data: { lastActivityAt: now, lastUsedAt: now },
    }).catch(() => {});
  }

  request.auth = claims;
  return claims;
}

export function requireAppAccess(claims: AccessTokenClaims, app: 'inventory' | 'gym') {
  if (!claims.appAccess.includes(app)) throw new AppError(403, 'APP_ACCESS_REQUIRED', 'Your organization plan does not include this app.');
}

export async function requireActiveUser(request: FastifyRequest, env: AppEnv, database: DatabaseClient) {
  const claims = await authenticateRequest(request, env, database);
  const user = await database.user.findUnique({ where: { id: claims.sub } });
  if (!user || user.status !== 'ACTIVE' || user.deletedAt) throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired.');
  return { claims, user };
}
