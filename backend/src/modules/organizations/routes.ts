import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { OrvioApp, OrganizationStatus, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { z } from 'zod';

import type { AppEnv } from '../../config/env.js';
import type { DatabaseClient } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../lib/app-error.js';
import { validate } from '../../lib/validation.js';
import { authenticateRequest, requireActiveUser } from '../auth/auth-context.js';
import { hashToken, createOpaqueToken } from '../auth/security.js';
import { sessionPayload } from '../auth/session.js';
import { writeAuditEvent } from '../auth/audit.js';

const switchSchema = z.object({ organizationId: z.string().uuid() });
const inviteSchema = z.object({ email: z.string().email().max(320) });
const acceptSchema = z.object({ token: z.string().min(32).max(512) });
const checkoutSchema = z.object({ plan: z.enum(['inventory', 'gym', 'bundle']) });
const envelope = <T>(request: { id: string }, data: T) => ({ data, meta: { requestId: request.id } });

function planCode(env: AppEnv, plan: 'inventory' | 'gym' | 'bundle') {
  const code = plan === 'inventory' ? env.PAYSTACK_INVENTORY_PLAN_CODE : plan === 'gym' ? env.PAYSTACK_GYM_PLAN_CODE : env.PAYSTACK_BUNDLE_PLAN_CODE;
  if (!env.PAYSTACK_SECRET_KEY || !code) throw new AppError(503, 'BILLING_NOT_CONFIGURED', 'Billing is not configured yet. Please contact support.');
  return code;
}

function appsFor(plan: SubscriptionPlan): OrvioApp[] {
  return plan === SubscriptionPlan.GYM ? [OrvioApp.GYM] : plan === SubscriptionPlan.BUNDLE ? [OrvioApp.INVENTORY, OrvioApp.GYM] : [OrvioApp.INVENTORY];
}

export async function registerOrganizationRoutes(app: FastifyInstance, options: { env: AppEnv; database: DatabaseClient }) {
  const { env, database } = options;

  app.get('/api/v1/organizations', { schema: { tags: ['Organizations'], summary: 'List organizations available to the current user', security: [{ bearerAuth: [] }] } }, async (request) => {
    const { claims } = await requireActiveUser(request, env, database);
    const memberships = await database.organizationMembership.findMany({ where: { userId: claims.sub, status: 'ACTIVE', organization: { deletedAt: null } }, include: { organization: true }, orderBy: { createdAt: 'asc' } });
    return envelope(request, memberships.map(({ organization }) => ({ id: organization.id, name: organization.name, slug: organization.slug, status: organization.status, active: organization.id === claims.orgId })));
  });

  app.post('/api/v1/organizations/switch', { schema: { tags: ['Organizations'], summary: 'Switch the active organization', security: [{ bearerAuth: [] }] } }, async (request) => {
    const { claims, user } = await requireActiveUser(request, env, database);
    const { organizationId } = validate(switchSchema, request.body);
    const membership = await database.organizationMembership.findFirst({ where: { userId: claims.sub, organizationId, status: 'ACTIVE', organization: { deletedAt: null } }, include: { organization: true } });
    if (!membership) throw new AppError(403, 'ORGANIZATION_ACCESS_DENIED', 'You do not have access to that organization.');
    await database.authSession.update({ where: { id: claims.sid }, data: { activeOrgId: organizationId } });
    return envelope(request, await sessionPayload(database, env, user, claims.sid));
  });

  app.post('/api/v1/organizations/:organizationId/invitations', { schema: { tags: ['Organizations'], summary: 'Invite a member to the active organization', security: [{ bearerAuth: [] }] } }, async (request) => {
    const { claims } = await requireActiveUser(request, env, database);
    const organizationId = (request.params as { organizationId: string }).organizationId;
    if (organizationId !== claims.orgId) throw new AppError(403, 'ORGANIZATION_SCOPE_MISMATCH', 'Use the active organization to invite members.');
    const owner = await database.organizationMembership.findFirst({ where: { organizationId, userId: claims.sub, role: 'OWNER', status: 'ACTIVE' } });
    if (!owner) throw new AppError(403, 'ORGANIZATION_OWNER_REQUIRED', 'Only organization owners can invite members.');
    const { email } = validate(inviteSchema, request.body);
    const token = createOpaqueToken();
    await database.organizationInvitation.create({ data: { organizationId, email: email.trim().toLowerCase(), tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), invitedByUserId: claims.sub } });
    await writeAuditEvent(database, 'organization.invited', claims.sub, request, { organizationId });
    // The email sender is intentionally injected later; only the opaque token is persisted.
    return envelope(request, { accepted: true, invitationToken: env.NODE_ENV === 'test' ? token : undefined });
  });

  app.post('/api/v1/organizations/invitations/accept', { schema: { tags: ['Organizations'], summary: 'Accept an organization invitation', security: [{ bearerAuth: [] }] } }, async (request) => {
    const { claims, user } = await requireActiveUser(request, env, database);
    const { token } = validate(acceptSchema, request.body);
    const invitation = await database.organizationInvitation.findFirst({ where: { tokenHash: hashToken(token), acceptedAt: null, expiresAt: { gt: new Date() } } });
    if (!invitation || invitation.email !== user.email) throw new AppError(400, 'INVITATION_INVALID', 'This invitation is invalid or has expired.');
    await database.$transaction([
      database.organizationMembership.upsert({ where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } }, create: { organizationId: invitation.organizationId, userId: user.id, role: 'MEMBER', status: 'ACTIVE', invitedAt: invitation.createdAt, acceptedAt: new Date() }, update: { status: 'ACTIVE', acceptedAt: new Date() } }),
      database.organizationInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
      database.authSession.update({ where: { id: claims.sid }, data: { activeOrgId: invitation.organizationId } }),
    ]);
    await writeAuditEvent(database, 'organization.invitation_accepted', user.id, request, { organizationId: invitation.organizationId });
    return envelope(request, await sessionPayload(database, env, user, claims.sid));
  });

  app.post('/api/v1/billing/checkout', { schema: { tags: ['Billing'], summary: 'Start Paystack checkout for the active organization', security: [{ bearerAuth: [] }] } }, async (request) => {
    const { claims, user } = await requireActiveUser(request, env, database);
    const { plan } = validate(checkoutSchema, request.body);
    const code = planCode(env, plan);
    const organization = await database.organization.findUnique({ where: { id: claims.orgId } });
    if (!organization || organization.status !== OrganizationStatus.PENDING_PAYMENT) throw new AppError(409, 'CHECKOUT_NOT_AVAILABLE', 'Checkout is not available for this organization.');
    const reference = `orvio_${claims.orgId}_${randomUUID()}`;
    const response = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ email: user.email, plan: code, reference, callback_url: `https://app.${env.ORVIO_ROOT_DOMAIN}/billing/complete` }) });
    const body = await response.json().catch(() => null) as { status?: boolean; data?: { authorization_url?: string } } | null;
    if (!response.ok || !body?.status || !body.data?.authorization_url) throw new AppError(503, 'CHECKOUT_UNAVAILABLE', 'Unable to start checkout. Please try again.');
    await database.organizationSubscription.updateMany({ where: { organizationId: claims.orgId, status: 'PENDING' }, data: { plan: plan.toUpperCase() as SubscriptionPlan, providerPlanCode: code, providerReference: reference } });
    await writeAuditEvent(database, 'billing.checkout_started', user.id, request, { organizationId: claims.orgId, plan });
    return envelope(request, { authorizationUrl: body.data.authorization_url });
  });

  app.post('/api/v1/billing/paystack/webhook', { schema: { tags: ['Billing'], summary: 'Process a Paystack billing webhook' } }, async (request) => {
    if (!env.PAYSTACK_SECRET_KEY) throw new AppError(503, 'BILLING_NOT_CONFIGURED', 'Billing is not configured yet.');
    const signature = request.headers['x-paystack-signature'];
    const body = JSON.stringify(request.body ?? {});
    const expected = createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(body).digest('hex');
    if (typeof signature !== 'string' || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new AppError(401, 'WEBHOOK_SIGNATURE_INVALID', 'Invalid webhook signature.');
    const event = request.body as { event?: string; data?: { reference?: string; paid_at?: string } };
    if (event.event !== 'charge.success' || !event.data?.reference) return envelope(request, { received: true });
    const subscription = await database.organizationSubscription.findUnique({ where: { providerReference: event.data.reference } });
    if (!subscription || subscription.status === SubscriptionStatus.ACTIVE) return envelope(request, { received: true });
    const apps = appsFor(subscription.plan);
    await database.$transaction([
      database.organizationSubscription.update({ where: { id: subscription.id }, data: { status: 'ACTIVE' } }),
      database.organization.update({ where: { id: subscription.organizationId }, data: { status: 'ACTIVE' } }),
      ...apps.map((app) => database.organizationEntitlement.upsert({ where: { organizationId_app: { organizationId: subscription.organizationId, app } }, create: { organizationId: subscription.organizationId, app, enabled: true }, update: { enabled: true, expiresAt: null } })),
    ]);
    await writeAuditEvent(database, 'billing.subscription_activated', null, request, { organizationId: subscription.organizationId, plan: subscription.plan.toLowerCase() });
    return envelope(request, { received: true });
  });
}
