import { z } from 'zod';

export const startTrialSchema = z
  .object({
    selectedApps: z.array(z.enum(['inventory', 'gym'])).min(1, 'Please select at least one application'),
    primaryApp: z.enum(['inventory', 'gym']).optional().default('inventory'),
    firstName: z.string().min(2, 'First Name must be at least 2 characters').optional(),
    lastName: z.string().min(2, 'Last Name must be at least 2 characters').optional(),
    fullName: z.string().min(2, 'Full Name is required (minimum 2 characters)').optional(),
    organizationName: z.string().min(2, 'Organization Name is required (minimum 2 characters)').max(80),
    subdomain: z
      .string()
      .min(3, 'Subdomain must be at least 3 characters')
      .max(30, 'Subdomain cannot exceed 30 characters')
      .optional(),
    email: z.string().email('Valid email address is required').toLowerCase().trim(),
    phone: z.string().min(7, 'Valid phone number is required').max(20, 'Phone number cannot exceed 20 characters').trim(),
    country: z.string().optional().default('Nigeria'),
    language: z.string().optional().default('English'),
    organizationSize: z.string().optional().default('1 - 5 employees'),
    primaryInterest: z.string().optional().default('Use it in my organization'),
    password: z.string().min(12).optional(),
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
