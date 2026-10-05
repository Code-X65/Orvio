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

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'dispostable.com',
  'fakeinbox.com',
  'getairmail.com',
  'burnermail.io',
]);

export function isDisposableEmail(email: string): boolean {
  if (!env.DISPOSABLE_EMAIL_BLOCKLIST_ENABLED) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1].toLowerCase().trim();
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
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
    timezone: z
      .string()
      .default('Africa/Lagos')
      .refine((tz) => isValidTimezone(tz), {
        message: 'Invalid IANA timezone identifier',
      }),
    currency: z.enum(SUPPORTED_CURRENCIES).default('NGN'),
    termsAccepted: z.literal(true).optional(),
    marketingOptIn: z.boolean().optional(),
  })
  .strict()
  .transform((data) => {
    const code = data.planCode || data.plan || 'bundle';
    return {
      ...data,
      plan: code,
      planCode: code,
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
  })
  .strict();

export type LogoutInput = z.infer<typeof logoutSchema>;

