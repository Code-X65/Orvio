import { z } from 'zod';
import { env } from '../../config/env.js';

export const SUPPORTED_CURRENCIES = [
  'NGN',
  'USD',
  'GBP',
  'EUR',
  'GHS',
  'KES',
  'ZAR',
  'CAD',
  'AUD',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

import { isDisposableDomain, DISPOSABLE_EMAIL_DOMAINS } from './disposable-domains.js';

export { DISPOSABLE_EMAIL_DOMAINS };

export function isDisposableEmail(email: string): boolean {
  if (!env.DISPOSABLE_EMAIL_BLOCKLIST_ENABLED) return false;
  return isDisposableDomain(email);
}

export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Please enter a valid email address')
      .refine((email) => !isDisposableEmail(email), {
        message: 'Disposable or temporary email addresses are not permitted',
      }),
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
    phone: z.string().trim().min(10, 'Phone number must be at least 10 characters').optional(),
    organizationName: z
      .string()
      .trim()
      .min(2, 'Organization name must be at least 2 characters')
      .max(100),
    subdomain: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, 'Subdomain must be at least 3 characters')
      .max(30, 'Subdomain must be at most 30 characters')
      .regex(/^[a-z0-9]+$/, 'Subdomain must contain only lowercase letters and digits'),
    plan: z.enum(['inventory', 'gym', 'bundle']).optional(),
    planCode: z.enum(['inventory', 'gym', 'bundle']).optional().default('bundle'),
    selectedApps: z.array(z.string()).optional(),
    primaryApp: z.string().optional(),
    timezone: z
      .string()
      .default('Africa/Lagos')
      .refine((tz) => isValidTimezone(tz), {
        message: 'Invalid IANA timezone identifier',
      }),
    currency: z.enum(SUPPORTED_CURRENCIES).default('NGN'),
    termsAccepted: z.boolean().default(true),
    marketingOptIn: z.boolean().optional(),
  })
  .strict()
  .transform((data) => {
    const code = data.planCode || data.plan || 'bundle';
    const apps = data.selectedApps && data.selectedApps.length > 0
      ? data.selectedApps
      : [code === 'gym' ? 'gym' : 'inventory'];
    return {
      ...data,
      plan: code,
      planCode: code,
      selectedApps: apps,
      primaryApp: data.primaryApp || apps[0] || 'inventory',
    };
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const verifyEmailSchema = z
  .object({
    token: z.string().trim().min(1, 'Verification token is required'),
  })
  .strict();

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  })
  .strict();

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
    subdomain: z.string().trim().toLowerCase().optional(),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

export const magicLoginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
    subdomain: z.string().trim().toLowerCase().optional(),
  })
  .strict();

export type MagicLoginInput = z.infer<typeof magicLoginSchema>;

export const refreshSchema = z
  .object({
    refreshToken: z.string().trim().optional(),
  })
  .strict();

export type RefreshInput = z.infer<typeof refreshSchema>;

export const checkEmailSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  })
  .strict();

export type CheckEmailInput = z.infer<typeof checkEmailSchema>;

export const forgotPasswordSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  })
  .strict();

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, 'Password reset token is required'),
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  })
  .strict();

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const logoutSchema = z
  .object({
    refreshToken: z.string().trim().optional(),
    allSessions: z.boolean().optional(),
  })
  .strict();

export type LogoutInput = z.infer<typeof logoutSchema>;

export const revokeSessionParamsSchema = z
  .object({
    sessionId: z.string().trim().min(1, 'Session ID is required'),
  })
  .strict();

export type RevokeSessionParamsInput = z.infer<typeof revokeSessionParamsSchema>;

export const revokeAllSessionsQuerySchema = z
  .object({
    keepCurrent: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((val) => (typeof val === 'string' ? val === 'true' : val))
      .optional(),
    all: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((val) => (typeof val === 'string' ? val === 'true' : val))
      .optional(),
  })
  .strict();

export type RevokeAllSessionsQueryInput = z.infer<typeof revokeAllSessionsQuerySchema>;

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100).optional(),
    phone: z.string().trim().min(10, 'Phone number must be at least 10 characters').optional().nullable(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changeEmailRequestSchema = z
  .object({
    newEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email('Please enter a valid email address')
      .refine((email) => !isDisposableEmail(email), {
        message: 'Disposable or temporary email addresses are not permitted',
      }),
    password: z.string().min(1, 'Current password is required to verify your identity'),
  })
  .strict();

export type ChangeEmailRequestInput = z.infer<typeof changeEmailRequestSchema>;

export const changeEmailConfirmSchema = z
  .object({
    token: z.string().trim().min(1, 'Email change confirmation token is required'),
  })
  .strict();

export type ChangeEmailConfirmInput = z.infer<typeof changeEmailConfirmSchema>;

export const requestPhoneOtpSchema = z
  .object({
    phone: z.string().trim().min(10, 'Valid phone number is required').optional(),
  })
  .strict();

export type RequestPhoneOtpInput = z.infer<typeof requestPhoneOtpSchema>;

export const verifyPhoneOtpSchema = z
  .object({
    otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be a 6-digit numeric code'),
  })
  .strict();

export type VerifyPhoneOtpInput = z.infer<typeof verifyPhoneOtpSchema>;

export const deleteAccountSchema = z
  .object({
    password: z.string().min(1, 'Password is required to confirm account deletion'),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export const auditLogQuerySchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
  })
  .strict();

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;

