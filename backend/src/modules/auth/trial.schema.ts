import { z } from 'zod';
import { isDisposableEmail } from './schemas.js';

export const startTrialSchema = z
  .object({
    selectedApps: z.array(z.string()).min(1, 'Please select at least one application'),
    primaryApp: z.string().optional().default('inventory'),
    firstName: z.string().min(2, 'First Name must be at least 2 characters').optional(),
    lastName: z.string().min(2, 'Last Name must be at least 2 characters').optional(),
    fullName: z.string().min(2, 'Full Name is required (minimum 2 characters)').optional(),
    organizationName: z.string().min(2, 'Organization Name is required (minimum 2 characters)').max(80),
    subdomain: z
      .string()
      .min(3, 'Subdomain must be at least 3 characters')
      .max(30, 'Subdomain cannot exceed 30 characters')
      .optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Valid email address is required')
      .refine((email) => !isDisposableEmail(email), {
        message: 'Disposable or temporary email addresses are not permitted',
      }),
    phone: z.string().min(7, 'Valid phone number is required').max(20, 'Phone number cannot exceed 20 characters').trim().optional(),
    country: z.string().optional().default('Nigeria'),
    language: z.string().optional().default('English'),
    organizationSize: z.string().optional().default('1 - 5 employees'),
    primaryInterest: z.string().optional().default('Use it in my organization'),
    password: z.string().min(12).optional(),
    plan: z.string().optional(),
    planCode: z.string().optional(),
    timezone: z.string().optional().default('Africa/Lagos'),
    currency: z.string().optional().default('NGN'),
    termsAccepted: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the Terms of Service to continue' }),
    }),
    marketingOptIn: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.fullName || (data.firstName && data.lastName)), {
    message: 'First Name and Last Name are required',
    path: ['firstName'],
  });

export type StartTrialInput = z.infer<typeof startTrialSchema>;

export const setupPasswordAndVerifySchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  confirmPassword: z.string().min(12, 'Confirm password is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type SetupPasswordAndVerifyInput = z.infer<typeof setupPasswordAndVerifySchema>;
