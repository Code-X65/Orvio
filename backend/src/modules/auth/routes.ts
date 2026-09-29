import { AuthTokenType, OnboardingStage, OAuthFlow, OAuthProvider, OAuthPurpose, OrvioApp, OrganizationStatus, SubscriptionPlan, SubscriptionStatus, UserStatus } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { AppEnv } from '../../config/env.js';
import type { DatabaseClient } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../lib/app-error.js';
import { validate } from '../../lib/validation.js';
import { authenticateRequest, requireActiveUser } from './auth-context.js';
import { createBrevoMailSender, type AuthMailSender } from './mail.js';
import { currentLegalDocuments } from './legal.js';
import { isOAuthProvider, providerAuthorizationUrl, resolveProviderProfile, type OAuthProviderName } from './oauth.js';
import { authTiming, createOpaqueToken, hashPassword, hashToken, needsPasswordRehash, verifyPassword } from './security.js';
import { sessionPayload } from './session.js';
import { consumeTrackedEmailLink, consumeUnsubscribeLink } from './email-links.js';
import { deliverNotificationEmail } from './notification-delivery.js';
import { writeAuditEvent, type AuditEvent } from './audit.js';

const strongPassword = z.string().min(12, 'Use at least 12 characters.').max(128)
  .regex(/[a-z]/, 'Include a lowercase letter.')
  .regex(/[A-Z]/, 'Include an uppercase letter.')
  .regex(/\d/, 'Include a number.')
  .regex(/[^A-Za-z0-9]/, 'Include a symbol.');
const credentialsSchema = z.object({ email: z.string().email().max(320), password: z.string().min(8).max(128), rememberMe: z.boolean().optional().default(false) });
const registrationSchema = credentialsSchema.extend({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  password: strongPassword,
  passwordConfirmation: strongPassword,
  phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Must be a valid phone number in E.164 format (e.g. +234...)').optional().or(z.literal('')),
  marketingConsent: z.boolean().optional().default(false),
  source: z.string().trim().max(64).optional(),
  organizationName: z.string().trim().min(2).max(120),
  organizationSlug: z.string().trim().min(3).max(63).regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/),
  plan: z.enum(['inventory', 'gym', 'bundle', 'trial']),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
}).refine((value) => value.password === value.passwordConfirmation, { path: ['passwordConfirmation'], message: 'Passwords do not match.' });
const tokenSchema = z.object({ token: z.string().min(32).max(512) });
const emailSchema = z.object({ email: z.string().email().max(320) });
const profileSchema = z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80) });
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: strongPassword,
  confirmNewPassword: strongPassword,
  revokeOtherSessions: z.boolean().optional().default(true),
}).refine((value) => value.newPassword === value.confirmNewPassword, { path: ['confirmNewPassword'], message: 'Passwords do not match.' });
const setPasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128).optional(),
  password: strongPassword,
  passwordConfirmation: strongPassword,
  revokeOtherSessions: z.boolean().optional().default(true),
}).refine((value) => value.password === value.passwordConfirmation, { path: ['passwordConfirmation'], message: 'Passwords do not match.' });
const oauthStartSchema = z.object({ flow: z.enum(['redirect', 'popup']).optional().default('redirect'), rememberMe: z.boolean().optional().default(true) });
const refreshCookie = 'orvio_refresh';

const errorResponseSchema = {
  type: 'object', required: ['error'], properties: {
    error: { type: 'object', required: ['code', 'message', 'requestId'], properties: { code: { type: 'string' }, message: { type: 'string' }, details: { nullable: true }, requestId: { type: 'string' } } },
  },
} as const;
const envelopeSchema = {
  type: 'object', required: ['data', 'meta'], properties: {
    data: {},
    meta: { type: 'object', required: ['requestId'], properties: { requestId: { type: 'string' } } },
  },
} as const;
const credentialsBodySchema = { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8, maxLength: 128 }, rememberMe: { type: 'boolean' } } } as const;
const strongPasswordBodySchema = {
  type: 'string',
  minLength: 12,
  maxLength: 128,
  description: 'At least 12 characters containing lowercase, uppercase, number, and symbol characters.',
  allOf: [{ pattern: '[a-z]' }, { pattern: '[A-Z]' }, { pattern: '\\d' }, { pattern: '[^A-Za-z0-9]' }],
} as const;
const registrationBodySchema = {
  type: 'object',
  required: ['firstName', 'lastName', 'email', 'password', 'passwordConfirmation', 'acceptTerms', 'acceptPrivacy'],
  properties: {
    ...credentialsBodySchema.properties,
    password: strongPasswordBodySchema,
    firstName: { type: 'string', minLength: 1, maxLength: 80 },
    lastName: { type: 'string', minLength: 1, maxLength: 80 },
    passwordConfirmation: strongPasswordBodySchema,
    phone: { type: 'string' },
    marketingConsent: { type: 'boolean' },
    source: { type: 'string', maxLength: 64 },
    organizationName: { type: 'string', minLength: 2, maxLength: 120 },
    organizationSlug: { type: 'string', minLength: 3, maxLength: 63, pattern: '^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$' },
    plan: { type: 'string', enum: ['inventory', 'gym', 'bundle', 'trial'] },
    acceptTerms: { type: 'boolean', const: true },
    acceptPrivacy: { type: 'boolean', const: true },
  },
} as const;
const emailBodySchema = { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } as const;
const tokenBodySchema = { type: 'object', required: ['token'], properties: { token: { type: 'string' } } } as const;
const changePasswordBodySchema = { type: 'object', required: ['currentPassword', 'newPassword', 'confirmNewPassword'], properties: { currentPassword: { type: 'string', minLength: 1, maxLength: 128 }, newPassword: strongPasswordBodySchema, confirmNewPassword: strongPasswordBodySchema, revokeOtherSessions: { type: 'boolean' } } } as const;
const setPasswordBodySchema = { type: 'object', required: ['password', 'passwordConfirmation'], properties: { currentPassword: { type: 'string', maxLength: 128 }, password: strongPasswordBodySchema, passwordConfirmation: strongPasswordBodySchema, revokeOtherSessions: { type: 'boolean' } } } as const;
const providerParamsSchema = { type: 'object', required: ['provider'], properties: { provider: { type: 'string', enum: ['google', 'facebook'] } } } as const;
function authSchema(summary: string, body?: object, security = false) {
  return { tags: ['Authentication'], summary, ...(body ? { body } : {}), ...(security ? { security: [{ bearerAuth: [] }] } : {}), response: { 200: envelopeSchema, 201: envelopeSchema, 202: envelopeSchema, 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 409: errorResponseSchema, 429: errorResponseSchema, 503: errorResponseSchema } };
}

