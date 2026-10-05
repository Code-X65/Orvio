import type { FastifyRequest } from 'fastify';
import type { User, Membership, Organization } from '@prisma/client';
import { verifyAccessToken, type AccessTokenClaims } from '../lib/tokens.js';
import { prisma as defaultPrisma } from '../infrastructure/database/client.js';
import { AppError } from '../lib/errors.js';

export interface AuthContext {
  claims: AccessTokenClaims;
  user: User;
  membership?: Membership | null;
  organization?: Organization | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

export async function requireAuth(request: FastifyRequest): Promise<void> {
  const authHeader = request.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    throw new AppError('UNAUTHORIZED', 'Missing or invalid Authorization credentials', 401);
  }

  const claims = await verifyAccessToken(token);

  if (!claims || !claims.sub) {
    throw new AppError('INVALID_TOKEN', 'Token is invalid or expired', 401);
  }

  const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;

  const user = await db.user.findUnique({
    where: { id: claims.sub },
    include: {
      memberships: {
        where: claims.org_id ? { org_id: claims.org_id, status: 'active' } : { status: 'active' },
        include: {
          organization: true,
        },
        take: 1,
      },
    },
  });

  if (!user || user.status === 'deleted' || user.status === 'suspended') {
    throw new AppError('UNAUTHORIZED', 'User account not found or suspended', 401);
  }

  const primaryMembership = user.memberships[0] ?? null;
  if (!primaryMembership) {
    if (claims.membership_id) {
      await db.refreshToken.updateMany({
        where: { membership_id: claims.membership_id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    }
    throw new AppError('FORBIDDEN', 'Your membership is no longer active', 403);
  }
  if (
    claims.membership_id &&
    (claims.membership_id !== primaryMembership.id || claims.role !== primaryMembership.role)
  ) {
    await db.refreshToken.updateMany({
      where: { membership_id: primaryMembership.id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    throw new AppError('FORBIDDEN', 'Your membership permissions have changed. Please sign in again.', 403);
  }

  request.auth = {
    claims,
    user,
    membership: primaryMembership,
    organization: primaryMembership?.organization ?? null,
  };
}
