import { z } from 'zod';

export interface DefaultCategorySpec {
  name: string;
  description?: string;
}

export const DEFAULT_CATEGORIES_BY_BUSINESS_TYPE: Record<string, DefaultCategorySpec[]> = {
  retail_supermarket: [
    { name: 'Groceries' },
    { name: 'Beverages' },
    { name: 'Household Supplies' },
    { name: 'Personal Care & Beauty' },
    { name: 'Frozen & Refrigerated' },
    { name: 'Snacks & Confectionery' },
    { name: 'Health & Wellness' },
    { name: 'Baby Care' },
  ],
  wholesale_distribution: [
    { name: 'Packaging Materials' },
    { name: 'Industrial Supplies' },
    { name: 'Office Supplies' },
    { name: 'Food Service' },
    { name: 'Hardware & Tools' },
  ],
  fashion_boutique: [
    { name: "Women's Clothing" },
    { name: "Men's Clothing" },
    { name: 'Footwear' },
    { name: 'Accessories' },
    { name: 'Bags & Jewelry' },
  ],
  electronics_tech: [
    { name: 'Smartphones & Tablets' },
    { name: 'Laptops & Computers' },
    { name: 'Audio & Headphones' },
    { name: 'Gaming' },
    { name: 'Cameras & Accessories' },
  ],
  pharmacy_cosmetics: [
    { name: 'Pharmaceuticals' },
    { name: 'Vitamins & Supplements' },
    { name: 'Skincare' },
    { name: 'Haircare' },
    { name: 'Personal Hygiene' },
  ],
  food_grocery: [
    { name: 'Fresh Produce' },
    { name: 'Meat & Seafood' },
    { name: 'Dairy & Eggs' },
    { name: 'Bakery' },
    { name: 'Pantry Staples' },
    { name: 'Beverages' },
  ],
  manufacturing_other: [
    { name: 'Raw Materials' },
    { name: 'Work-in-Progress' },
    { name: 'Finished Goods' },
    { name: 'MRO Supplies' },
  ],
  services_other: [
    { name: 'Service Fees' },
    { name: 'Event Supplies' },
    { name: 'Office Consumables' },
    { name: 'Equipment' },
  ],
};

export const GENERIC_DEFAULT_CATEGORIES: DefaultCategorySpec[] = [
  { name: 'General Products' },
  { name: 'Supplies' },
  { name: 'Equipment' },
  { name: 'Miscellaneous' },
];

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100, 'Cannot exceed 100 characters'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').nullable().optional().or(z.literal('')),
  parentId: z.string().trim().min(1).nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100, 'Cannot exceed 100 characters').optional(),
  description: z.string().max(500, 'Description cannot exceed 500 characters').nullable().optional().or(z.literal('')),
  parentId: z.string().trim().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const reorderCategoriesSchema = z.object({
  parentId: z.string().trim().nullable().optional(),
  categoryIds: z.array(z.string().trim().min(1)).min(1, 'At least one category ID is required'),
});

export const listCategoriesQuerySchema = z.object({
  activeOnly: z
    .string()
    .optional()
    .transform((val) => val === undefined || val === 'true'),
  parentId: z.string().optional(),
  includeInactive: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
export type ListCategoriesQueryInput = z.infer<typeof listCategoriesQuerySchema>;