export interface AuthRouteOptions { env: AppEnv; database: DatabaseClient; mailer?: AuthMailSender }

function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
import { enforceAuthRateLimit } from './rate-limiter.js';

function envelope<T>(request: FastifyRequest, data: T) { return { data, meta: { requestId: request.id } }; }
function clientContext(request: FastifyRequest) { return { ip: request.ip, userAgent: request.headers['user-agent']?.slice(0, 512) }; }

function createAuthRateLimiter(
  database: DatabaseClient,
  action: string,
  options: { max: number; ipMax?: number; windowMs: number },
) {
  return async (request: FastifyRequest) => {
    const body = request.body as { email?: string; phone?: string } | undefined;
    const identity = body?.email ? normalizeEmail(body.email) : body?.phone?.trim();
    await enforceAuthRateLimit({
      database,
      action,
      ip: request.ip,
      identity,
      max: options.max,
      ipMax: options.ipMax,
      windowMs: options.windowMs,
    });
  };
}

export async function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions): Promise<void> {
  const { env, database } = options;
  const mailer = options.mailer ?? createBrevoMailSender(env);
  const limitRegistration = createAuthRateLimiter(database, 'registration', {
    max: env.AUTH_RATE_LIMIT_REGISTRATION_MAX,
    ipMax: env.AUTH_RATE_LIMIT_REGISTRATION_IP_MAX,
    windowMs: env.AUTH_RATE_LIMIT_REGISTRATION_WINDOW_MS,
  });
  const limitLogin = createAuthRateLimiter(database, 'login', {
    max: env.AUTH_RATE_LIMIT_LOGIN_MAX,
    ipMax: env.AUTH_RATE_LIMIT_LOGIN_IP_MAX,
    windowMs: env.AUTH_RATE_LIMIT_LOGIN_WINDOW_MS,
  });
  const limitVerificationResend = createAuthRateLimiter(database, 'verification_resend', {
    max: 3,
    ipMax: 10,
    windowMs: 10 * 60 * 1000,
  });
  const limitPasswordReset = createAuthRateLimiter(database, 'password_reset', {
    max: env.AUTH_RATE_LIMIT_PASSWORD_MAX,
    ipMax: env.AUTH_RATE_LIMIT_PASSWORD_IP_MAX,
    windowMs: env.AUTH_RATE_LIMIT_PASSWORD_WINDOW_MS,
  });
  const limitSetPassword = createAuthRateLimiter(database, 'set_password', {
    max: env.AUTH_RATE_LIMIT_PASSWORD_MAX,
    ipMax: env.AUTH_RATE_LIMIT_PASSWORD_IP_MAX,
    windowMs: env.AUTH_RATE_LIMIT_PASSWORD_WINDOW_MS,
  });
  const dummyPasswordHash = await hashPassword('orvio-timing-equalizer-not-a-real-password');
  const cookieSecure = env.COOKIE_SECURE ?? (env.NODE_ENV === 'production');

  function setRefreshCookie(reply: FastifyReply, token: string, lifetimeMs: number, rememberMe = true) {
    reply.setCookie(refreshCookie, token, { httpOnly: true, secure: cookieSecure, sameSite: 'strict', path: '/api/v1/auth', ...(rememberMe ? { maxAge: lifetimeMs / 1000 } : {}) });
  }
  function clearRefreshCookie(reply: FastifyReply) { reply.clearCookie(refreshCookie, { httpOnly: true, secure: cookieSecure, sameSite: 'strict', path: '/api/v1/auth' }); }
  async function audit(event: AuditEvent, userId: string | null, request: FastifyRequest, metadata?: Record<string, string>) { await writeAuditEvent(database, event, userId, request, metadata); }
  async function deliver(request: FastifyRequest, userId: string, type: Parameters<typeof deliverNotificationEmail>[0]['type'], send: () => Promise<void>) {
    return deliverNotificationEmail({ database, request, userId, type, send });
  }
  async function issueRefreshSession(userId: string, request: FastifyRequest, rememberMe = true) {
    const token = createOpaqueToken();
    const lifetimeMs = rememberMe ? authTiming.rememberMeAbsoluteLifetimeMs : authTiming.transientAbsoluteLifetimeMs;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + lifetimeMs);
    const absoluteExpiresAt = new Date(now.getTime() + lifetimeMs);
    const context = clientContext(request);
    const session = await database.authSession.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt,
        absoluteExpiresAt,
        rememberMe,
        lastActivityAt: now,
        ...context,
      },
    });
    return { token, lifetimeMs, id: session.id };
  }
  async function createOneTimeToken(userId: string, type: AuthTokenType) {
    const token = createOpaqueToken();
    const lifetime = type === AuthTokenType.EMAIL_VERIFICATION ? authTiming.verificationTokenLifetimeMs : authTiming.passwordResetTokenLifetimeMs;
    await database.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
    await database.authToken.create({ data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + lifetime) } });
    return token;
  }
  const emailLinkQuery = z.object({ token: z.string().min(20).max(4096) });
  app.get('/api/v1/email/click', { schema: { tags: ['Notifications'], summary: 'Record an email CTA click and redirect', querystring: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } }, response: { 302: { type: 'null' }, 400: errorResponseSchema } } }, async (request, reply) => {
    const { token } = validate(emailLinkQuery, request.query);
    const link = consumeTrackedEmailLink(token, env);
    await audit('email_clicked', link.userId, request, { type: link.type, destination: link.destination.pathname });
    return reply.redirect(link.destination.toString());
  });
  app.get('/api/v1/email/unsubscribe', { schema: { tags: ['Notifications'], summary: 'Unsubscribe from marketing email', querystring: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } }, response: { 302: { type: 'null' }, 400: errorResponseSchema } } }, async (request, reply) => {
    const { token } = validate(emailLinkQuery, request.query);
    const { userId } = consumeUnsubscribeLink(token, env);
    await database.user.updateMany({ where: { id: userId }, data: { marketingConsent: false } });
    await audit('marketing.unsubscribed', userId, request);
    return reply.redirect(new URL('/email-preferences?status=unsubscribed', env.FRONTEND_APP_URL).toString());
  });
  async function consumeOneTimeToken(token: string, type: AuthTokenType, request?: FastifyRequest) {
    const tokenHash = hashToken(token);
    const now = new Date();

    const existing = await database.authToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing || existing.type !== type) {
      if (request) {
        if (type === AuthTokenType.EMAIL_VERIFICATION) {
          await audit('email.verification_failed', null, request, { reason: 'not_found' });
        } else if (type === AuthTokenType.PASSWORD_RESET) {
          await audit('password.reset_failed', null, request, { reason: 'not_found' });
        }
      }
      throw new AppError(400, 'INVALID_TOKEN', 'This link is invalid or has expired.');
    }

    if (existing.usedAt) {
      if (request) {
        if (type === AuthTokenType.EMAIL_VERIFICATION) {
          await audit('email.verification_failed', existing.userId, request, { reason: 'already_used' });
        } else if (type === AuthTokenType.PASSWORD_RESET) {
          await audit('password.reset_failed', existing.userId, request, { reason: 'already_used' });
        }
      }
      throw new AppError(400, 'INVALID_TOKEN', 'This link has already been used.');
    }

    if (existing.expiresAt <= now) {
      if (request) {
        if (type === AuthTokenType.EMAIL_VERIFICATION) {
          await audit('email.verification_failed', existing.userId, request, { reason: 'expired' });
        } else if (type === AuthTokenType.PASSWORD_RESET) {
          await audit('password.reset_failed', existing.userId, request, { reason: 'expired' });
        }
      }
      throw new AppError(400, 'INVALID_TOKEN', 'This link has expired. Please request a new one.');
    }

    const consumed = await database.authToken.updateMany({
      where: { tokenHash, type, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });

    if (consumed.count !== 1) {
      if (request) {
        if (type === AuthTokenType.EMAIL_VERIFICATION) {
          await audit('email.verification_failed', existing.userId, request, { reason: 'already_used' });
        } else if (type === AuthTokenType.PASSWORD_RESET) {
          await audit('password.reset_failed', existing.userId, request, { reason: 'already_used' });
        }
      }
      throw new AppError(400, 'INVALID_TOKEN', 'This link has already been used.');
    }

    return { user: existing.user, tokenRecord: existing };
  }
  function oauthProvider(provider: OAuthProviderName): OAuthProvider { return provider === 'google' ? OAuthProvider.GOOGLE : OAuthProvider.FACEBOOK; }
  function oauthRedirect(path: string): string { return new URL(path, env.FRONTEND_APP_URL).toString(); }
  async function createOAuthState(provider: OAuthProviderName, purpose: OAuthPurpose, flow: OAuthFlow, rememberMe: boolean, userId?: string) {
    const token = createOpaqueToken(); const nonce = provider === 'google' ? createOpaqueToken() : null;
    await database.oAuthState.create({ data: { tokenHash: hashToken(token), provider: oauthProvider(provider), purpose, flow, rememberMe, userId, nonce, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
    return { token, nonce: nonce ?? '' };
  }
  async function consumeOAuthState(provider: OAuthProviderName, token: string) {
    const tokenHash = hashToken(token); const now = new Date();
    const consumed = await database.oAuthState.updateMany({ where: { tokenHash, provider: oauthProvider(provider), usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (consumed.count !== 1) throw new AppError(400, 'OAUTH_STATE_INVALID', 'This sign-in attempt is invalid or has expired.');
    const state = await database.oAuthState.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!state) throw new AppError(400, 'OAUTH_STATE_INVALID', 'This sign-in attempt is invalid or has expired.');
    return state;
  }
  async function redirectWithOAuthError(reply: FastifyReply, error: string, provider: OAuthProviderName, flow: OAuthFlow = OAuthFlow.REDIRECT) {
    return reply.redirect(oauthRedirect(`/auth/callback?error=${encodeURIComponent(error)}&provider=${provider}${flow === OAuthFlow.POPUP ? '&popup=1' : ''}`));
  }

  async function processEmailVerification(token: string, request: FastifyRequest, reply: FastifyReply) {
    const { user } = await consumeOneTimeToken(token, AuthTokenType.EMAIL_VERIFICATION, request);
    const now = new Date();
    const timeToVerifySeconds = Math.max(0, Math.floor((now.getTime() - user.createdAt.getTime()) / 1000));

    await database.$transaction([
      database.user.update({ where: { id: user.id }, data: { status: UserStatus.ACTIVE, emailVerifiedAt: now } }),
      database.userOnboarding.upsert({
        where: { userId: user.id },
        create: { userId: user.id, stage: OnboardingStage.PHONE_VERIFICATION, emailVerifiedAt: now },
        update: { stage: OnboardingStage.PHONE_VERIFICATION, emailVerifiedAt: now },
      }),
    ]);

    await audit('email.verified', user.id, request, { email: user.email });

    const refresh = await issueRefreshSession(user.id, request, true);
    setRefreshCookie(reply, refresh.token, refresh.lifetimeMs, true);
    const activeUser = await database.user.findUniqueOrThrow({ where: { id: user.id } });

    try {
      await deliver(request, activeUser.id, 'welcome', () => mailer.sendWelcome(activeUser.email, activeUser.firstName, activeUser.id));
    } catch { /* delivery failures are audited and do not interrupt verification */ }

    return { activeUser, refreshId: refresh.id, timeToVerifySeconds };
  }

  app.post('/api/v1/auth/register', { preHandler: limitRegistration, schema: authSchema('Register an email/password account', registrationBodySchema) }, async (request, reply) => {
    const input = validate(registrationSchema, request.body);
    const email = normalizeEmail(input.email);
    const phone = input.phone && input.phone.trim() !== '' ? input.phone.trim() : null;
    const existing = await database.user.findUnique({ where: { email } });
    if (existing) return reply.status(202).send(envelope(request, { accepted: true, verificationRequired: true, nextStep: 'EMAIL_VERIFICATION' }));
    const [terms, privacy] = await currentLegalDocuments(database);
    const passwordHash = await hashPassword(input.password);
    const user = await database.user.create({
      data: {
        email,
        phone,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash,
        passwordSetAt: new Date(),
        marketingConsent: input.marketingConsent ?? false,
        signupSource: input.source ?? 'web_app',
        status: UserStatus.PENDING,
        onboarding: { create: { stage: OnboardingStage.EMAIL_VERIFICATION } },
        legalAcceptances: {
          create: [
            { documentId: terms.id, ip: request.ip, userAgent: clientContext(request).userAgent },
            { documentId: privacy.id, ip: request.ip, userAgent: clientContext(request).userAgent },
          ],
        },
      },
    });
    const plan = input.plan.toUpperCase() as SubscriptionPlan;
    const trialEndsAt = input.plan === 'trial' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null;
    const organization = await database.organization.create({
      data: {
        name: input.organizationName,
        slug: input.organizationSlug.toLowerCase(),
        status: input.plan === 'trial' ? OrganizationStatus.ACTIVE : OrganizationStatus.PENDING_PAYMENT,
        defaultApp: input.plan === 'gym' ? OrvioApp.GYM : OrvioApp.INVENTORY,
      },
    }).catch((error: unknown) => {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new AppError(409, 'ORGANIZATION_SLUG_TAKEN', 'That organization address is already in use.');
      throw error;
    });
    await database.organizationMembership.create({ data: { organizationId: organization.id, userId: user.id, role: 'OWNER', status: 'ACTIVE', acceptedAt: new Date() } });
    await database.organizationSubscription.create({ data: { organizationId: organization.id, plan, status: input.plan === 'trial' ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PENDING, currentPeriodEnd: trialEndsAt } });
    const enabledApps = input.plan === 'gym' ? [OrvioApp.GYM] : input.plan === 'bundle' ? [OrvioApp.INVENTORY, OrvioApp.GYM] : [OrvioApp.INVENTORY];
    await database.organizationEntitlement.createMany({ data: enabledApps.map((app) => ({ organizationId: organization.id, app, expiresAt: trialEndsAt })) });
    const token = await createOneTimeToken(user.id, AuthTokenType.EMAIL_VERIFICATION);
    const verificationSent = await deliver(request, user.id, 'verification', () => mailer.sendVerification(user.email, token, user.id));
    if (verificationSent) await audit('email.verification_sent', user.id, request, { email: user.email });
    await audit('user.registered', user.id, request, {
      email: user.email,
      marketingConsent: String(input.marketingConsent ?? false),
      signupSource: input.source ?? 'web_app',
      hasPhone: String(Boolean(phone)),
    });
    await audit('legal.accepted', user.id, request, { termsVersion: terms.version, privacyVersion: privacy.version });
    return reply.status(202).send(envelope(request, { accepted: true, verificationRequired: true, nextStep: 'EMAIL_VERIFICATION' }));
  });

  app.post('/api/v1/auth/verify-email/confirm', { schema: authSchema('Confirm an email-verification token', tokenBodySchema) }, async (request, reply) => {
    const { token } = validate(tokenSchema, request.body);
    const { activeUser, refreshId, timeToVerifySeconds } = await processEmailVerification(token, request, reply);
    const payload = await sessionPayload(database, env, activeUser, refreshId);
    return envelope(request, { ...payload, timeToVerifySeconds });
  });

  const verifyEmailQuerySchema = z.object({ token: z.string().min(1).max(512) });
  app.get('/api/v1/auth/verify-email', { schema: { tags: ['Authentication'], summary: 'Verify email via direct link and redirect to frontend', querystring: { type: 'object', properties: { token: { type: 'string' } } } } }, async (request, reply) => {
    const query = request.query as { token?: string };
    if (!query.token) {
      return reply.redirect(`${env.FRONTEND_APP_URL}/verify-email?error=invalid_or_expired`);
    }
    try {
      const { token } = validate(verifyEmailQuerySchema, query);
      await processEmailVerification(token, request, reply);
      return reply.redirect(`${env.FRONTEND_APP_URL}/app?verified=1`);
    } catch {
      return reply.redirect(`${env.FRONTEND_APP_URL}/verify-email?error=invalid_or_expired`);
    }
  });

  app.post('/api/v1/auth/verify-email/resend', { preHandler: limitVerificationResend, schema: authSchema('Resend an email-verification link', emailBodySchema) }, async (request) => {
    const email = normalizeEmail(validate(emailSchema, request.body).email);
    const user = await database.user.findUnique({ where: { email } });
    if (user?.status === UserStatus.PENDING && !user.deletedAt) {
      const token = await createOneTimeToken(user.id, AuthTokenType.EMAIL_VERIFICATION);
      const verificationSent = await deliver(request, user.id, 'verification', () => mailer.sendVerification(user.email, token, user.id));
      if (verificationSent) await audit('email.verification_sent', user.id, request, { email: user.email });
    }
    return envelope(request, { accepted: true });
  });

  app.post('/api/v1/auth/login', { preHandler: limitLogin, schema: authSchema('Sign in with email and password', credentialsBodySchema) }, async (request, reply) => {
    const input = validate(credentialsSchema, request.body);
    const email = normalizeEmail(input.email);
    const user = await database.user.findUnique({ where: { email } });
    const passwordOk = await verifyPassword(user?.passwordHash ?? dummyPasswordHash, input.password);

    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE || !passwordOk) {
      const reason = !user
        ? 'user_not_found'
        : user.deletedAt
        ? 'account_deleted'
        : user.status === UserStatus.PENDING
        ? 'email_not_verified'
        : user.status === UserStatus.SUSPENDED
        ? 'account_suspended'
        : 'invalid_password';

      await audit('user.login', user?.id ?? null, request, {
        email,
        success: 'false',
        failure_reason: reason,
        method: 'email_password',
      });
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    // Auto-rehash password if cost parameters were upgraded
    if (user.passwordHash && needsPasswordRehash(user.passwordHash)) {
      const newHash = await hashPassword(input.password);
      await database.user.update({ where: { id: user.id }, data: { passwordHash: newHash } }).catch(() => {});
    }

    // Check if user previously logged in from this IP or User-Agent
    const context = clientContext(request);
    const previousSession = await database.authSession.findFirst({
      where: {
        userId: user.id,
        OR: [
          ...(context.ip ? [{ ip: context.ip }] : []),
          ...(context.userAgent ? [{ userAgent: context.userAgent }] : []),
        ],
      },
    });
    const isNewDevice = !previousSession;

    const refresh = await issueRefreshSession(user.id, request, input.rememberMe);
    setRefreshCookie(reply, refresh.token, refresh.lifetimeMs, input.rememberMe);

    await audit('user.login', user.id, request, {
      email: user.email,
      success: 'true',
      method: 'email_password',
      rememberMe: String(input.rememberMe),
      isNewDevice: String(isNewDevice),
    });

    if (isNewDevice) {
      try {
        await deliver(request, user.id, 'new_device_login', () => mailer.sendNewDeviceLoginNotification(user.email, {
          ip: context.ip,
          userAgent: context.userAgent,
          time: new Date().toUTCString(),
          firstName: user.firstName,
        }, user.id));
      } catch { /* delivery failures are audited and do not interrupt login */ }
    }

    return envelope(request, await sessionPayload(database, env, user, refresh.id));
  });

  app.post('/api/v1/auth/refresh', { schema: authSchema('Rotate the refresh cookie and issue a new access token') }, async (request, reply) => {
    const rawToken = request.cookies[refreshCookie];
    if (!rawToken) throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired.');
    const presentedHash = hashToken(rawToken);
    const now = new Date();

    const session = await database.authSession.findFirst({
      where: {
        OR: [
          { tokenHash: presentedHash },
          { parentTokenHash: presentedHash },
        ],
      },
      include: { user: true },
    });

    if (!session || !session.user || session.user.status !== UserStatus.ACTIVE || session.user.deletedAt) {
      clearRefreshCookie(reply);
      throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired.');
    }

    if (session.revokedAt) {
      clearRefreshCookie(reply);
      throw new AppError(401, 'SESSION_REVOKED', 'This session was ended for security reasons. Please sign in again.');
    }

    // Grace window check for concurrent multi-tab refresh
    if (session.parentTokenHash === presentedHash && session.tokenHash !== presentedHash) {
      if (session.rotatedAt && (now.getTime() - session.rotatedAt.getTime() <= authTiming.rotationGraceWindowMs)) {
        return envelope(request, await sessionPayload(database, env, session.user, session.id));
      } else {
        // Reuse outside grace window -> revoke entire token family
        await database.authSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        await audit('session.revoked', session.userId, request, { reason: 'suspicious_refresh_reuse', familyId: session.familyId, sessionId: session.id });
        clearRefreshCookie(reply);
        throw new AppError(401, 'SESSION_REVOKED', 'This session was ended for security reasons. Please sign in again.');
      }
    }

    // Absolute and idle lifetime checks
    if (session.expiresAt <= now || session.absoluteExpiresAt <= now) {
      await database.authSession.update({ where: { id: session.id }, data: { revokedAt: now } }).catch(() => {});
      clearRefreshCookie(reply);
      throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired.');
    }

    const idleTimeoutMs = session.rememberMe ? authTiming.rememberMeIdleTimeoutMs : authTiming.transientIdleTimeoutMs;
    if (now.getTime() - session.lastActivityAt.getTime() > idleTimeoutMs) {
      await database.authSession.update({ where: { id: session.id }, data: { revokedAt: now } }).catch(() => {});
      clearRefreshCookie(reply);
      throw new AppError(401, 'SESSION_EXPIRED', 'Your session has timed out due to inactivity.');
    }

    const nextRefreshToken = createOpaqueToken();
    const nextTokenHash = hashToken(nextRefreshToken);
    const context = clientContext(request);
    const lifetimeMs = session.rememberMe ? authTiming.rememberMeAbsoluteLifetimeMs : Math.max(0, session.absoluteExpiresAt.getTime() - now.getTime());

    const updated = await database.authSession.updateMany({
      where: { id: session.id, tokenHash: presentedHash, revokedAt: null },
      data: {
        tokenHash: nextTokenHash,
        parentTokenHash: presentedHash,
        rotatedAt: now,
        lastUsedAt: now,
        lastActivityAt: now,
        ...context,
      },
    });

    if (updated.count !== 1) {
      await database.authSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: now },
      });
      await audit('session.revoked', session.userId, request, { reason: 'suspicious_refresh_reuse', familyId: session.familyId, sessionId: session.id });
      clearRefreshCookie(reply);
      throw new AppError(401, 'SESSION_REVOKED', 'This session was ended for security reasons. Please sign in again.');
    }

    setRefreshCookie(reply, nextRefreshToken, lifetimeMs, session.rememberMe);
    await audit('session.refresh', session.userId, request, { sessionId: session.id, familyId: session.familyId });
    return envelope(request, await sessionPayload(database, env, session.user, session.id));
  });

  app.post('/api/v1/auth/logout', { schema: authSchema('Revoke the active refresh session', undefined, true) }, async (request, reply) => {
    const claims = await authenticateRequest(request, env, database);
    const rawToken = request.cookies[refreshCookie];
    await database.authSession.updateMany({
      where: {
        OR: [
          { id: claims.sid, userId: claims.sub, revokedAt: null },
          ...(rawToken ? [{ tokenHash: hashToken(rawToken), userId: claims.sub, revokedAt: null }] : []),
        ],
      },
      data: { revokedAt: new Date() },
    });
    clearRefreshCookie(reply);
    await audit('user.logout', claims.sub, request, { method: 'manual' });
    await audit('session.revoked', claims.sub, request, { reason: 'logout', sessionId: claims.sid });
    return envelope(request, { loggedOut: true });
  });

  app.post('/api/v1/auth/reset-password', { preHandler: limitPasswordReset, schema: authSchema('Request a password-reset link', emailBodySchema) }, async (request) => {
    const email = normalizeEmail(validate(emailSchema, request.body).email);
    const user = await database.user.findUnique({ where: { email } });
    if (user?.status === UserStatus.ACTIVE && !user.deletedAt) {
      const token = await createOneTimeToken(user.id, AuthTokenType.PASSWORD_RESET);
      await deliver(request, user.id, 'password_reset', () => mailer.sendPasswordReset(user.email, token, user.id));
      await audit('password.reset_requested', user.id, request, { email: user.email });
    } else {
      await audit('password.reset_requested', null, request, { email, reason: 'user_not_found' });
    }
    return envelope(request, { accepted: true });
  });

  app.get('/api/v1/auth/reset-password', { schema: { tags: ['Authentication'], summary: 'Fallback password reset link redirect to frontend', querystring: { type: 'object', properties: { token: { type: 'string' } } } } }, async (request, reply) => {
    const query = request.query as { token?: string };
    if (!query.token) {
      return reply.redirect(`${env.FRONTEND_APP_URL}/reset-password?error=invalid_or_expired`);
    }
    return reply.redirect(`${env.FRONTEND_APP_URL}/reset-password/confirm?token=${encodeURIComponent(query.token)}`);
  });

  app.post('/api/v1/auth/reset-password/confirm', { schema: authSchema('Confirm a password reset', { ...tokenBodySchema, required: ['token', 'password'], properties: { ...tokenBodySchema.properties, password: strongPasswordBodySchema } }) }, async (request) => {
    const input = validate(tokenSchema.extend({ password: strongPassword }), request.body);
    const { user, tokenRecord } = await consumeOneTimeToken(input.token, AuthTokenType.PASSWORD_RESET, request);
    const now = new Date();
    const timeToResetSeconds = Math.max(0, Math.floor((now.getTime() - tokenRecord.createdAt.getTime()) / 1000));
    const passwordHash = await hashPassword(input.password);

    await database.$transaction([
      database.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordSetAt: now },
      }),
      database.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    await deliver(request, user.id, 'password_changed', () => mailer.sendPasswordChangedNotification(user.email, user.id));

    await audit('password.reset_completed', user.id, request, {
      timeToResetSeconds: String(timeToResetSeconds),
      email: user.email,
    });

    return envelope(request, { passwordReset: true, timeToResetSeconds });
  });

  app.get('/api/v1/auth/oauth/:provider', { schema: { tags: ['Authentication'], summary: 'Start a Google or Facebook sign-in redirect', params: providerParamsSchema, response: { 302: { description: 'Redirects to the provider authorization page' }, 400: errorResponseSchema, 503: errorResponseSchema } } }, async (request, reply) => {
    const provider = (request.params as { provider: string }).provider;
    if (!isOAuthProvider(provider)) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'The requested provider was not found.');
    const input = validate(oauthStartSchema, request.query);
    const state = await createOAuthState(provider, OAuthPurpose.SIGN_IN, input.flow === 'popup' ? OAuthFlow.POPUP : OAuthFlow.REDIRECT, input.rememberMe);
    return reply.redirect(providerAuthorizationUrl(env, provider, state.token, state.nonce));
  });

  app.get('/api/v1/auth/providers', { schema: authSchema('List configured social sign-in providers') }, async (request) => envelope(request, { google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), facebook: Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET) }));

  app.post('/api/v1/auth/oauth/:provider/link', { schema: { ...authSchema('Start authenticated Google or Facebook account linking', undefined, true), params: providerParamsSchema } }, async (request) => {
    const provider = (request.params as { provider: string }).provider;
    if (!isOAuthProvider(provider)) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'The requested provider was not found.');
    const { claims } = await requireActiveUser(request, env, database); const input = validate(oauthStartSchema, request.body ?? {}); const state = await createOAuthState(provider, OAuthPurpose.LINK, input.flow === 'popup' ? OAuthFlow.POPUP : OAuthFlow.REDIRECT, input.rememberMe, claims.sub);
    return envelope(request, { authorizationUrl: providerAuthorizationUrl(env, provider, state.token, state.nonce) });
  });

  app.get('/api/v1/auth/oauth/:provider/callback', { schema: { tags: ['Authentication'], summary: 'Complete a Google or Facebook callback', params: providerParamsSchema, querystring: { type: 'object', properties: { state: { type: 'string' }, code: { type: 'string' }, error: { type: 'string' } } }, response: { 302: { description: 'Redirects to the frontend completion or error page' }, 400: errorResponseSchema } } }, async (request, reply) => {
    const provider = (request.params as { provider: string }).provider;
    if (!isOAuthProvider(provider)) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'The requested provider was not found.');
    const query = request.query as { state?: string; code?: string; error?: string };
    if (query.error || !query.state || !query.code) return redirectWithOAuthError(reply, query.error ?? 'oauth_failed', provider);
    try {
      const state = await consumeOAuthState(provider, query.state); const profile = await resolveProviderProfile(env, provider, query.code, state.nonce);
      const existing = await database.oAuthIdentity.findUnique({ where: { provider_providerSubject: { provider: oauthProvider(provider), providerSubject: profile.subject } }, include: { user: true } });
      if (state.purpose === OAuthPurpose.LINK) {
        if (!state.user || state.user.status !== UserStatus.ACTIVE || state.user.deletedAt || state.user.email !== profile.email) return redirectWithOAuthError(reply, 'link_email_mismatch', provider, state.flow);
        if (existing && existing.userId !== state.user.id) return redirectWithOAuthError(reply, 'identity_already_linked', provider, state.flow);
        if (!existing) await database.oAuthIdentity.create({ data: { userId: state.user.id, provider: oauthProvider(provider), providerSubject: profile.subject, email: profile.email } });
        await audit('auth.oauth_linked', state.user.id, request, { provider });
        return reply.redirect(oauthRedirect(`/auth/callback?linked=${provider}${state.flow === OAuthFlow.POPUP ? '&popup=1' : ''}`));
      }
      let user = existing?.user;
      if (!user) {
        const localUser = await database.user.findUnique({ where: { email: profile.email } });
        if (localUser) { await audit('auth.oauth_link_required', localUser.id, request, { provider }); return reply.redirect(oauthRedirect(`/login?oauth=link_required&provider=${provider}`)); }
        user = await database.user.create({ data: { email: profile.email, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), onboarding: { create: { stage: OnboardingStage.PROFILE, emailVerifiedAt: new Date() } } } });
        await database.oAuthIdentity.create({ data: { userId: user.id, provider: oauthProvider(provider), providerSubject: profile.subject, email: profile.email } });
        await audit('auth.oauth_registered', user.id, request, { provider });
      }
      if (user.status !== UserStatus.ACTIVE || user.deletedAt) return redirectWithOAuthError(reply, 'account_unavailable', provider, state.flow);
      const refresh = await issueRefreshSession(user.id, request, state.rememberMe); setRefreshCookie(reply, refresh.token, refresh.lifetimeMs, state.rememberMe); await audit('auth.oauth_signed_in', user.id, request, { provider });
      return reply.redirect(oauthRedirect(`/auth/callback?provider=${provider}${state.flow === OAuthFlow.POPUP ? '&popup=1' : ''}`));
    } catch (error) {
      if (error instanceof AppError && error.code === 'OAUTH_EMAIL_REQUIRED') return redirectWithOAuthError(reply, 'email_required', provider);
      request.log.warn({ err: error, provider }, 'OAuth callback failed'); return redirectWithOAuthError(reply, 'oauth_failed', provider);
    }
  });

  app.get('/api/v1/auth/me', { schema: authSchema('Get the current authenticated user', undefined, true) }, async (request) => {
    const claims = await authenticateRequest(request, env, database); const user = await database.user.findUnique({ where: { id: claims.sub } });
    if (!user || user.status !== UserStatus.ACTIVE || user.deletedAt) throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired.');
    return envelope(request, await sessionPayload(database, env, user, claims.sid));
  });

  app.get('/api/v1/auth/sessions', { schema: authSchema('List active sessions', undefined, true) }, async (request) => {
    const { claims } = await requireActiveUser(request, env, database);
    const sessions = await database.authSession.findMany({ where: { userId: claims.sub, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: 'desc' } });
    return envelope(request, sessions.map((session) => ({ id: session.id, createdAt: session.createdAt, lastUsedAt: session.lastUsedAt, expiresAt: session.expiresAt, ip: session.ip, userAgent: session.userAgent, current: session.id === claims.sid })));
  });

  app.delete('/api/v1/auth/sessions/:id', { schema: authSchema('Revoke one session', undefined, true) }, async (request, reply) => {
    const { claims } = await requireActiveUser(request, env, database); const id = (request.params as { id: string }).id;
    const session = await database.authSession.findFirst({ where: { id, userId: claims.sub, revokedAt: null } });
    if (!session) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'The session was not found.');
    await database.authSession.update({ where: { id }, data: { revokedAt: new Date() } });
    if (request.cookies[refreshCookie] && session.tokenHash === hashToken(request.cookies[refreshCookie])) clearRefreshCookie(reply);
    await audit('session.revoked', claims.sub, request, { sessionId: id, reason: 'manual' }); return envelope(request, { revoked: true });
  });

  app.post('/api/v1/auth/sessions/revoke-others', { schema: authSchema('Revoke all other sessions', undefined, true) }, async (request) => {
    const { claims } = await requireActiveUser(request, env, database);
    await database.authSession.updateMany({
      where: { userId: claims.sub, id: { not: claims.sid }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await audit('session.revoked', claims.sub, request, { reason: 'manual_revoke_others', currentSessionId: claims.sid });
    return envelope(request, { revoked: true });
  });

  app.patch('/api/v1/auth/profile', { schema: authSchema('Update first and last name', { type: 'object', required: ['firstName', 'lastName'], properties: { firstName: { type: 'string' }, lastName: { type: 'string' } } }, true) }, async (request) => {
    const { claims } = await requireActiveUser(request, env, database); const input = validate(profileSchema, request.body);
    const user = await database.user.update({ where: { id: claims.sub }, data: input }); await audit('auth.profile_updated', user.id, request);
    return envelope(request, await sessionPayload(database, env, user, claims.sid));
  });

  async function updateLocalPassword(
    request: FastifyRequest,
    input: { currentPassword?: string; newPassword: string; revokeOtherSessions: boolean },
    requireExistingPassword: boolean,
  ) {
    const { claims } = await requireActiveUser(request, env, database);
    const user = await database.user.findUniqueOrThrow({ where: { id: claims.sub } });

    if (requireExistingPassword && !user.passwordHash) {
      throw new AppError(400, 'PASSWORD_NOT_SET', 'Set a password before changing it.');
    }
    if (user.passwordHash && (!input.currentPassword || !(await verifyPassword(user.passwordHash, input.currentPassword)))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
    }

    await database.user.update({
      where: { id: claims.sub },
      data: { passwordHash: await hashPassword(input.newPassword), passwordSetAt: new Date() },
    });

    let revokedOtherSessions = false;
    if (input.revokeOtherSessions) {
      const revoked = await database.authSession.updateMany({
        where: { userId: claims.sub, id: { not: claims.sid }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      revokedOtherSessions = revoked.count > 0;
    }

    await audit('password.changed', user.id, request, { otherSessionsRevoked: String(revokedOtherSessions) });
    await deliver(request, user.id, 'password_changed', () => mailer.sendPasswordChangedNotification(user.email, user.id));
    return { claims, revokedOtherSessions };
  }

  app.post('/api/v1/auth/change-password', { preHandler: limitSetPassword, schema: authSchema('Change an existing local password', changePasswordBodySchema, true) }, async (request) => {
    const input = validate(changePasswordSchema, request.body);
    const { revokedOtherSessions } = await updateLocalPassword(request, input, true);
    return envelope(request, { passwordChanged: true, revokedOtherSessions });
  });

  app.post('/api/v1/auth/set-password', { preHandler: limitSetPassword, schema: authSchema('Set a local password for an OAuth account', setPasswordBodySchema, true) }, async (request) => {
    const input = validate(setPasswordSchema, request.body);
    const { claims } = await updateLocalPassword(request, { currentPassword: input.currentPassword, newPassword: input.password, revokeOtherSessions: input.revokeOtherSessions }, false);
    const updatedUser = await database.user.findUniqueOrThrow({ where: { id: claims.sub } });
    return envelope(request, await sessionPayload(database, env, updatedUser, claims.sid));
  });
}
