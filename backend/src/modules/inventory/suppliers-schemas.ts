import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Supplier name is required').max(200, 'Cannot exceed 200 characters'),
  phone: z.string().trim().max(50).nullable().optional().or(z.literal('')),
  email: z.string().trim().email('Invalid email address').nullable().optional().or(z.literal('')),
  address: z.string().max(1000, 'Address cannot exceed 1000 characters').nullable().optional().or(z.literal('')),
  contactPerson: z.string().trim().max(150).nullable().optional().or(z.literal('')),
  taxId: z.string().trim().max(100).nullable().optional().or(z.literal('')),
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').nullable().optional().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
});

export const updateSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Supplier name is required').max(200, 'Cannot exceed 200 characters').optional(),
  phone: z.string().trim().max(50).nullable().optional().or(z.literal('')),
  email: z.string().trim().email('Invalid email address').nullable().optional().or(z.literal('')),
  address: z.string().max(1000, 'Address cannot exceed 1000 characters').nullable().optional().or(z.literal('')),
  contactPerson: z.string().trim().max(150).nullable().optional().or(z.literal('')),
  taxId: z.string().trim().max(100).nullable().optional().or(z.literal('')),
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').nullable().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export const listSuppliersQuerySchema = z.object({
  search: z.string().trim().optional(),
  activeOnly: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  sortBy: z.enum(['name', 'created_at', 'receipts_count']).optional().default('name'),
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

export const checkSupplierDuplicatesSchema = z.object({
  name: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  excludeId: z.string().trim().optional(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type ListSuppliersQueryInput = z.infer<typeof listSuppliersQuerySchema>;
export type CheckSupplierDuplicatesInput = z.infer<typeof checkSupplierDuplicatesSchema>;
