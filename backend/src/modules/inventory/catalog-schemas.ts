import { z } from 'zod';

export const assignProductSchema = z.object({
  productId: z.string().trim().min(1, 'Product ID is required'),
  notes: z.string().max(500).optional(),
});

export const removeProductSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const importCatalogSchema = z.object({
  sourceBranchId: z.string().trim().min(1, 'Source branch ID is required'),
  productIds: z.array(z.string().trim().min(1)).optional().default([]),
  importAll: z.boolean().optional().default(false),
  copyStock: z.boolean().optional().default(false),
  overwriteExisting: z.boolean().optional().default(false),
  importTaxonomy: z.boolean().optional().default(true),
  notes: z.string().max(1000).optional(),
});

export const importPreviewSchema = z.object({
  sourceBranchId: z.string().trim().min(1, 'Source branch ID is required'),
  productIds: z.array(z.string().trim().min(1)).optional().default([]),
  importAll: z.boolean().optional().default(false),
});

export const listBranchProductsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 50)),
  search: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  brandId: z.string().trim().optional(),
  includeExcluded: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  cursor: z.string().trim().optional(),
  direction: z.enum(['next', 'prev']).optional().default('next'),
});

export type AssignProductInput = z.infer<typeof assignProductSchema>;
export type RemoveProductInput = z.infer<typeof removeProductSchema>;
export type ImportCatalogInput = z.infer<typeof importCatalogSchema>;
export type ImportPreviewInput = z.infer<typeof importPreviewSchema>;
export type ListBranchProductsQueryInput = z.infer<typeof listBranchProductsQuerySchema>;
