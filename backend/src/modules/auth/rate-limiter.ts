import type { FastifyRequest } from 'fastify';

/**
 * Extracts authenticated user ID from request context or Authorization Bearer token,
 * falling back to client IP for unauthenticated requests.
 */
export function getUserOrIpKey(request: FastifyRequest): string {
  if ((request as any).auth?.user?.id) {
    return `user:${(request as any).auth.user.id}`;
  }

  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (payload?.sub) {
          return `user:${payload.sub}`;
        }
      } catch {
        // Fallback to IP if token payload parsing fails
      }
    }
  }

  return request.ip;
}

export const AUTH_RATE_LIMITS = {
  // Max 5 account registrations per hour per IP (abuse prevention)
  register: {
    max: 5,
    timeWindow: '1 hour',
  },
  // Max 15 token verifications per 15 minutes per IP
  verifyEmail: {
    max: 15,
    timeWindow: '15 minutes',
  },
  // Max 5 resend verification requests per 15 minutes per IP
  resendVerification: {
    max: 5,
    timeWindow: '15 minutes',
  },
  // Max 10 login attempts per 15 minutes per IP
  login: {
    max: 10,
    timeWindow: '15 minutes',
  },
  // Max 30 token refreshes per 15 minutes per IP
  refresh: {
    max: 30,
    timeWindow: '15 minutes',
  },
  // Max 60 live subdomain availability checks per minute
  checkSubdomain: {
    max: 60,
    timeWindow: '1 minute',
  },
  // Max 30 email availability checks per minute per IP
  checkEmail: {
    max: 30,
    timeWindow: '1 minute',
  },
  // Max 5 forgot password requests per 15 minutes per IP
  forgotPassword: {
    max: 5,
    timeWindow: '15 minutes',
  },
  // Max 10 password reset attempts per 15 minutes per IP
  resetPassword: {
    max: 10,
    timeWindow: '15 minutes',
  },
  // Max 5 phone OTP verification attempts per 15 minutes per authenticated user
  verifyPhoneOtp: {
    max: 5,
    timeWindow: '15 minutes',
    keyGenerator: getUserOrIpKey,
  },
  // Max 5 phone OTP requests per 15 minutes per authenticated user
  requestPhoneOtp: {
    max: 5,
    timeWindow: '15 minutes',
    keyGenerator: getUserOrIpKey,
  },
} as const;
