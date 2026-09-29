import type { AppEnv } from '../../config/env.js';
import type { DatabaseClient } from '../../infrastructure/database/prisma.js';
import { issueAccessToken } from './security.js';

export interface SafeUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  passwordSetAt: Date | null;
  onboardingCompletedAt: Date | null;
}

export async function sessionPayload(database: DatabaseClient, env: AppEnv, user: SafeUser, sessionId: string) {
  const onboarding = await database.userOnboarding.findUnique({ where: { userId: user.id } });
  const session = await database.authSession.findUnique?.({ where: { id: sessionId } }) ?? null;
  const memberships = await database.organizationMembership.findMany({
    where: { userId: user.id, status: 'ACTIVE', organization: { deletedAt: null } },
    include: { organization: { include: { entitlements: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const activeMembership = memberships.find((membership) => membership.organizationId === session?.activeOrgId) ?? memberships[0];
  if (!activeMembership) throw new Error('No active organization membership');
  if (session && session.activeOrgId !== activeMembership.organizationId) {
    await database.authSession.update({ where: { id: sessionId }, data: { activeOrgId: activeMembership.organizationId } });
  }
  const now = new Date();
  const appAccess = activeMembership.organization.entitlements
    .filter((entitlement) => entitlement.enabled && (!entitlement.expiresAt || entitlement.expiresAt > now))
    .map((entitlement) => entitlement.app.toLowerCase() as 'inventory' | 'gym');
  const accessToken = await issueAccessToken({ sub: user.id, sid: sessionId, orgId: activeMembership.organizationId, appAccess }, env.JWT_SECRET);
  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      emailVerified: Boolean(user.emailVerifiedAt),
      phoneVerified: Boolean(user.phoneVerifiedAt),
      passwordSet: Boolean(user.passwordSetAt),
    },
    onboarding: {
      stage: onboarding?.stage ?? 'PROFILE',
      completed: Boolean(user.onboardingCompletedAt),
    },
    organization: {
      id: activeMembership.organization.id,
      name: activeMembership.organization.name,
      slug: activeMembership.organization.slug,
      defaultApp: activeMembership.organization.defaultApp.toLowerCase() as 'inventory' | 'gym',
      appAccess,
      memberships: memberships.map((membership) => ({ id: membership.organization.id, name: membership.organization.name, slug: membership.organization.slug })),
    },
  };
}
