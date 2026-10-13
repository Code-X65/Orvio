import { z } from 'zod';

export const stockSummaryQuerySchema = z.object({
  branchId: z.string().optional(),
});

export type StockSummaryQuery = z.infer<typeof stockSummaryQuerySchema>;

export const stockListQuerySchema = z.object({
  branchId: z.string().optional(),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  status: z.enum(['all', 'in_stock', 'low_stock', 'out_of_stock']).default('all'),
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  cursor: z.string().optional(),
});

export type StockListQuery = z.infer<typeof stockListQuerySchema>;

export const stockMovementsQuerySchema = z.object({
  branchId: z.string().optional(),
  productId: z.string().optional(),
  movementType: z.enum(['all', 'opening', 'receipt', 'adjustment', 'transfer_out', 'transfer_in', 'sale', 'sale_void']).default('all'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  cursor: z.string().optional(),
});

export type StockMovementsQuery = z.infer<typeof stockMovementsQuerySchema>;

export const recordOpeningStockSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().min(0, 'Quantity must be zero or positive'),
  notes: z.string().max(500).optional(),
});

export type RecordOpeningStockPayload = z.infer<typeof recordOpeningStockSchema>;

export const receiveStockSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().positive('Received quantity must be greater than zero'),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export type ReceiveStockPayload = z.infer<typeof receiveStockSchema>;

export const adjustStockSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  mode: z.enum(['delta', 'counted']),
  value: z.number(), // If delta: signed number (+ or -). If counted: >= 0
  reason: z.enum(['damage', 'loss', 'found', 'correction', 'count_reconciliation', 'other']),
  notes: z.string().max(500).optional(),
}).refine((data) => {
  if (data.mode === 'counted' && data.value < 0) {
    return false;
  }
  if (data.mode === 'delta' && data.value === 0) {
    return false;
  }
  if (data.reason === 'other' && (!data.notes || data.notes.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'Invalid adjustment values: reason "other" requires a note, counted must be >= 0, and delta cannot be 0',
  path: ['value'],
});

export type AdjustStockPayload = z.infer<typeof adjustStockSchema>;

export const transferStockSchema = z.object({
  sourceBranchId: z.string().min(1, 'Source branch is required'),
  destinationBranchId: z.string().min(1, 'Destination branch is required'),
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().positive('Transfer quantity must be greater than zero'),
  notes: z.string().max(500).optional(),
}).refine((data) => data.sourceBranchId !== data.destinationBranchId, {
  message: 'Source branch and destination branch must be different',
  path: ['destinationBranchId'],
});

export type TransferStockPayload = z.infer<typeof transferStockSchema>;
