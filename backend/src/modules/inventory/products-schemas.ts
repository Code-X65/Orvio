import { z } from 'zod';

export const measurementUnitEnum = z.enum([
  'pcs',
  'kg',
  'g',
  'liter',
  'ml',
  'box',
  'pack',
  'bottle',
  'dozen',
]);

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(200, 'Cannot exceed 200 characters'),
  description: z.string().max(1000, 'Description cannot exceed 1000 characters').nullable().optional().or(z.literal('')),
  sku: z.string().trim().max(50, 'SKU cannot exceed 50 characters').optional().or(z.literal('')),
  barcode: z.string().trim().max(50, 'Barcode cannot exceed 50 characters').nullable().optional().or(z.literal('')),
  categoryId: z.string().trim().nullable().optional(),
  costPrice: z.number().min(0, 'Cost price must be >= 0'),
  sellingPrice: z.number().min(0, 'Selling price must be >= 0'),
  unitOfMeasure: measurementUnitEnum.default('pcs'),
  trackQuantity: z.boolean().default(true),
  lowStockThreshold: z.number().int().min(0).default(0),
  hasVariants: z.boolean().default(false),
  isActive: z.boolean().default(true),
  imageUrl: z.string().url('Must be a valid URL').nullable().optional().or(z.literal('')),
  initialStock: z.number().min(0).optional().default(0),
  branchId: z.string().trim().optional(),
  metadata: z.record(z.any()).optional().nullable(),
});

export const updateProductSchema = createProductSchema.partial();

export const createVariantSchema = z.object({
  sku: z.string().trim().max(50, 'Variant SKU cannot exceed 50 characters').optional().or(z.literal('')),
  barcode: z.string().trim().max(50, 'Barcode cannot exceed 50 characters').nullable().optional().or(z.literal('')),
  costPrice: z.number().min(0, 'Cost price must be >= 0'),
  sellingPrice: z.number().min(0, 'Selling price must be >= 0'),
  attributes: z.record(z.string()).refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one variant attribute (e.g. size, color) is required',
  }),
  isActive: z.boolean().default(true),
  initialStock: z.number().min(0).optional().default(0),
  branchId: z.string().trim().optional(),
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().optional(),
  activeOnly: z
    .string()
    .optional()
    .transform((val) => val === undefined || val === 'true'),
  search: z.string().optional(),
  lowStock: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  trackQuantity: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  sortBy: z.enum(['name', 'sku', 'cost_price', 'selling_price', 'created_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  branchId: z.string().optional(),
});

export const searchProductsQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query required'),
  branchId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type ListProductsQueryInput = z.infer<typeof listProductsQuerySchema>;
export type SearchProductsQueryInput = z.infer<typeof searchProductsQuerySchema>;
