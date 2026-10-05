import { z } from 'zod';

export const AccountStepSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name'),
  email: z.string().email('Please enter a valid business email'),
  phone: z.string().optional(),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Must include at least one uppercase letter')
    .regex(/[a-z]/, 'Must include at least one lowercase letter')
    .regex(/[0-9]/, 'Must include at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must include at least one special character'),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms of Service and Privacy Policy' }),
  }),
  marketingOptIn: z.boolean().optional(),
});

export const OrganizationStepSchema = z.object({
  organizationName: z.string().min(2, 'Please enter your business or company name'),
  subdomain: z
    .string()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(30, 'Subdomain must be at most 30 characters')
    .regex(/^[a-z0-9]+$/, 'Subdomain can only contain lowercase letters and numbers'),
  planCode: z.enum(['inventory', 'gym', 'bundle']),
  timezone: z.string().min(1, 'Please select a timezone'),
  currency: z.string().length(3, 'Please select a currency'),
});

export const SignupFormSchema = AccountStepSchema.merge(OrganizationStepSchema);

export type AccountStepFormData = z.infer<typeof AccountStepSchema>;
export type OrganizationStepFormData = z.infer<typeof OrganizationStepSchema>;
export type SignupFormData = z.infer<typeof SignupFormSchema>;
