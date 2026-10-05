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
  checkEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './schemas.js';
import { startTrialSchema, setupPasswordAndVerifySchema } from './trial.schema.js';
import { AUTH_RATE_LIMITS } from './rate-limiter.js';
import { sendData } from '../../lib/envelope.js';
import { AppError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
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
      const bodyToken = (request.body as { refreshToken?: string })?.refreshToken;
      const headerToken = request.headers['x-refresh-token'] as string | undefined;
      const token = cookieToken || bodyToken || headerToken;

      if (!token) {
        throw new AppError('MISSING_REFRESH_TOKEN', 'No refresh token provided', 401);
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
        description: 'Revokes active refresh token from database and clears the refreshToken httpOnly cookie.',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authService = getAuthService(request);
      const cookieToken = request.cookies?.refreshToken;
      const token = cookieToken;

      const result = await authService.logout(token);

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
}
