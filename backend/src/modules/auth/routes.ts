import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './service.js';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { emailSender as defaultEmailSender, type EmailSender } from '../email/index.js';
import {
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginSchema,
  magicLoginSchema,
  refreshSchema,
  checkEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  logoutSchema,
  revokeSessionParamsSchema,
  revokeAllSessionsQuerySchema,
  updateProfileSchema,
  changeEmailRequestSchema,
  changeEmailConfirmSchema,
  requestPhoneOtpSchema,
  verifyPhoneOtpSchema,
  deleteAccountSchema,
  auditLogQuerySchema,
} from './schemas.js';
import { startTrialSchema, setupPasswordAndVerifySchema } from './trial.schema.js';
import { AUTH_RATE_LIMITS } from './rate-limiter.js';
import { sendData } from '../../lib/envelope.js';
import { AppError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { verifyAccessToken, getPublicJwks } from '../../lib/tokens.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireIdempotency } from '../../middleware/idempotency.js';

export async function authRoutes(app: FastifyInstance) {
  function getAuthCookieOptions(overrides: Record<string, any> = {}) {
    const domain = env.COOKIE_DOMAIN || undefined;
    return {
      path: '/',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      ...(domain ? { domain } : {}),
      ...overrides,
    };
  }

  function getAuthService(request: FastifyRequest): AuthService {
    const db = (request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma;
    const emailSvc = (request.server as { emailSender?: EmailSender }).emailSender ?? defaultEmailSender;
    return new AuthService(db, emailSvc);
  }

  // 0. Start Free Trial (Application Selection & Organization Setup)
  app.post(
    '/trial',
    {
      preHandler: [requireIdempotency()],
      config: {
        rateLimit: AUTH_RATE_LIMITS.register,
      },
      schema: {
        tags: ['Auth'],
        summary: 'Start Free Trial with application selection and organization setup',
        description:
          'Validates subdomain availability, phone and email uniqueness, creates unverified user and trial organization.',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const body = startTrialSchema.parse(request.body);
      const result = await authService.startTrial(body, request.ip);

      reply.setCookie('refreshToken', result.refreshToken, getAuthCookieOptions({
        maxAge: env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
      }));

      const { refreshToken: _refreshToken, ...response } = result;
      return sendData(reply, response, 201);
    }
  );

  // 0.1 Setup Password and Verify Email via Magic Link
  app.post(
    '/setup-password-and-verify',
    {
      preHandler: [requireIdempotency()],
      config: {
        rateLimit: AUTH_RATE_LIMITS.register,
      },
      schema: {
        tags: ['Auth'],
        summary: 'Set permanent password and verify email from magic link',
        description: 'Validates verification token, updates password, marks email verified, and returns session.',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const body = setupPasswordAndVerifySchema.parse(request.body);
      const result = await authService.setupPasswordAndVerify(body, request.ip);

      reply.setCookie('refreshToken', result.refreshToken, getAuthCookieOptions({
        maxAge: env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
      }));

      const { refreshToken: _refreshToken, ...response } = result;
      return sendData(reply, response, 200);
    }
  );

  // 1. Account & Organization Registration (5 requests per hour per IP)
  app.post(
    '/register',
    {
      preHandler: [requireIdempotency()],
      config: {
        rateLimit: AUTH_RATE_LIMITS.register,
      },
      schema: {
        tags: ['Auth'],
        summary: 'Create user account and organization during signup',
        description:
          'Atomic transaction creating administrator user, pending organization with chosen plan/timezone/currency, owner membership, and default store branch.',
        body: {
          type: 'object',
          required: ['email', 'password', 'fullName', 'organizationName', 'subdomain'],
          properties: {
            email: { type: 'string', format: 'email', examples: ['alex@company.com'] },
            password: { type: 'string', minLength: 8, examples: ['Password123!'] },
            fullName: { type: 'string', minLength: 2, examples: ['Alex Adeleke'] },
            phone: { type: 'string', examples: ['+2348012345678'] },
            organizationName: { type: 'string', minLength: 2, examples: ['Apex Supermarket'] },
            subdomain: { type: 'string', minLength: 3, maxLength: 30, examples: ['apexsupermarket'] },
            planCode: { type: 'string', enum: ['inventory', 'gym', 'bundle'], default: 'bundle' },
            timezone: { type: 'string', default: 'Africa/Lagos' },
            currency: { type: 'string', default: 'NGN' },
            termsAccepted: { type: 'boolean' },
            marketingOptIn: { type: 'boolean' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              status: { type: 'string', examples: ['success'] },
              data: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  email: { type: 'string', examples: ['alex@company.com'] },
                  fullName: { type: 'string', examples: ['Alex Adeleke'] },
                  organization: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string', examples: ['Apex Supermarket'] },
                      subdomain: { type: 'string', examples: ['apexsupermarket'] },
                      status: { type: 'string', examples: ['pending'] },
                      planCode: { type: 'string', examples: ['bundle'] },
                      url: { type: 'string', examples: ['http://apexsupermarket.localhost:4000'] },
                    },
                  },
                },
              },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const body = registerSchema.parse(request.body);
      const result = await authService.register(body);
      return sendData(reply, result, 201);
    }
  );

  // 2. Email Verification Token Consumption
  app.post(
    '/verify-email',
    {
      config: {
        rateLimit: AUTH_RATE_LIMITS.verifyEmail,
      },
      schema: {
        tags: ['Auth'],
        summary: 'Verify user email and activate tenant organization',
        description:
          'Validates SHA-256 hashed verification token, marks email verified, activates organization, dispatches welcome email, and sets refresh token cookie.',
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', examples: ['success'] },
              data: {
                type: 'object',
                properties: {
                  accessToken: { type: 'string' },
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      fullName: { type: 'string' },
                    },
                  },
                  organization: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      subdomain: { type: 'string' },
                      status: { type: 'string' },
                      url: { type: 'string' },
                    },
                  },
                },
              },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const body = verifyEmailSchema.parse(request.body);
      const result = await authService.verifyEmail(body.token, request.ip);

      reply.setCookie('refreshToken', result.refreshToken, getAuthCookieOptions({
        maxAge: env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
      }));

      return sendData(
        reply,
        {
          accessToken: result.accessToken,
          user: result.user,
          organization: result.organization,
        },
        200
      );
    }
  );

  // 3. Resend Verification Email (Anti-enumeration enabled)
  app.post(
    '/verify-email/resend',
    {
      config: {
        rateLimit: AUTH_RATE_LIMITS.resendVerification,
      },
      schema: {
        tags: ['Auth'],
        summary: 'Resend verification email to registered user',
        description:
          'Generates a new verification token and dispatches email. Returns generic success to prevent email existence enumeration.',
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', examples: ['success'] },
              data: {
                type: 'object',
                properties: {
                  sent: { type: 'boolean', examples: [true] },
                  message: { type: 'string', examples: ['Verification email sent if account exists'] },
                },
              },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const body = resendVerificationSchema.parse(request.body);
      const result = await authService.resendVerification(body.email);

      return sendData(
        reply,
        {
          sent: result.success,
          message: 'If an unverified account with this email exists, a verification link has been sent.',
        },
        200
      );
    }
  );

  // 4. User Login
  app.post(
    '/login',
    {
      config: {
        rateLimit: AUTH_RATE_LIMITS.login,
      },
      schema: {
        tags: ['Auth'],
        summary: 'Authenticate user with email and password',
        description:
          'Validates credentials, issues JWT access token in response body, and sets httpOnly refresh token cookie.',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', examples: ['alex@company.com'] },
            password: { type: 'string', examples: ['Password123!'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', examples: ['success'] },
              data: {
                type: 'object',
                properties: {
                  accessToken: { type: 'string' },
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      fullName: { type: 'string' },
                    },
                  },
                  organization: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      subdomain: { type: 'string' },
                      status: { type: 'string' },
                      url: { type: 'string' },
                    },
                  },
                },
              },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const body = loginSchema.parse(request.body);
      const userAgent = typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : undefined;
      const result = await authService.login(body.email, body.password, request.ip, body.subdomain, userAgent);

      reply.setCookie('refreshToken', result.refreshToken, getAuthCookieOptions({
        maxAge: env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
      }));

      return sendData(
        reply,
        {
          accessToken: result.accessToken,
          user: result.user,
          organization: result.organization,
        },
        200
      );
    }
  );

  // 4.1 Request Magic Login / Password Setup Link
  app.post(
    '/magic-login',
    {
      config: {
        rateLimit: AUTH_RATE_LIMITS.resendVerification,
      },
      schema: {
        tags: ['Auth'],
        summary: 'Request magic sign-in and setup link via email',
        description: 'Sends a one-click magic setup / login link to the user email for their workspace.',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const body = magicLoginSchema.parse(request.body);
      const result = await authService.requestMagicLogin(body.email, body.subdomain, request.ip);
      return sendData(reply, result, 200);
    }
  );

  // 5. Refresh Token Rotation
  app.post(
    '/refresh',
    {
      config: {
        rateLimit: AUTH_RATE_LIMITS.refresh,
      },
      schema: {
        tags: ['Auth'],
        summary: 'Rotate refresh token and issue new access token',
        description:
          'Validates SHA-256 hashed refresh token, detects reuse theft, issues new token family member and access token.',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', examples: ['success'] },
              data: {
                type: 'object',
                properties: {
                  accessToken: { type: 'string' },
                  user: { type: 'object' },
                  organization: { type: 'object' },
                },
              },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const cookieToken = request.cookies?.refreshToken;
      const body = refreshSchema.safeParse(request.body || {}).data;
      const token = cookieToken || body?.refreshToken;

      if (!token) {
        throw new AppError('MISSING_REFRESH_TOKEN', 'No refresh token provided in session cookie or request body', 401);
      }

      const result = await authService.refresh(token);

      reply.setCookie('refreshToken', result.refreshToken, getAuthCookieOptions({
        maxAge: env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
      }));

      return sendData(
        reply,
        {
          accessToken: result.accessToken,
          user: result.user,
          organization: result.organization,
        },
        200
      );
    }
  );

  // 6. User Logout
  app.post(
    '/logout',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Revoke refresh token and clear session cookie',
        description: 'Revokes active refresh token and session from database, invalidating the session immediately.',
        body: {
          type: 'object',
          nullable: true,
          properties: {
            refreshToken: { type: 'string' },
            allSessions: { type: 'boolean' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const cookieToken = request.cookies?.refreshToken;
      const body = logoutSchema.safeParse(request.body || {}).data;
      const token = body?.refreshToken || cookieToken;

      let sessionId: string | undefined;
      let userId: string | undefined;
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const rawBearer = authHeader.slice(7).trim();
        const claims = await verifyAccessToken(rawBearer);
        if (claims) {
          sessionId = claims.session_id;
          userId = claims.sub;
        }
      }

      const queryAll = (request.query as { all?: string })?.all === 'true';
      const allSessions = body?.allSessions || queryAll;

      const result = await authService.logout(token, {
        sessionId,
        userId,
        allSessions,
      });

      reply.clearCookie('refreshToken', getAuthCookieOptions());
      reply.clearCookie('refreshToken', getAuthCookieOptions({ path: '/api/v1/auth' }));

      return sendData(reply, result, 200);
    }
  );

  // 7. Check Email Availability
  const checkEmailHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const authService = getAuthService(request);
    const queryEmail = (request.query as { email?: string })?.email;
    const bodyEmail = (request.body as { email?: string })?.email;
    const emailToValidate = queryEmail || bodyEmail || '';

    const validated = checkEmailSchema.parse({ email: emailToValidate });
    const result = await authService.checkEmailAvailability(validated.email);
    return sendData(reply, result, 200);
  };

  app.get(
    '/check-email',
    {
      config: { rateLimit: AUTH_RATE_LIMITS.checkEmail },
      schema: {
        tags: ['Auth'],
        summary: 'Check if an email address is available for registration',
        querystring: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
    checkEmailHandler
  );

  app.post(
    '/check-email',
    {
      config: { rateLimit: AUTH_RATE_LIMITS.checkEmail },
      schema: {
        tags: ['Auth'],
        summary: 'Check if an email address is available for registration',
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
    checkEmailHandler
  );

  // 8. Forgot Password
  app.post(
    '/forgot-password',
    {
      config: { rateLimit: AUTH_RATE_LIMITS.forgotPassword },
      schema: {
        tags: ['Auth'],
        summary: 'Request password reset email',
        description: 'Issues a 2-hour password reset verification token. Anti-enumeration enabled.',
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const body = forgotPasswordSchema.parse(request.body);
      const result = await authService.forgotPassword(body.email);
      return sendData(reply, result, 200);
    }
  );

  // 9. Reset Password
  app.post(
    '/reset-password',
    {
      config: { rateLimit: AUTH_RATE_LIMITS.resetPassword },
      schema: {
        tags: ['Auth'],
        summary: 'Reset password using token',
        description: 'Validates token, enforces password policy, updates password hash, and revokes all active sessions.',
        body: {
          type: 'object',
          required: ['token', 'password'],
          properties: {
            token: { type: 'string', minLength: 1 },
            password: { type: 'string', minLength: 8 },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const body = resetPasswordSchema.parse(request.body);
      const result = await authService.resetPassword(body.token, body.password);
      return sendData(reply, result, 200);
    }
  );

  // 10. Authenticated User Profile & Active Organization (/auth/me)
  app.get(
    '/me',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Auth'],
        summary: 'Get current authenticated user profile and active organization',
        description: 'Requires valid Bearer Authorization token.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const userId = request.auth?.claims.sub;
      if (!userId) {
        throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
      }
      const result = await authService.getCurrentUser(userId);
      return sendData(reply, result, 200);
    }
  );

  // 11. Active Sessions Management
  app.get(
    '/sessions',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Auth'],
        summary: 'List active login sessions / devices',
        description: 'Returns all active device sessions for the authenticated user.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const userId = request.auth!.user.id;
      const currentSessionId = request.auth!.claims.session_id;

      const sessions = await authService.listSessions(userId, currentSessionId);
      return sendData(reply, { sessions }, 200);
    }
  );

  app.delete(
    '/sessions/:sessionId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Auth'],
        summary: 'Revoke a specific active session / device',
        description: 'Revokes the specified session ID, invalidating all associated refresh and access tokens.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['sessionId'],
          properties: {
            sessionId: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const userId = request.auth!.user.id;
      const { sessionId } = revokeSessionParamsSchema.parse(request.params);

      const result = await authService.revokeSession(userId, sessionId);

      if (sessionId === request.auth?.claims.session_id) {
        reply.clearCookie('refreshToken', getAuthCookieOptions());
        reply.clearCookie('refreshToken', getAuthCookieOptions({ path: '/api/v1/auth' }));
      }

      return sendData(reply, result, 200);
    }
  );

  app.delete(
    '/sessions',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Auth'],
        summary: 'Revoke active sessions (all or all other sessions)',
        description: 'Revokes active sessions. Pass ?keepCurrent=true to keep the current session and revoke all other devices.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            keepCurrent: { type: 'boolean' },
            all: { type: 'boolean' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const userId = request.auth!.user.id;
      const query = revokeAllSessionsQuerySchema.parse(request.query || request.body || {});

      const keepSessionId = query.keepCurrent ? request.auth?.claims.session_id : undefined;
      const result = await authService.revokeAllSessions(userId, { keepSessionId });

      if (!keepSessionId) {
        reply.clearCookie('refreshToken', getAuthCookieOptions());
        reply.clearCookie('refreshToken', getAuthCookieOptions({ path: '/api/v1/auth' }));
      }

      return sendData(reply, result, 200);
    }
  );

  // 12. JWKS Endpoint (JSON Web Key Set)
  app.get(
    '/.well-known/jwks.json',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Get JSON Web Key Set (JWKS) public keys metadata',
        description: 'Returns the active cryptographic keys and key IDs used for JWT signing and verification.',
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const jwks = getPublicJwks();
      return reply.code(200).header('Cache-Control', 'public, max-age=3600').send(jwks);
    }
  );

  // 13. Update Profile (C1)
  app.patch(
    '/profile',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Auth'],
        summary: 'Update authenticated user profile (full name, phone)',
        description: 'Updates profile fields and creates an audit log entry.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const userId = request.auth!.user.id;
      const body = updateProfileSchema.parse(request.body);
      const userAgent = request.headers['user-agent'];

      const result = await authService.updateProfile(userId, body, request.ip, userAgent);
      return sendData(reply, result, 200);
    }
  );

  // 14. Email Change Flow (C2)
  app.post(
    '/change-email',
    {
      preHandler: [requireAuth],
      config: {
        rateLimit: AUTH_RATE_LIMITS.register,
      },
      schema: {
        tags: ['Auth'],
        summary: 'Request email address change with password verification',
        description: 'Verifies current password, creates an email change token, and sends confirmation link to the new address.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const userId = request.auth!.user.id;
      const body = changeEmailRequestSchema.parse(request.body);
      const userAgent = request.headers['user-agent'];

      const result = await authService.requestEmailChange(userId, body, request.ip, userAgent);
      return sendData(reply, result, 200);
    }
  );

  app.post(
    '/change-email/confirm',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Confirm email address change via verification token',
        description: 'Applies new email address to the user account upon verifying the token.',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const body = changeEmailConfirmSchema.parse(request.body);
      const userAgent = request.headers['user-agent'];

      const result = await authService.confirmEmailChange(body.token, request.ip, userAgent);
      return sendData(reply, result, 200);
    }
  );

  // 15. Phone Verification (OTP) (C2)
  app.post(
    '/phone/verify/request',
    {
      preHandler: [requireAuth],
      config: {
        rateLimit: AUTH_RATE_LIMITS.register,
      },
      schema: {
        tags: ['Auth'],
        summary: 'Request 6-digit phone verification OTP code',
        description: 'Generates and sends a 6-digit OTP code to the user phone or registered email.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const userId = request.auth!.user.id;
      const body = requestPhoneOtpSchema.parse(request.body || {});
      const userAgent = request.headers['user-agent'];

      const result = await authService.requestPhoneOtp(userId, body, request.ip, userAgent);
      return sendData(reply, result, 200);
    }
  );

  app.post(
    '/phone/verify/confirm',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Auth'],
        summary: 'Confirm phone number with 6-digit OTP code',
        description: 'Validates OTP code and marks phone number as verified.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const userId = request.auth!.user.id;
      const body = verifyPhoneOtpSchema.parse(request.body);
      const userAgent = request.headers['user-agent'];

      const result = await authService.verifyPhoneOtp(userId, body, request.ip, userAgent);
      return sendData(reply, result, 200);
    }
  );

  // 16. GDPR Data Export (C3)
  app.get(
    '/me/export',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Auth'],
        summary: 'Export personal data (GDPR portability)',
        description: 'Returns all personal data, memberships, and active sessions in JSON format.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const userId = request.auth!.user.id;
      const userAgent = request.headers['user-agent'];

      const result = await authService.exportUserData(userId, request.ip, userAgent);
      return sendData(reply, result, 200);
    }
  );

  // 17. Account Deletion (GDPR Right to Erasure) (C3)
  app.delete(
    '/account',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Auth'],
        summary: 'Soft-delete user account (GDPR Right to Erasure)',
        description: 'Verifies password, marks account as deleted, revokes all sessions, and clears auth cookies.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const userId = request.auth!.user.id;
      const body = deleteAccountSchema.parse(request.body);
      const userAgent = request.headers['user-agent'];

      const result = await authService.deleteAccount(userId, body, request.ip, userAgent);

      reply.clearCookie('refreshToken', getAuthCookieOptions());
      reply.clearCookie('refreshToken', getAuthCookieOptions({ path: '/api/v1/auth' }));

      return sendData(reply, result, 200);
    }
  );

  // 18. Audit Logs (C4)
  app.get(
    '/audit-logs',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Auth'],
        summary: 'List user security audit logs',
        description: 'Returns paginated security events for the authenticated user.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const userId = request.auth!.user.id;
      const query = auditLogQuerySchema.parse(request.query || {});

      const result = await authService.listAuditLogs(userId, query);
      return sendData(reply, result, 200);
    }
  );
}
