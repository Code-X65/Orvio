import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { AppError } from '../../lib/errors.js';
import { inventoryCache } from '../../infrastructure/cache/in-memory-cache.js';
import type {
  CreateStockReceiptInput,
  ListStockReceiptsQueryInput,
} from './stock-receipts-schemas.js';

export interface StockReceiptLineView {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  variantId: string | null;
  variantSku?: string | null;
  variantName?: string | null;
  quantityReceived: number;
  unitCost: number | null;
  totalCost: number | null;
  notes: string | null;
}

export interface StockReceiptView {
  id: string;
  reference: string;
  receiptDate: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  branchName: string;
  supplierInvoiceNumber: string | null;
  notes: string | null;
  status: string;
  lineCount: number;
  totalQuantity: number;
  totalCost: number | null;
  receivedById: string | null;
  receivedByName: string | null;
  createdAt: string;
  items?: StockReceiptLineView[];
  movementsCount?: number;
}

export class StockReceiptService {
  constructor(private db: PrismaClient = defaultPrisma) {}

  private invalidateStockCache(orgId: string, branchId?: string) {
    inventoryCache.clearPrefix(`stock:summary:${orgId}`);
    if (branchId) {
      inventoryCache.clearPrefix(`stock:${orgId}:${branchId}`);
      inventoryCache.clearPrefix(`branch_products:${orgId}:${branchId}`);
    } else {
      inventoryCache.clearPrefix(`stock:${orgId}`);
      inventoryCache.clearPrefix(`branch_products:${orgId}`);
    }
  }

  private async generateUniqueReference(tx: Prisma.TransactionClient, orgId: string): Promise<string> {
    const count = await tx.stockReceipt.count({ where: { org_id: orgId } });
    let candidate = `RCPT-${String(count + 1).padStart(6, '0')}`;
    let suffix = 1;

    while (await tx.stockReceipt.findUnique({ where: { org_id_reference: { org_id: orgId, reference: candidate } } })) {
      candidate = `RCPT-${String(count + 1 + suffix).padStart(6, '0')}`;
      suffix++;
    }

    return candidate;
  }

  async createReceipt(orgId: string, userId: string, payload: CreateStockReceiptInput) {
    const { branchId, supplierId, reference, receiptDate, supplierInvoiceNumber, notes, items } = payload;

    const result = await this.db.$transaction(
      async (tx) => {
        // 1. Validate Branch
        const branch = await tx.branch.findFirst({
          where: { id: branchId, org_id: orgId, is_deleted: false },
          select: { id: true, name: true },
        });

        if (!branch) {
          throw new AppError('BRANCH_NOT_FOUND', 'Destination branch not found or inactive', 404);
        }

        // 2. Validate Supplier
        const supplier = await tx.supplier.findFirst({
          where: { id: supplierId, org_id: orgId, deleted_at: null },
          select: { id: true, name: true, is_active: true },
        });

        if (!supplier) {
          throw new AppError('SUPPLIER_NOT_FOUND', 'Supplier not found in this organization', 404);
        }

        if (!supplier.is_active) {
          throw new AppError('SUPPLIER_INACTIVE', 'Cannot receive stock from a deactivated supplier', 400);
        }

        // 3. Resolve Reference
        let finalReference: string;
        if (reference && reference.trim().length > 0) {
          const trimmedRef = reference.trim();
          const existing = await tx.stockReceipt.findUnique({
            where: { org_id_reference: { org_id: orgId, reference: trimmedRef } },
          });
          if (existing) {
            throw new AppError('DUPLICATE_RECEIPT_REFERENCE', `Receipt reference "${trimmedRef}" is already used in this organization`, 409, {
              field: 'reference',
            });
          }
          finalReference = trimmedRef;
        } else {
          finalReference = await this.generateUniqueReference(tx, orgId);
        }

        const effectiveReceiptDate = receiptDate ? new Date(receiptDate) : new Date();

        // 4. Create the Stock Receipt record
        const receipt = await tx.stockReceipt.create({
          data: {
            org_id: orgId,
            branch_id: branchId,
            supplier_id: supplierId,
            reference: finalReference,
            receipt_date: effectiveReceiptDate,
            supplier_invoice_number: supplierInvoiceNumber?.trim() || null,
            notes: notes?.trim() || null,
            status: 'completed',
            created_by_user_id: userId,
            received_by_user_id: userId,
          },
        });

        // 5. Pre-fetch Products & Variants in batch
        const productIds = Array.from(new Set(items.map((i) => i.productId)));
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, org_id: orgId, is_deleted: false },
          select: { id: true, name: true, sku: true, has_variants: true, track_quantity: true },
        });
        const productMap = new Map(products.map((p) => [p.id, p]));

