import { z } from 'zod';

export const businessTypeEnum = z.enum([
  'retail_supermarket',
  'wholesale_distribution',
  'fashion_boutique',
  'electronics_tech',
  'pharmacy_cosmetics',
  'food_grocery',
  'manufacturing_other',
  'services_other',
]);

export const branchAddressSchema = z.object({
  country: z.string().default('Nigeria'),
  state: z.string().min(1, 'State is required'),
  city: z.string().min(1, 'City / LGA is required'),
  lga: z.string().optional(),
  area: z.string().optional(),
  streetAddress: z.string().min(3, 'Street address must be at least 3 characters'),
  postalCode: z.string().optional(),
});

export const inventoryBranchSetupSchema = z.object({
  businessType: z.string().min(1, 'Business type is required'),
  businessDescription: z.string().max(255).optional(),
  branchName: z
    .string()
    .min(2, 'Branch name must be at least 2 characters')
    .max(100, 'Branch name cannot exceed 100 characters')
    .trim(),
  branchCode: z
    .string()
    .min(1, 'Branch abbreviation/code is required')
    .max(10, 'Branch code cannot exceed 10 characters')
    .toUpperCase()
    .trim()
    .default('HQ'),
  useOrgEmail: z.boolean().default(true),
  branchEmail: z.string().email('Invalid branch email address').optional().or(z.literal('')),
  useOrgPhone: z.boolean().default(true),
  branchPhone: z.string().min(7, 'Branch phone must be at least 7 digits').max(20).optional().or(z.literal('')),
  address: branchAddressSchema,
  currency: z.string().default('NGN'),
});

export const saveOnboardingDraftSchema = z.object({
  currentStep: z.number().int().min(1).max(3),
  stepData: z.record(z.any()),
});

export type InventoryBranchSetupInput = z.infer<typeof inventoryBranchSetupSchema>;
export type BranchAddressInput = z.infer<typeof branchAddressSchema>;
export type SaveOnboardingDraftInput = z.infer<typeof saveOnboardingDraftSchema>;

export { DEFAULT_CATEGORIES_BY_BUSINESS_TYPE, GENERIC_DEFAULT_CATEGORIES } from './categories-schemas.js';
