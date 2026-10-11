import { z } from 'zod';

export const BRANCH_TYPES = ['store', 'warehouse', 'studio', 'headquarters'] as const;
export const BRANCH_STATUSES = ['active', 'inactive'] as const;

export const branchAddressSchema = z.object({
  street: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
}).passthrough().optional().nullable();

export const createBranchSchema = z.object({
  name: z.string().trim().min(1, 'Branch name is required').max(100, 'Cannot exceed 100 characters'),
  code: z.string().trim().max(50, 'Branch code cannot exceed 50 characters').optional().nullable(),
  type: z.enum(BRANCH_TYPES).default('store'),
  status: z.enum(BRANCH_STATUSES).default('active'),
  isPrimary: z.boolean().optional().default(false),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().email('Invalid email address').max(255).optional().nullable().or(z.literal('')),
  address: branchAddressSchema,
});

export const updateBranchSchema = z.object({
  name: z.string().trim().min(1, 'Branch name is required').max(100, 'Cannot exceed 100 characters').optional(),
  code: z.string().trim().max(50, 'Branch code cannot exceed 50 characters').optional().nullable(),
  type: z.enum(BRANCH_TYPES).optional(),
  status: z.enum(BRANCH_STATUSES).optional(),
  isPrimary: z.boolean().optional(),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().email('Invalid email address').max(255).optional().nullable().or(z.literal('')),
  address: branchAddressSchema,
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided to update branch' }
);

export const listBranchesQuerySchema = z.object({
  activeOnly: z
    .string()
    .optional()
    .transform((val) => val === undefined || val === 'true'),
  status: z.enum(['active', 'inactive', 'all']).optional(),
  includeDeleted: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export const deleteBranchQuerySchema = z.object({
  confirmWithStock: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .or(z.boolean().optional()),
  reason: z.string().trim().max(500).optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type ListBranchesQueryInput = z.infer<typeof listBranchesQuerySchema>;
export type DeleteBranchQueryInput = z.infer<typeof deleteBranchQuerySchema>;