        const variantIds = Array.from(
          new Set(items.map((i) => i.variantId).filter((v): v is string => Boolean(v)))
        );
        const variants =
          variantIds.length > 0
            ? await tx.productVariant.findMany({
                where: { id: { in: variantIds }, org_id: orgId, is_deleted: false },
                select: { id: true, product_id: true, sku: true },
              })
            : [];
        const variantMap = new Map(variants.map((v) => [v.id, v]));

        // Pre-fetch existing StockLevels for this branch
        const existingStockLevels = await tx.stockLevel.findMany({
          where: {
            org_id: orgId,
            branch_id: branchId,
            product_id: { in: productIds },
          },
        });
        const stockLevelMap = new Map(
          existingStockLevels.map((sl) => [`${sl.product_id}:${sl.variant_id ?? ''}`, sl])
        );

        // Pre-fetch branchProduct assignments
        const existingBranchProducts = await tx.branchProduct.findMany({
          where: {
            org_id: orgId,
            branch_id: branchId,
            product_id: { in: productIds },
          },
          select: { product_id: true },
        });
        const branchProductSet = new Set(existingBranchProducts.map((bp) => bp.product_id));

        const receiptItems: Array<{
          id: string;
          productId: string;
          variantId: string | null;
          quantityReceived: number;
          unitCost: number | null;
          notes: string | null;
        }> = [];

        let totalQty = 0;
        let totalVal: number | null = null;

