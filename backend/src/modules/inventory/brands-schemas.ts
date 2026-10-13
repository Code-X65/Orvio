import { z } from 'zod';

export const createBrandSchema = z.object({
  name: z.string().trim().min(1, 'Brand name is required').max(100, 'Cannot exceed 100 characters'),
  slug: z.string().trim().min(1).max(120).optional(),
  branchId: z.string().trim().min(1).optional(),
  description: z.string().max(1000, 'Description cannot exceed 1000 characters').nullable().optional().or(z.literal('')),
  logoUrl: z.string().url('Invalid logo URL').nullable().optional().or(z.literal('')),
  websiteUrl: z.string().url('Invalid website URL').nullable().optional().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const updateBrandSchema = z.object({
  name: z.string().trim().min(1, 'Brand name is required').max(100, 'Cannot exceed 100 characters').optional(),
  slug: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(1000, 'Description cannot exceed 1000 characters').nullable().optional().or(z.literal('')),
  logoUrl: z.string().url('Invalid logo URL').nullable().optional().or(z.literal('')),
  websiteUrl: z.string().url('Invalid website URL').nullable().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const deleteBrandQuerySchema = z.object({
  reassignToBrandId: z.string().trim().min(1).optional(),
  reason: z.string().max(500).optional(),
});

export const listBrandsQuerySchema = z.object({
  search: z.string().trim().optional(),
  branchId: z.string().trim().optional(),
  activeOnly: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? false : val === 'true')),
  includeDeleted: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  sortBy: z.enum(['name', 'sort_order', 'created_at']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 50)),
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
export type DeleteBrandInput = z.infer<typeof deleteBrandQuerySchema>;
export type ListBrandsQueryInput = z.infer<typeof listBrandsQuerySchema>;
