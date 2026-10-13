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

export const productMetadataSchema = z.record(z.any()).superRefine((val, ctx) => {
  if (val.requiresPrescription !== undefined && typeof val.requiresPrescription !== 'boolean') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'requiresPrescription must be a boolean',
      path: ['requiresPrescription'],
    });
  }
  if (val.isPerishable !== undefined && typeof val.isPerishable !== 'boolean') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'isPerishable must be a boolean',
      path: ['isPerishable'],
    });
  }
  if (
    val.minimumOrderQuantity !== undefined &&
    val.minimumOrderQuantity !== null &&
    (typeof val.minimumOrderQuantity !== 'number' || val.minimumOrderQuantity < 1)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'minimumOrderQuantity must be a positive integer',
      path: ['minimumOrderQuantity'],
    });
  }
  if (
    val.casePackQuantity !== undefined &&
    val.casePackQuantity !== null &&
    (typeof val.casePackQuantity !== 'number' || val.casePackQuantity < 1)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'casePackQuantity must be a positive integer',
      path: ['casePackQuantity'],
    });
  }
});

export const createProductSchema = z
  .object({
    name: z.string().trim().min(1, 'Product name is required').max(200, 'Cannot exceed 200 characters'),
    description: z.string().max(1000, 'Description cannot exceed 1000 characters').nullable().optional().or(z.literal('')),
    sku: z.string().trim().max(50, 'SKU cannot exceed 50 characters').optional().or(z.literal('')),
    barcode: z.string().trim().max(50, 'Barcode cannot exceed 50 characters').nullable().optional().or(z.literal('')),
    categoryId: z.string().trim().nullable().optional(),
    brandId: z.string().trim().nullable().optional(),
    costPrice: z.number().min(0, 'Cost price must be >= 0'),
    sellingPrice: z.number().min(0, 'Selling price must be >= 0'),
    compareAtPrice: z.number().min(0, 'Compare-at price must be >= 0').nullable().optional(),
    unitOfMeasure: measurementUnitEnum.default('pcs'),
    trackQuantity: z.boolean().default(true),
    lowStockThreshold: z.number().int().min(0).default(0),
    hasVariants: z.boolean().default(false),
    isActive: z.boolean().default(true),
    imageUrl: z.string().url('Must be a valid URL').nullable().optional().or(z.literal('')),
    initialStock: z.number().min(0).optional().default(0),
    branchId: z.string().trim().optional(),
    metadata: productMetadataSchema.optional().nullable(),
  })
  .refine((data) => data.sellingPrice >= data.costPrice, {
    message: 'Selling price must not be less than cost price (no loss sales permitted)',
    path: ['sellingPrice'],
  });

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(1000).nullable().optional(),
    sku: z.string().trim().max(50).optional(),
    barcode: z.string().trim().max(50).nullable().optional(),
    categoryId: z.string().trim().nullable().optional(),
    brandId: z.string().trim().nullable().optional(),
    costPrice: z.number().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    compareAtPrice: z.number().min(0).nullable().optional(),
    unitOfMeasure: measurementUnitEnum.optional(),
    trackQuantity: z.boolean().optional(),
    lowStockThreshold: z.number().int().min(0).optional(),
    hasVariants: z.boolean().optional(),
    isActive: z.boolean().optional(),
    imageUrl: z.string().url().nullable().optional(),
    metadata: productMetadataSchema.optional().nullable(),
    priceChangeReason: z.string().trim().max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.sellingPrice !== undefined && data.costPrice !== undefined) {
        return data.sellingPrice >= data.costPrice;
      }
      return true;
    },
    {
      message: 'Selling price must not be less than cost price (no loss sales permitted)',
      path: ['sellingPrice'],
    }
  );

export const createVariantSchema = z
  .object({
    sku: z.string().trim().max(50, 'Variant SKU cannot exceed 50 characters').optional().or(z.literal('')),
    barcode: z.string().trim().max(50, 'Barcode cannot exceed 50 characters').nullable().optional().or(z.literal('')),
    costPrice: z.number().min(0, 'Cost price must be >= 0'),
    sellingPrice: z.number().min(0, 'Selling price must be >= 0'),
    compareAtPrice: z.number().min(0, 'Compare-at price must be >= 0').nullable().optional(),
    attributes: z.record(z.string()).refine((obj) => Object.keys(obj).length > 0, {
      message: 'At least one variant attribute (e.g. size, color) is required',
    }),
    isActive: z.boolean().default(true),
    initialStock: z.number().min(0).optional().default(0),
    branchId: z.string().trim().optional(),
  })
  .refine((data) => data.sellingPrice >= data.costPrice, {
    message: 'Selling price must not be less than cost price (no loss sales permitted)',
    path: ['sellingPrice'],
  });

export const updateVariantSchema = z
  .object({
    sku: z.string().trim().max(50).optional(),
    barcode: z.string().trim().max(50).nullable().optional(),
    costPrice: z.number().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    compareAtPrice: z.number().min(0).nullable().optional(),
    attributes: z.record(z.string()).optional(),
    isActive: z.boolean().optional(),
    priceChangeReason: z.string().trim().max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.sellingPrice !== undefined && data.costPrice !== undefined) {
        return data.sellingPrice >= data.costPrice;
      }
      return true;
    },
    {
      message: 'Selling price must not be less than cost price (no loss sales permitted)',
      path: ['sellingPrice'],
    }
  );

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().optional(),
  status: z.enum(['all', 'active', 'inactive', 'archived']).optional(),
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
  brandId: z.string().optional(),
  includeExcluded: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export const searchProductsQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query required'),
  branchId: z.string().optional(),
  brandId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const deleteProductQuerySchema = z.object({
  reason: z.string().trim().max(500).optional(),
  confirmWithStock: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => val === true || val === 'true'),
});

export const updateProductImageSchema = z.object({
  altText: z.string().max(200, 'Alt text cannot exceed 200 characters').optional().nullable(),
  isPrimary: z.boolean().optional(),
});

export const reorderProductImagesSchema = z.object({
  images: z.array(
    z.object({
      id: z.string().min(1),
      sortOrder: z.number().int().min(0),
      isPrimary: z.boolean().optional(),
    })
  ).min(1, 'At least one image is required'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type ListProductsQueryInput = z.infer<typeof listProductsQuerySchema>;
export type SearchProductsQueryInput = z.infer<typeof searchProductsQuerySchema>;
export type DeleteProductInput = z.infer<typeof deleteProductQuerySchema>;
export type UpdateProductImageInput = z.infer<typeof updateProductImageSchema>;
export type ReorderProductImagesInput = z.infer<typeof reorderProductImagesSchema>;