        for (const item of items) {
          const product = productMap.get(item.productId);
          if (!product) {
            throw new AppError('PRODUCT_NOT_FOUND', `Product ID "${item.productId}" not found in this organization`, 404);
          }

          if (product.has_variants && !item.variantId) {
            throw new AppError(
              'VARIANT_REQUIRED',
              `Product "${product.name}" requires selecting a specific variant for stock receiving`,
              400,
              { productId: item.productId }
            );
          }

          if (item.variantId) {
            const variant = variantMap.get(item.variantId);
            if (!variant || variant.product_id !== item.productId) {
              throw new AppError('VARIANT_NOT_FOUND', `Variant not found for product "${product.name}"`, 404);
            }
          }

          // Ensure branch product mapping exists
          if (!branchProductSet.has(item.productId)) {
            await tx.branchProduct.create({
              data: {
                org_id: orgId,
                product_id: item.productId,
                branch_id: branchId,
                is_excluded: false,
                added_by_user_id: userId,
              },
            });
            branchProductSet.add(item.productId);
          }

          // Create receipt item
          const createdItem = await tx.stockReceiptItem.create({
            data: {
              stock_receipt_id: receipt.id,
              product_id: item.productId,
              variant_id: item.variantId ?? null,
              quantity_received: new Prisma.Decimal(item.quantityReceived),
              unit_cost: item.unitCost !== undefined && item.unitCost !== null ? new Prisma.Decimal(item.unitCost) : null,
              notes: item.notes?.trim() || null,
            },
          });

          // Update or create StockLevel
          const levelKey = `${item.productId}:${item.variantId ?? ''}`;
          const existingLevel = stockLevelMap.get(levelKey);
          const currentOnHand = existingLevel ? Number(existingLevel.quantity_on_hand) : 0;
          const newOnHand = currentOnHand + item.quantityReceived;

          if (existingLevel) {
            await tx.stockLevel.update({
              where: { id: existingLevel.id },
              data: { quantity_on_hand: new Prisma.Decimal(newOnHand) },
            });
            existingLevel.quantity_on_hand = new Prisma.Decimal(newOnHand);
          } else {
            const newLevel = await tx.stockLevel.create({
              data: {
                org_id: orgId,
                branch_id: branchId,
                product_id: item.productId,
                variant_id: item.variantId ?? null,
                quantity_on_hand: new Prisma.Decimal(newOnHand),
                reserved: new Prisma.Decimal(0),
              },
            });
            stockLevelMap.set(levelKey, newLevel);
          }

          // Append StockMovement ledger record
          await tx.stockMovement.create({
            data: {
              org_id: orgId,
              branch_id: branchId,
              product_id: item.productId,
              variant_id: item.variantId ?? null,
              movement_type: 'receipt',
              quantity: new Prisma.Decimal(item.quantityReceived),
              balance_before: new Prisma.Decimal(currentOnHand),
              balance_after: new Prisma.Decimal(newOnHand),
              reference_id: finalReference,
              stock_receipt_id: receipt.id,
              actor_id: userId,
              notes: item.notes || notes || `Received from supplier ${supplier.name}`,
              metadata: {
                supplierId: supplier.id,
                supplierName: supplier.name,
                supplierInvoiceNumber: supplierInvoiceNumber || null,
                unitCost: item.unitCost ?? null,
              },
            },
          });

          totalQty += item.quantityReceived;
          if (item.unitCost !== undefined && item.unitCost !== null) {
            totalVal = (totalVal ?? 0) + item.unitCost * item.quantityReceived;
          }

          receiptItems.push({
            id: createdItem.id,
            productId: item.productId,
            variantId: item.variantId ?? null,
            quantityReceived: item.quantityReceived,
            unitCost: item.unitCost ?? null,
            notes: item.notes ?? null,
          });
        }

