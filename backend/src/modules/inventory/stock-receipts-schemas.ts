import { z } from 'zod';

export const stockReceiptItemInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional().nullable(),
  quantityReceived: z.number().positive('Quantity received must be greater than zero'),
  unitCost: z.number().min(0, 'Unit cost must be zero or positive').optional().nullable(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional().nullable(),
});

export const createStockReceiptSchema = z
  .object({
    branchId: z.string().min(1, 'Branch ID is required'),
    supplierId: z.string().min(1, 'Supplier ID is required'),
    reference: z.string().trim().max(100).optional().nullable().or(z.literal('')),
    receiptDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    supplierInvoiceNumber: z.string().trim().max(100).optional().nullable().or(z.literal('')),
    notes: z.string().max(1000).optional().nullable().or(z.literal('')),
    items: z.array(stockReceiptItemInputSchema).min(1, 'At least one product line is required to receive stock'),
  })
  .refine(
    (data) => {
      if (data.receiptDate) {
        const parsed = new Date(data.receiptDate);
        if (isNaN(parsed.getTime())) return false;
        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        const tomorrow = now + 24 * 60 * 60 * 1000;
        // Allowed within past 30 days and not far future
        return parsed.getTime() >= thirtyDaysAgo && parsed.getTime() <= tomorrow;
      }
      return true;
    },
    {
      message: 'Receipt date cannot be more than 30 days in the past or set in the future',
      path: ['receiptDate'],
    }
  );

export const listStockReceiptsQuerySchema = z.object({
  branchId: z.string().trim().optional(),
  supplierId: z.string().trim().optional(),
  productId: z.string().trim().optional(),
  search: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 50)),
  sortBy: z.enum(['receipt_date', 'reference', 'created_at']).optional().default('receipt_date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type StockReceiptItemInput = z.infer<typeof stockReceiptItemInputSchema>;
export type CreateStockReceiptInput = z.infer<typeof createStockReceiptSchema>;
export type ListStockReceiptsQueryInput = z.infer<typeof listStockReceiptsQuerySchema>;
