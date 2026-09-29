import type { FastifyRequest } from 'fastify';

import type { DatabaseClient } from '../../infrastructure/database/prisma.js';

export type AuditEvent =
  | 'user.registered' | 'user.login' | 'user.logout'
  | 'email.verification_sent' | 'email.verified' | 'email.verification_failed' | 'email.sent' | 'email_clicked'
  | 'password.reset_requested' | 'password.reset_completed' | 'password.reset_failed' | 'password.changed'
  | 'session.refresh' | 'session.revoked'
  | 'onboarding.started' | 'onboarding.completed' | 'onboarding.skipped' | 'onboarding.profile_completed'
  | 'auth.phone_otp_sent' | 'auth.phone_otp_failed' | 'auth.phone_verified' | 'auth.profile_updated' | 'auth.oauth_linked' | 'auth.oauth_link_required' | 'auth.oauth_registered' | 'auth.oauth_signed_in'
  | 'legal.accepted' | 'marketing.unsubscribed'
  | 'organization.created' | 'organization.invited' | 'organization.invitation_accepted'
  | 'billing.checkout_started' | 'billing.subscription_activated' | 'billing.webhook_failed';

const forbiddenMetadata = /password|token|secret|authorization/i;

export async function writeAuditEvent(database: DatabaseClient, event: AuditEvent, userId: string | null, request: FastifyRequest, metadata?: Record<string, string>) {
  const safeMetadata = metadata && Object.fromEntries(Object.entries(metadata).filter(([key]) => !forbiddenMetadata.test(key)));
  await database.auditLog.create({ data: { event, userId: userId ?? undefined, ip: request.ip, userAgent: request.headers['user-agent']?.slice(0, 512), metadata: safeMetadata } });
}