        return {
          id: receipt.id,
          reference: receipt.reference,
          receiptDate: receipt.receipt_date.toISOString(),
          branchId: branch.id,
          branchName: branch.name,
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierInvoiceNumber: receipt.supplier_invoice_number,
          notes: receipt.notes,
          status: receipt.status,
          lineCount: receiptItems.length,
          totalQuantity: totalQty,
          totalCost: totalVal,
          receivedById: userId,
          createdAt: receipt.created_at.toISOString(),
          items: receiptItems,
        };
      },
      {
        timeout: 30000,
        maxWait: 10000,
      }
    );

    this.invalidateStockCache(orgId, branchId);
    return result;
  }

  async listReceipts(orgId: string, query: ListStockReceiptsQueryInput) {
    const { branchId, supplierId, productId, search, startDate, endDate, page, limit, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StockReceiptWhereInput = {
      org_id: orgId,
      ...(branchId && branchId !== 'all' ? { branch_id: branchId } : {}),
      ...(supplierId ? { supplier_id: supplierId } : {}),
      ...(productId
        ? {
            items: {
              some: { product_id: productId },
            },
          }
        : {}),
      ...(startDate || endDate
        ? {
            receipt_date: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { reference: { contains: search, mode: 'insensitive' } },
              { supplier_invoice_number: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
              { supplier: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    let orderBy: Prisma.StockReceiptOrderByWithRelationInput = { receipt_date: sortOrder };
    if (sortBy === 'reference') {
      orderBy = { reference: sortOrder };
    } else if (sortBy === 'created_at') {
      orderBy = { created_at: sortOrder };
    }

    const [total, items] = await Promise.all([
      this.db.stockReceipt.count({ where }),
      this.db.stockReceipt.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          supplier: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          received_by: { select: { id: true, full_name: true, email: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
              variant: { select: { id: true, sku: true, attributes: true } },
            },
          },
        },
      }),
    ]);

    const receipts: StockReceiptView[] = items.map((r) => {
      let totalQty = 0;
      let totalCost: number | null = null;

      const lines: StockReceiptLineView[] = r.items.map((line) => {
        const qty = Number(line.quantity_received);
        const cost = line.unit_cost ? Number(line.unit_cost) : null;
        totalQty += qty;
        if (cost !== null) {
          totalCost = (totalCost ?? 0) + cost * qty;
        }

        return {
          id: line.id,
          productId: line.product_id,
          productName: line.product.name,
          productSku: line.product.sku,
          variantId: line.variant_id,
          variantSku: line.variant?.sku,
          quantityReceived: qty,
          unitCost: cost,
          totalCost: cost !== null ? cost * qty : null,
          notes: line.notes,
        };
      });

      return {
        id: r.id,
        reference: r.reference,
        receiptDate: r.receipt_date.toISOString(),
        supplierId: r.supplier_id,
        supplierName: r.supplier.name,
        branchId: r.branch_id,
        branchName: r.branch.name,
        supplierInvoiceNumber: r.supplier_invoice_number,
        notes: r.notes,
        status: r.status,
        lineCount: lines.length,
        totalQuantity: totalQty,
        totalCost,
        receivedById: r.received_by_user_id,
        receivedByName: r.received_by?.full_name || null,
        createdAt: r.created_at.toISOString(),
        items: lines,
      };
    });

    return {
      receipts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getReceiptById(orgId: string, receiptId: string) {
    const receipt = await this.db.stockReceipt.findFirst({
      where: { id: receiptId, org_id: orgId },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            contact_person: true,
            address: true,
          },
        },
        branch: { select: { id: true, name: true, code: true } },
        received_by: { select: { id: true, full_name: true, email: true } },
        created_by: { select: { id: true, full_name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit_of_measure: true } },
            variant: { select: { id: true, sku: true, attributes: true } },
          },
        },
        stock_movements: {
          select: {
            id: true,
            product_id: true,
            variant_id: true,
            quantity: true,
            balance_before: true,
            balance_after: true,
            created_at: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new AppError('RECEIPT_NOT_FOUND', 'Stock receipt not found in this organization', 404);
    }

    let totalQty = 0;
    let totalCost: number | null = null;

    const items: StockReceiptLineView[] = receipt.items.map((line) => {
      const qty = Number(line.quantity_received);
      const cost = line.unit_cost ? Number(line.unit_cost) : null;
      totalQty += qty;
      if (cost !== null) {
        totalCost = (totalCost ?? 0) + cost * qty;
      }

      return {
        id: line.id,
        productId: line.product_id,
        productName: line.product.name,
        productSku: line.product.sku,
        variantId: line.variant_id,
        variantSku: line.variant?.sku,
        quantityReceived: qty,
        unitCost: cost,
        totalCost: cost !== null ? cost * qty : null,
        notes: line.notes,
      };
    });

    return {
      id: receipt.id,
      reference: receipt.reference,
      receiptDate: receipt.receipt_date.toISOString(),
      supplierId: receipt.supplier_id,
      supplierName: receipt.supplier.name,
      supplierDetails: receipt.supplier,
      branchId: receipt.branch_id,
      branchName: receipt.branch.name,
      supplierInvoiceNumber: receipt.supplier_invoice_number,
      notes: receipt.notes,
      status: receipt.status,
      lineCount: items.length,
      totalQuantity: totalQty,
      totalCost,
      receivedById: receipt.received_by_user_id,
      receivedByName: receipt.received_by?.full_name || null,
      createdByName: receipt.created_by?.full_name || null,
      createdAt: receipt.created_at.toISOString(),
      items,
      movements: receipt.stock_movements.map((m) => ({
        id: m.id,
        productId: m.product_id,
        variantId: m.variant_id,
        quantity: Number(m.quantity),
        balanceBefore: Number(m.balance_before),
        balanceAfter: Number(m.balance_after),
        createdAt: m.created_at.toISOString(),
      })),
    };
  }
}
