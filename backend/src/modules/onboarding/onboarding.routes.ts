import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OnboardingService } from './onboarding.service.js';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireIdempotency } from '../../middleware/idempotency.js';
import { sendData } from '../../lib/envelope.js';
import { AppError } from '../../lib/errors.js';
import {
  stepKeyParamSchema,
  organizationBasicsSchema,
  businessDetailsSchema,
  applicationSelectionSchema,
  primaryBranchSchema,
  teamInvitesSchema,
} from './schemas.js';

export async function onboardingRoutes(app: FastifyInstance) {
  // GET /api/v1/onboarding/organization
  app.get(
    '/organization',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Onboarding'],
        summary: 'Get active organization onboarding flow state, catalog, and checkpoints',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.auth?.user?.id ?? request.auth?.claims?.sub;
      if (!userId) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const emailSvc = (request.server as any).emailSender;
      const onboardingSvc = new OnboardingService(db, emailSvc);

      const result = await onboardingSvc.getOrganizationFlow(userId);
      return sendData(reply, result, 200);
    }
  );

  // PUT /api/v1/onboarding/organization/steps/:step
  app.put(
    '/organization/steps/:step',
    {
      preHandler: [requireAuth, requireIdempotency()],
      schema: {
        tags: ['Onboarding'],
        summary: 'Submit or update a step in the organization onboarding flow',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.auth?.user?.id ?? request.auth?.claims?.sub;
      if (!userId) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { step } = stepKeyParamSchema.parse(request.params);
      const rawBody = request.body || {};

      let validatedPayload: any;
      switch (step) {
        case 'organization_basics':
          validatedPayload = organizationBasicsSchema.parse(rawBody);
          break;
        case 'business_details':
          validatedPayload = businessDetailsSchema.parse(rawBody);
          break;
        case 'application_selection':
          validatedPayload = applicationSelectionSchema.parse(rawBody);
          break;
        case 'primary_branch':
          validatedPayload = primaryBranchSchema.parse(rawBody);
          break;
        case 'team_invites':
          validatedPayload = teamInvitesSchema.parse(rawBody);
          break;
        default:
          throw new AppError('INVALID_STEP', `Step ${step} cannot be submitted via this endpoint`, 400);
      }

      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const emailSvc = (request.server as any).emailSender;
      const onboardingSvc = new OnboardingService(db, emailSvc);

      const result = await onboardingSvc.updateStep(userId, step, validatedPayload);
      return sendData(reply, result, 200);
    }
  );

  // POST /api/v1/onboarding/organization/complete
  app.post(
    '/organization/complete',
    {
      preHandler: [requireAuth, requireIdempotency()],
      schema: {
        tags: ['Onboarding'],
        summary: 'Finalize organization onboarding and mark workspace fully active',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.auth?.user?.id ?? request.auth?.claims?.sub;
      if (!userId) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
      const emailSvc = (request.server as any).emailSender;
      const onboardingSvc = new OnboardingService(db, emailSvc);

      const result = await onboardingSvc.completeFlow(userId);
      return sendData(reply, result, 200);
    }
  );
}
