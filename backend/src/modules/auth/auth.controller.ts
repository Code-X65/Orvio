import type { FastifyRequest, FastifyReply } from 'fastify';
import { authService, type AuthService } from './service.js';
import {
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginSchema,
  refreshSchema,
} from './schemas.js';
import { sendData } from '../../lib/envelope.js';
import { AppError } from '../../lib/errors.js';

export {
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginSchema,
  refreshSchema,
};

export class AuthController {
  constructor(private service: AuthService = authService) {}

  async register(request: FastifyRequest, reply: FastifyReply) {
    const body = registerSchema.parse(request.body);
    const result = await this.service.register(body);
    return sendData(reply, result, 201);
  }

  async verifyEmail(request: FastifyRequest, reply: FastifyReply) {
    const body = verifyEmailSchema.parse(request.body);
    const result = await this.service.verifyEmail(body.token);

    reply.setCookie('refreshToken', result.refreshToken, {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    });

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

  async resendVerification(request: FastifyRequest, reply: FastifyReply) {
    const body = resendVerificationSchema.parse(request.body);
    const result = await this.service.resendVerification(body.email);
    return sendData(reply, result, 200);
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const body = loginSchema.parse(request.body);
    const result = await this.service.login(body.email, body.password);

    reply.setCookie('refreshToken', result.refreshToken, {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    });

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

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const body = refreshSchema.parse(request.body || {});
    const cookieToken = request.cookies?.refreshToken;
    const token = body.refreshToken || cookieToken;

    if (!token) {
      throw new AppError('MISSING_REFRESH_TOKEN', 'No refresh token provided', 401);
    }

    const result = await this.service.refresh(token);

    reply.setCookie('refreshToken', result.refreshToken, {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    });

    return sendData(
      reply,
      {
        accessToken: result.accessToken,
      },
      200
    );
  }
}

export const authController = new AuthController();
