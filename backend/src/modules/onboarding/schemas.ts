import { z } from 'zod';
import { ORGANIZATION_FLOW_STEPS, NIGERIAN_STATES_LGAS } from './constants.js';

export const nigerianAddressSchema = z.object({
  country: z.literal('NG').default('NG'),
  state: z.string().refine((val) => Object.keys(NIGERIAN_STATES_LGAS).includes(val), {
    message: 'Please select a valid Nigerian state',
  }),
  lga: z.string().min(1, 'LGA is required'),
  area: z.string().min(2, 'Area or Landmark is required'),
  streetAddress: z.string().optional(),
  postalCode: z.string().optional(),
});

export const organizationBasicsSchema = z.object({
  organizationName: z.string().min(2, 'Organization Name is required (min 2 characters)').max(80),
  businessType: z.string().min(2, 'Business type is required'),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url('Invalid logo URL').optional().or(z.literal('')),
});

export const businessDetailsSchema = z.object({
  country: z.string().default('NG'),
  currency: z.string().default('NGN'),
  timezone: z.string().default('Africa/Lagos'),
  phone: z.string().optional().or(z.literal('')),
  businessEmail: z.string().email('Invalid email format').optional().or(z.literal('')),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
});

export const applicationSelectionSchema = z.object({
  selectedProductKeys: z.array(z.enum(['inventory', 'gym'])).min(1, 'Select at least one application'),
  primaryProductKey: z.enum(['inventory', 'gym']),
}).refine((data) => data.selectedProductKeys.includes(data.primaryProductKey), {
  message: 'Primary application must be one of the selected applications',
  path: ['primaryProductKey'],
});

export const primaryBranchSchema = z.object({
  name: z.string().min(2, 'Branch name is required'),
  productKey: z.enum(['inventory', 'gym']).optional(),
  type: z.enum(['store', 'warehouse', 'studio', 'headquarters']).default('store'),
  address: nigerianAddressSchema,
  phone: z.string().optional(),
  email: z.string().email('Invalid branch email').optional().or(z.literal('')),
});

export const teamInviteItemSchema = z.object({
  email: z.string().email('Invalid invite email address').toLowerCase().trim(),
  role: z.enum(['admin', 'member']),
  productRoles: z.record(z.string()).optional(),
  branchIds: z.array(z.string()).optional(),
});

export const teamInvitesSchema = z.object({
  invites: z.array(teamInviteItemSchema).max(20, 'Maximum 20 invites allowed in batch'),
  skipped: z.boolean().optional().default(false),
});

export const stepKeyParamSchema = z.object({
  step: z.enum(ORGANIZATION_FLOW_STEPS),
});
