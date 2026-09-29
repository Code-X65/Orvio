import { OnboardingStage } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createHmac, randomInt } from 'node:crypto';
import { z } from 'zod';

import type { AppEnv } from '../../config/env.js';
import type { DatabaseClient } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../lib/app-error.js';
import { validate } from '../../lib/validation.js';
import { authenticateRequest } from '../auth/auth-context.js';
import { currentLegalDocuments } from '../auth/legal.js';
import { createTermiiSender, type PhoneMessageSender } from '../auth/sms.js';
import { createBrevoMailSender, type AuthMailSender } from '../auth/mail.js';
import { deliverNotificationEmail } from '../auth/notification-delivery.js';
import { writeAuditEvent, type AuditEvent } from '../auth/audit.js';
import { enforceAuthRateLimit } from '../auth/rate-limiter.js';
import { validateInternationalPhone } from '../../lib/phone.js';

const nameSchema = z.string().trim().min(1).max(80);
const profileSchema = z.object({ firstName: nameSchema, lastName: nameSchema, acceptTerms: z.literal(true), acceptPrivacy: z.literal(true) });
const phoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .superRefine((val, ctx) => {
      const res = validateInternationalPhone(val);
      if (!res.valid) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.message });
      }
    }),
});
const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the six-digit code.') });
const otherDetailSchema = z.string().trim().min(1).max(120);
const surveyOptionSchema = <T extends readonly [string, ...string[]]>(options: T) => z.object({ value: z.enum(options), otherDetail: otherDetailSchema.optional() }).superRefine((answer, ctx) => {
  if (answer.value === 'other' && !answer.otherDetail) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['otherDetail'], message: 'Please tell us more.' });
});
const surveyAnswersSchema = z.object({
  useCase: surveyOptionSchema(['inventory_management', 'pos', 'whatsapp_orders', 'all_of_the_above', 'other']),
  discoverySource: surveyOptionSchema(['google_search', 'social_media', 'friend_or_colleague', 'ad', 'other']),
  businessType: surveyOptionSchema(['retail', 'wholesale', 'pharmacy', 'restaurant', 'other']),
  productCount: z.enum(['1_50', '51_200', '201_1000', '1000_plus']),
  existingSoftware: z.object({ usesSoftware: z.boolean(), softwareName: otherDetailSchema.optional() }).superRefine((answer, ctx) => {
    if (answer.usesSoftware && !answer.softwareName) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['softwareName'], message: 'Enter the software you use.' });
  }),
  supportPhone: z.string().trim().optional().or(z.literal('')).superRefine((phone, ctx) => {
    if (!phone) return;
    const result = validateInternationalPhone(phone);
    if (!result.valid) ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
  }),
});
const surveySubmissionSchema = z.discriminatedUnion('action', [z.object({ action: z.literal('skip') }), z.object({ action: z.literal('complete'), answers: surveyAnswersSchema })]);
const errorResponse = { type: 'object', required: ['error'], properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, details: { nullable: true }, requestId: { type: 'string' } } } } } as const;
const envelope = { type: 'object', required: ['data', 'meta'], properties: { data: { type: 'object', additionalProperties: true }, meta: { type: 'object', properties: { requestId: { type: 'string' } } } } } as const;
function response(request: FastifyRequest, data: unknown) { return { data, meta: { requestId: request.id } }; }
function context(request: FastifyRequest) { return { ip: request.ip, userAgent: request.headers['user-agent']?.slice(0, 512) }; }
function hashOtp(secret: string, phone: string, code: string) { return createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex'); }

export interface OnboardingRouteOptions { env: AppEnv; database: DatabaseClient; sms?: PhoneMessageSender; mailer?: AuthMailSender }

export async function registerOnboardingRoutes(app: FastifyInstance, options: OnboardingRouteOptions): Promise<void> {
  const { env, database } = options;
  const sms = options.sms ?? createTermiiSender(env);
  const mailer = options.mailer ?? createBrevoMailSender(env);
  async function audit(event: AuditEvent, userId: string, request: FastifyRequest, metadata?: Record<string, string>) { await writeAuditEvent(database, event, userId, request, metadata); }
  async function userFor(request: FastifyRequest) {
    const claims = await authenticateRequest(request, env, database);
    const user = await database.user.findUnique({ where: { id: claims.sub }, include: { onboarding: true } });
    if (!user || user.status !== 'ACTIVE' || user.deletedAt) throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired.');
    return user;
  }
  async function requireStage(request: FastifyRequest, allowed: OnboardingStage[]) {
    const user = await userFor(request);
    const stage = user.onboarding?.stage ?? OnboardingStage.PROFILE;
    if (!allowed.includes(stage)) throw new AppError(409, 'ONBOARDING_STEP_UNAVAILABLE', 'Complete the previous onboarding step first.');
    return user;
  }
  async function surveyContext(request: FastifyRequest) {
    const claims = await authenticateRequest(request, env, database);
    const [user, session] = await Promise.all([
      database.user.findUnique({ where: { id: claims.sub }, include: { onboarding: true } }),
      database.authSession.findUnique({ where: { id: claims.sid }, select: { familyId: true } }),
    ]);
    if (!user || user.status !== 'ACTIVE' || user.deletedAt || !session || !user.onboardingCompletedAt || user.onboarding?.stage !== OnboardingStage.COMPLETE) {
      throw new AppError(409, 'ONBOARDING_STEP_UNAVAILABLE', 'Complete phone verification before taking the survey.');
    }
    return { user, familyId: session.familyId };
  }

  const surveyBody = { type: 'object', required: ['action'], properties: { action: { type: 'string', enum: ['skip', 'complete'] }, answers: { type: 'object' } } } as const;
  app.get('/api/v1/onboarding/survey/status', { schema: { tags: ['Onboarding'], summary: 'Get onboarding survey status', security: [{ bearerAuth: [] }], response: { 200: envelope, 401: errorResponse, 409: errorResponse } } }, async (request) => {
    const { user, familyId } = await surveyContext(request);
    const survey = await database.onboardingResponse.findUnique({ where: { userId: user.id } });
    const completed = Boolean(survey?.completed);
    return response(request, { completed, required: !completed && survey?.skippedSessionFamilyId !== familyId });
  });

  app.post('/api/v1/onboarding/survey/started', { schema: { tags: ['Onboarding'], summary: 'Record that onboarding survey was viewed', security: [{ bearerAuth: [] }], response: { 200: envelope, 401: errorResponse, 409: errorResponse } } }, async (request) => {
    const { user, familyId } = await surveyContext(request);
    const survey = await database.onboardingResponse.findUnique({ where: { userId: user.id } });
    const required = !survey?.completed && survey?.skippedSessionFamilyId !== familyId;
    if (required) await audit('onboarding.started', user.id, request);
    return response(request, { started: required });
  });

  app.post('/api/v1/onboarding/survey', { schema: { tags: ['Onboarding'], summary: 'Submit or skip onboarding survey', security: [{ bearerAuth: [] }], body: surveyBody, response: { 200: envelope, 400: errorResponse, 401: errorResponse, 409: errorResponse } } }, async (request) => {
    const { user, familyId } = await surveyContext(request);
    const input = validate(surveySubmissionSchema, request.body);
    const existing = await database.onboardingResponse.findUnique({ where: { userId: user.id } });
    if (existing?.completed) throw new AppError(409, 'SURVEY_ALREADY_COMPLETED', 'The onboarding survey has already been completed.');

    if (input.action === 'skip') {
      await database.onboardingResponse.upsert({ where: { userId: user.id }, create: { userId: user.id, completed: false, skippedSessionFamilyId: familyId }, update: { completed: false, skippedSessionFamilyId: familyId } });
      await audit('onboarding.skipped', user.id, request);
      return response(request, { completed: false, required: false });
    }

    const answers = input.answers;
    await database.onboardingResponse.upsert({ where: { userId: user.id }, create: { userId: user.id, answersJson: answers, completed: true, skippedSessionFamilyId: null }, update: { answersJson: answers, completed: true, skippedSessionFamilyId: null } });
    await audit('onboarding.completed', user.id, request, {
      useCase: answers.useCase.value,
      discoverySource: answers.discoverySource.value,
      businessType: answers.businessType.value,
      productCount: answers.productCount,
      usesSoftware: String(answers.existingSoftware.usesSoftware),
    });
    if (mailer.sendOnboardingTips) await deliverNotificationEmail({ database, request, userId: user.id, type: 'onboarding_tips', send: () => mailer.sendOnboardingTips!(user.email, { firstName: user.firstName, useCase: answers.useCase.value, businessType: answers.businessType.value }, user.id) });
    return response(request, { completed: true, required: false });
  });

  app.get('/api/v1/legal/:type', { schema: { tags: ['Onboarding'], summary: 'Get the current public legal document', params: { type: 'object', required: ['type'], properties: { type: { type: 'string', enum: ['terms', 'privacy'] } } }, response: { 200: envelope, 404: errorResponse } } }, async (request) => {
    const type = (request.params as { type: string }).type === 'terms' ? 'TERMS' : (request.params as { type: string }).type === 'privacy' ? 'PRIVACY' : null;
    if (!type) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'The requested legal document was not found.');
    const document = await database.legalDocument.findFirst({ where: { type, isCurrent: true } });
    if (!document) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'The requested legal document was not found.');
    return response(request, { type: document.type.toLowerCase(), version: document.version, title: document.title, content: document.content });
  });

  app.post('/api/v1/onboarding/profile', { schema: { tags: ['Onboarding'], summary: 'Complete a personal profile and legal acceptance', security: [{ bearerAuth: [] }], body: { type: 'object', required: ['firstName', 'lastName', 'acceptTerms', 'acceptPrivacy'], properties: { firstName: { type: 'string' }, lastName: { type: 'string' }, acceptTerms: { type: 'boolean', const: true }, acceptPrivacy: { type: 'boolean', const: true } } }, response: { 200: envelope, 401: errorResponse, 409: errorResponse, 503: errorResponse } } }, async (request) => {
    const user = await requireStage(request, [OnboardingStage.PROFILE]); const input = validate(profileSchema, request.body); const [terms, privacy] = await currentLegalDocuments(database); const now = new Date();
    await database.$transaction([
      database.user.update({ where: { id: user.id }, data: { firstName: input.firstName, lastName: input.lastName } }),
      database.legalAcceptance.createMany({ data: [{ userId: user.id, documentId: terms.id, ip: request.ip, userAgent: context(request).userAgent }, { userId: user.id, documentId: privacy.id, ip: request.ip, userAgent: context(request).userAgent }], skipDuplicates: true }),
      database.userOnboarding.upsert({ where: { userId: user.id }, create: { userId: user.id, stage: user.emailVerifiedAt ? OnboardingStage.PHONE_VERIFICATION : OnboardingStage.EMAIL_VERIFICATION }, update: { stage: user.emailVerifiedAt ? OnboardingStage.PHONE_VERIFICATION : OnboardingStage.EMAIL_VERIFICATION, updatedAt: now } }),
    ]);
    await audit('onboarding.profile_completed', user.id, request); return response(request, { nextStep: user.emailVerifiedAt ? 'PHONE_VERIFICATION' : 'EMAIL_VERIFICATION' });
  });

  app.post('/api/v1/auth/phone/request', { schema: { tags: ['Authentication', 'Onboarding'], summary: 'Send a phone verification OTP', security: [{ bearerAuth: [] }], body: { type: 'object', required: ['phone'], properties: { phone: { type: 'string' } } }, response: { 200: envelope, 400: errorResponse, 401: errorResponse, 409: errorResponse, 429: errorResponse, 503: errorResponse } } }, async (request, reply) => {
    const user = await requireStage(request, [OnboardingStage.PHONE_VERIFICATION]); const { phone } = validate(phoneSchema, request.body);
    await enforceAuthRateLimit({
      database,
      action: 'phone_otp_request',
      ip: request.ip,
      identity: phone,
      max: env.AUTH_RATE_LIMIT_OTP_MAX,
      windowMs: env.AUTH_RATE_LIMIT_OTP_WINDOW_MS,
    });
    const existingPhone = await database.user.findFirst({ where: { phone, id: { not: user.id } } }); if (existingPhone) return response(request, { sent: true, expiresInSeconds: 600 });
    const since = new Date(Date.now() - 60 * 60 * 1000); const sends = await database.phoneVerification.count({ where: { userId: user.id, createdAt: { gte: since } } }); if (sends >= 3) { const oldest = await database.phoneVerification.findFirst({ where: { userId: user.id, createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } }); const retryAfterSeconds = Math.max(1, Math.ceil(((oldest?.createdAt.getTime() ?? Date.now()) + 60 * 60 * 1000 - Date.now()) / 1000)); reply.header('retry-after', String(retryAfterSeconds)); throw new AppError(429, 'PHONE_SEND_LIMITED', 'You have requested too many codes. Please try again later.', { retryAfterSeconds }); }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0'); const now = new Date();
    await database.phoneVerification.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    await database.phoneVerification.create({ data: { userId: user.id, phone, codeHash: hashOtp(env.JWT_SECRET, phone, code), expiresAt: new Date(Date.now() + 10 * 60 * 1000), resendCount: sends } });
    await sms.sendVerificationCode(phone, code);
    if (env.NODE_ENV !== 'production') {
      request.log.info({ phone, code }, `[AUTH OTP] Verification code for ${phone}: ${code}`);
    }
    await audit('auth.phone_otp_sent', user.id, request);
    return response(request, { sent: true, expiresInSeconds: 600 });
  });

  app.post('/api/v1/auth/phone/confirm', { schema: { tags: ['Authentication', 'Onboarding'], summary: 'Confirm a phone verification OTP', security: [{ bearerAuth: [] }], body: { type: 'object', required: ['code'], properties: { code: { type: 'string', pattern: '^\\d{6}$' } } }, response: { 200: envelope, 400: errorResponse, 401: errorResponse, 409: errorResponse } } }, async (request) => {
    const user = await requireStage(request, [OnboardingStage.PHONE_VERIFICATION]); const { code } = validate(codeSchema, request.body); const verification = await database.phoneVerification.findFirst({ where: { userId: user.id, usedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!verification || verification.expiresAt <= new Date()) throw new AppError(400, 'PHONE_CODE_INVALID', 'This code is invalid or has expired.');
    await enforceAuthRateLimit({
      database,
      action: 'phone_otp_confirm',
      ip: request.ip,
      identity: verification.phone,
      max: 5,
      windowMs: env.AUTH_RATE_LIMIT_OTP_WINDOW_MS,
    });
    if (verification.codeHash !== hashOtp(env.JWT_SECRET, verification.phone, code)) { const attempted = await database.phoneVerification.updateMany({ where: { id: verification.id, usedAt: null, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } }); if (attempted.count !== 1) throw new AppError(429, 'PHONE_CODE_LOCKED', 'Too many incorrect codes. Request a new code.'); await audit('auth.phone_otp_failed', user.id, request); throw new AppError(400, 'PHONE_CODE_INVALID', 'This code is invalid or has expired.'); }
    const phoneOwner = await database.user.findFirst({ where: { phone: verification.phone, id: { not: user.id } } }); if (phoneOwner) throw new AppError(409, 'PHONE_IN_USE', 'This phone number is already linked to another account.');
    const now = new Date(); await database.$transaction([database.phoneVerification.update({ where: { id: verification.id }, data: { usedAt: now } }), database.user.update({ where: { id: user.id }, data: { phone: verification.phone, phoneVerifiedAt: now, onboardingCompletedAt: now } }), database.userOnboarding.update({ where: { userId: user.id }, data: { stage: OnboardingStage.COMPLETE, phoneVerifiedAt: now, completedAt: now } })]); await audit('auth.phone_verified', user.id, request);
    return response(request, { verified: true, nextStep: 'COMPLETE' });
  });
}
