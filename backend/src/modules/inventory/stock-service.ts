import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { AppError } from '../../lib/errors.js';
import { inventoryCache } from '../../infrastructure/cache/in-memory-cache.js';
import type {
  StockSummaryQuery,
  StockListQuery,
  StockMovementsQuery,
  RecordOpeningStockPayload,
  ReceiveStockPayload,
  AdjustStockPayload,
  TransferStockPayload,
} from './stock-schemas.js';

export interface StockItemView {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  sku: string;
  barcode: string | null;
  imageUrl: string | null;
  categoryName: string | null;
  brandName: string | null;
  branchId: string;
  branchName: string;
  quantityOnHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  unitOfMeasure: string;
  updatedAt: string;
}

export interface StockSummaryView {
  totalTracked: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalQuantityOnHand: number;
  totalReserved: number;
  totalAvailable: number;
}

export class StockService {
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

  /**
   * Get KPI aggregate statistics for a branch or all branches
   */
  async getStockSummary(orgId: string, query: StockSummaryQuery): Promise<StockSummaryView> {
    const branchId = query.branchId && query.branchId !== 'all' ? query.branchId : undefined;
    const cacheKey = `stock:summary:${orgId}:${branchId ?? 'all'}`;

    return inventoryCache.fetchOrCompute(
      cacheKey,
      async () => {
        const whereClause: Prisma.StockLevelWhereInput = {
          org_id: orgId,
          ...(branchId ? { branch_id: branchId } : {}),
        };

        const stockLevels = await this.db.stockLevel.findMany({
          where: whereClause,
          select: {
            quantity_on_hand: true,
            reserved: true,
            low_stock_threshold: true,
            product: {
              select: {
                low_stock_threshold: true,
              },
            },
          },
        });

        let totalTracked = stockLevels.length;
        let inStockCount = 0;
        let lowStockCount = 0;
        let outOfStockCount = 0;
        let totalQuantityOnHand = 0;
        let totalReserved = 0;

        for (const item of stockLevels) {
          const onHand = Number(item.quantity_on_hand);
          const reserved = Number(item.reserved);
          const threshold = item.low_stock_threshold ?? item.product?.low_stock_threshold ?? 0;

          totalQuantityOnHand += onHand;
          totalReserved += reserved;

          if (onHand <= 0) {
            outOfStockCount++;
          } else if (onHand <= threshold) {
            lowStockCount++;
          } else {
            inStockCount++;
          }
        }

        const totalAvailable = Math.max(0, totalQuantityOnHand - totalReserved);

        return {
          totalTracked,
          inStockCount,
          lowStockCount,
          outOfStockCount,
          totalQuantityOnHand,
          totalReserved,
          totalAvailable,
        };
      },
      30_000
    );
  }

  /**
   * List paginated product stock levels with filter and availability math
   */
  async listStockItems(orgId: string, query: StockListQuery) {
    const branchId = query.branchId && query.branchId !== 'all' ? query.branchId : undefined;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StockLevelWhereInput = {
      org_id: orgId,
      ...(branchId ? { branch_id: branchId } : {}),
      ...(query.search
        ? {
            OR: [
              { product: { name: { contains: query.search, mode: 'insensitive' } } },
              { product: { sku: { contains: query.search, mode: 'insensitive' } } },
              { product: { barcode: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(query.categoryId && query.categoryId !== 'all'
        ? { product: { category_id: query.categoryId } }
        : {}),
      ...(query.brandId && query.brandId !== 'all'
        ? { product: { brand_id: query.brandId } }
        : {}),
    };

    const [rawItems, totalCount] = await Promise.all([
      this.db.stockLevel.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              image_url: true,
              unit_of_measure: true,
              low_stock_threshold: true,
              category: { select: { name: true } },
              brand: { select: { name: true } },
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.db.stockLevel.count({ where }),
    ]);

    const items: StockItemView[] = rawItems
      .map((item) => {
        const onHand = Number(item.quantity_on_hand);
        const reserved = Number(item.reserved);
        const available = Math.max(0, onHand - reserved);
        const threshold = item.low_stock_threshold ?? item.product?.low_stock_threshold ?? 0;

        let status: 'in_stock' | 'low_stock' | 'out_of_stock';
        if (onHand <= 0) {
          status = 'out_of_stock';
        } else if (onHand <= threshold) {
          status = 'low_stock';
        } else {
          status = 'in_stock';
        }

        return {
          id: item.id,
          productId: item.product_id ?? '',
          variantId: item.variant_id,
          productName: item.product?.name ?? 'Unknown Product',
          sku: item.product?.sku ?? '',
          barcode: item.product?.barcode ?? null,
          imageUrl: item.product?.image_url ?? null,
          categoryName: item.product?.category?.name ?? null,
          brandName: item.product?.brand?.name ?? null,
          branchId: item.branch_id,
          branchName: item.branch.name,
          quantityOnHand: onHand,
          reserved,
          available,
          lowStockThreshold: threshold,
          status,
          unitOfMeasure: item.product?.unit_of_measure ?? 'pcs',
          updatedAt: item.updated_at.toISOString(),
        };
      })
      .filter((item) => {
        if (!query.status || query.status === 'all') return true;
        return item.status === query.status;
      });

    return {
      items,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * List append-only stock movement ledger history with filters
   */
  async listStockMovements(orgId: string, query: StockMovementsQuery) {
    const branchId = query.branchId && query.branchId !== 'all' ? query.branchId : undefined;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {
      org_id: orgId,
      ...(branchId ? { branch_id: branchId } : {}),
      ...(query.productId ? { product_id: query.productId } : {}),
      ...(query.movementType && query.movementType !== 'all'
        ? { movement_type: query.movementType as any }
        : {}),
      ...(query.startDate || query.endDate
        ? {
            created_at: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [movements, total] = await Promise.all([
      this.db.stockMovement.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              image_url: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
          actor: {
            select: {
              id: true,
              full_name: true,
              email: true,
            },
          },
        },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.db.stockMovement.count({ where }),
    ]);

    return {
      movements: movements.map((m) => ({
        id: m.id,
        orgId: m.org_id,
        branchId: m.branch_id,
        branchName: m.branch.name,
        productId: m.product_id,
        productName: m.product.name,
        productSku: m.product.sku,
        productImageUrl: m.product.image_url,
        movementType: m.movement_type,
        quantity: Number(m.quantity),
        balanceBefore: Number(m.balance_before),
        balanceAfter: Number(m.balance_after),
        reason: m.reason,
        referenceId: m.reference_id,
        actorId: m.actor_id,
        actorName: m.actor?.full_name ?? 'System',
        notes: m.notes,
        createdAt: m.created_at.toISOString(),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Record initial opening stock for a product at a branch
   */
  async recordOpeningStock(orgId: string, userId: string, payload: RecordOpeningStockPayload) {
    const { branchId, productId, variantId, quantity, notes } = payload;

    const result = await this.db.$transaction(async (tx) => {
      // 1. Validate Product and Branch belong to org
      const [product, branch] = await Promise.all([
        tx.product.findFirst({
          where: { id: productId, org_id: orgId, is_deleted: false },
          select: { id: true, name: true },
        }),
        tx.branch.findFirst({
          where: { id: branchId, org_id: orgId, is_deleted: false },
          select: { id: true, name: true },
        }),
      ]);

      if (!product) {
        throw new AppError('PRODUCT_NOT_FOUND', 'Product not found in this organization', 404);
      }
      if (!branch) {
        throw new AppError('BRANCH_NOT_FOUND', 'Branch not found or inactive', 404);
      }

      // 2. Fetch existing stock level or initialize
      const existingLevel = await tx.stockLevel.findFirst({
        where: {
          org_id: orgId,
          branch_id: branchId,
          product_id: productId,
          variant_id: variantId ?? null,
        },
      });

      const currentOnHand = existingLevel ? Number(existingLevel.quantity_on_hand) : 0;
      const newOnHand = quantity;
      const delta = newOnHand - currentOnHand;

      let stockLevelId: string;
      if (existingLevel) {
        const updated = await tx.stockLevel.update({
          where: { id: existingLevel.id },
          data: { quantity_on_hand: new Prisma.Decimal(newOnHand) },
          select: { id: true },
        });
        stockLevelId = updated.id;
      } else {
        const created = await tx.stockLevel.create({
          data: {
            org_id: orgId,
            branch_id: branchId,
            product_id: productId,
            variant_id: variantId ?? null,
            quantity_on_hand: new Prisma.Decimal(newOnHand),
            reserved: new Prisma.Decimal(0),
          },
          select: { id: true },
        });
        stockLevelId = created.id;
      }

      // 3. Append to immutable movement ledger
      const movement = await tx.stockMovement.create({
        data: {
          org_id: orgId,
          branch_id: branchId,
          product_id: productId,
          variant_id: variantId ?? null,
          movement_type: 'opening',
          quantity: new Prisma.Decimal(delta),
          balance_before: new Prisma.Decimal(currentOnHand),
          balance_after: new Prisma.Decimal(newOnHand),
          actor_id: userId,
          notes: notes ?? 'Initial opening stock balance',
        },
      });

      return {
        stockLevelId,
        movementId: movement.id,
        quantityOnHand: newOnHand,
      };
    });

    await this.invalidateStockCache(orgId, branchId);
    return result;
  }

  /**
   * Receive stock replenishment without requiring formal purchase orders
   */
  async receiveStock(orgId: string, userId: string, payload: ReceiveStockPayload) {
    const { branchId, productId, variantId, quantity, reference, notes } = payload;

    const result = await this.db.$transaction(async (tx) => {
      const [product, branch] = await Promise.all([
        tx.product.findFirst({
          where: { id: productId, org_id: orgId, is_deleted: false },
          select: { id: true },
        }),
        tx.branch.findFirst({
          where: { id: branchId, org_id: orgId, is_deleted: false },
          select: { id: true },
        }),
      ]);

      if (!product) {
        throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
      }
      if (!branch) {
        throw new AppError('BRANCH_NOT_FOUND', 'Branch not found or inactive', 404);
      }

      const existingLevel = await tx.stockLevel.findFirst({
        where: {
          org_id: orgId,
          branch_id: branchId,
          product_id: productId,
          variant_id: variantId ?? null,
        },
      });

      const currentOnHand = existingLevel ? Number(existingLevel.quantity_on_hand) : 0;
      const newOnHand = currentOnHand + quantity;

      let stockLevelId: string;
      if (existingLevel) {
        const updated = await tx.stockLevel.update({
          where: { id: existingLevel.id },
          data: { quantity_on_hand: new Prisma.Decimal(newOnHand) },
          select: { id: true },
        });
        stockLevelId = updated.id;
      } else {
        const created = await tx.stockLevel.create({
          data: {
            org_id: orgId,
            branch_id: branchId,
            product_id: productId,
            variant_id: variantId ?? null,
            quantity_on_hand: new Prisma.Decimal(newOnHand),
            reserved: new Prisma.Decimal(0),
          },
          select: { id: true },
        });
        stockLevelId = created.id;
      }

      const movement = await tx.stockMovement.create({
        data: {
          org_id: orgId,
          branch_id: branchId,
          product_id: productId,
          variant_id: variantId ?? null,
          movement_type: 'receipt',
          quantity: new Prisma.Decimal(quantity),
          balance_before: new Prisma.Decimal(currentOnHand),
          balance_after: new Prisma.Decimal(newOnHand),
          reference_id: reference ?? null,
          actor_id: userId,
          notes: notes ?? null,
        },
      });

      return {
        stockLevelId,
        movementId: movement.id,
        quantityOnHand: newOnHand,
        addedQuantity: quantity,
      };
    });

    await this.invalidateStockCache(orgId, branchId);
    return result;
  }

  /**
   * Adjust stock via delta (+/-) or counted quantity with reason and negative stock checks
   */
  async adjustStock(orgId: string, userId: string, payload: AdjustStockPayload) {
    const { branchId, productId, variantId, mode, value, reason, notes } = payload;

    const result = await this.db.$transaction(async (tx) => {
      const [product, branch] = await Promise.all([
        tx.product.findFirst({
          where: { id: productId, org_id: orgId, is_deleted: false },
          select: { id: true },
        }),
        tx.branch.findFirst({
          where: { id: branchId, org_id: orgId, is_deleted: false },
          select: { id: true },
        }),
      ]);

      if (!product) throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
      if (!branch) throw new AppError('BRANCH_NOT_FOUND', 'Branch not found or inactive', 404);

      const existingLevel = await tx.stockLevel.findFirst({
        where: {
          org_id: orgId,
          branch_id: branchId,
          product_id: productId,
          variant_id: variantId ?? null,
        },
      });

      const currentOnHand = existingLevel ? Number(existingLevel.quantity_on_hand) : 0;
      const reserved = existingLevel ? Number(existingLevel.reserved) : 0;

      let newOnHand: number;
      let delta: number;

      if (mode === 'delta') {
        delta = value;
        newOnHand = currentOnHand + delta;
      } else {
        newOnHand = value;
        delta = newOnHand - currentOnHand;
      }

      // Strict Non-Negative Check: on-hand cannot fall below reserved or zero
      if (newOnHand < reserved) {
        throw new AppError(
          'INSUFFICIENT_STOCK',
          `Cannot adjust stock: resulting on-hand (${newOnHand}) would be less than currently reserved quantity (${reserved})`,
          409
        );
      }
      if (newOnHand < 0) {
        throw new AppError(
          'INSUFFICIENT_STOCK',
          `Cannot adjust stock: resulting quantity (${newOnHand}) cannot be negative`,
          409
        );
      }

      let stockLevelId: string;
      if (existingLevel) {
        const updated = await tx.stockLevel.update({
          where: { id: existingLevel.id },
          data: { quantity_on_hand: new Prisma.Decimal(newOnHand) },
          select: { id: true },
        });
        stockLevelId = updated.id;
      } else {
        const created = await tx.stockLevel.create({
          data: {
            org_id: orgId,
            branch_id: branchId,
            product_id: productId,
            variant_id: variantId ?? null,
            quantity_on_hand: new Prisma.Decimal(newOnHand),
            reserved: new Prisma.Decimal(0),
          },
          select: { id: true },
        });
        stockLevelId = created.id;
      }

      const movement = await tx.stockMovement.create({
        data: {
          org_id: orgId,
          branch_id: branchId,
          product_id: productId,
          variant_id: variantId ?? null,
          movement_type: 'adjustment',
          quantity: new Prisma.Decimal(delta),
          balance_before: new Prisma.Decimal(currentOnHand),
          balance_after: new Prisma.Decimal(newOnHand),
          reason: reason as any,
          actor_id: userId,
          notes: notes ?? null,
        },
      });

      return {
        stockLevelId,
        movementId: movement.id,
        quantityOnHand: newOnHand,
        delta,
      };
    });

    await this.invalidateStockCache(orgId, branchId);
    return result;
  }

  /**
   * Transfer stock atomically between two distinct branches in the organization
   */
  async transferStock(orgId: string, userId: string, payload: TransferStockPayload) {
    const { sourceBranchId, destinationBranchId, productId, variantId, quantity, notes } = payload;

    const result = await this.db.$transaction(async (tx) => {
      // 1. Verify branches and product
      const [sourceBranch, destBranch, product] = await Promise.all([
        tx.branch.findFirst({
          where: { id: sourceBranchId, org_id: orgId, is_deleted: false },
          select: { id: true, name: true },
        }),
        tx.branch.findFirst({
          where: { id: destinationBranchId, org_id: orgId, is_deleted: false },
          select: { id: true, name: true },
        }),
        tx.product.findFirst({
          where: { id: productId, org_id: orgId, is_deleted: false },
          select: { id: true, name: true },
        }),
      ]);

      if (!sourceBranch) throw new AppError('BRANCH_NOT_FOUND', 'Source branch not found or inactive', 404);
      if (!destBranch) throw new AppError('BRANCH_NOT_FOUND', 'Destination branch not found or inactive', 404);
      if (!product) throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);

      // 2. Check source available stock
      const sourceLevel = await tx.stockLevel.findFirst({
        where: {
          org_id: orgId,
          branch_id: sourceBranchId,
          product_id: productId,
          variant_id: variantId ?? null,
        },
      });

      const sourceOnHand = sourceLevel ? Number(sourceLevel.quantity_on_hand) : 0;
      const sourceReserved = sourceLevel ? Number(sourceLevel.reserved) : 0;
      const sourceAvailable = sourceOnHand - sourceReserved;

      if (sourceAvailable < quantity) {
        throw new AppError(
          'INSUFFICIENT_STOCK',
          `Insufficient available stock at ${sourceBranch.name}. Available: ${sourceAvailable}, requested: ${quantity}`,
          409
        );
      }

      // Generate shared transfer reference ID
      const transferRefId = `TRF_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      // 3. Deduct from Source branch
      const newSourceOnHand = sourceOnHand - quantity;
      await tx.stockLevel.update({
        where: { id: sourceLevel!.id },
        data: { quantity_on_hand: new Prisma.Decimal(newSourceOnHand) },
      });

      const transferOutMovement = await tx.stockMovement.create({
        data: {
          org_id: orgId,
          branch_id: sourceBranchId,
          product_id: productId,
          variant_id: variantId ?? null,
          movement_type: 'transfer_out',
          quantity: new Prisma.Decimal(-quantity),
          balance_before: new Prisma.Decimal(sourceOnHand),
          balance_after: new Prisma.Decimal(newSourceOnHand),
          reference_id: transferRefId,
          actor_id: userId,
          notes: notes ? `Transfer to ${destBranch.name}: ${notes}` : `Transfer to ${destBranch.name}`,
        },
      });

      // 4. Add to Destination branch
      const destLevel = await tx.stockLevel.findFirst({
        where: {
          org_id: orgId,
          branch_id: destinationBranchId,
          product_id: productId,
          variant_id: variantId ?? null,
        },
      });

      const destOnHand = destLevel ? Number(destLevel.quantity_on_hand) : 0;
      const newDestOnHand = destOnHand + quantity;

      if (destLevel) {
        await tx.stockLevel.update({
          where: { id: destLevel.id },
          data: { quantity_on_hand: new Prisma.Decimal(newDestOnHand) },
        });
      } else {
        await tx.stockLevel.create({
          data: {
            org_id: orgId,
            branch_id: destinationBranchId,
            product_id: productId,
            variant_id: variantId ?? null,
            quantity_on_hand: new Prisma.Decimal(newDestOnHand),
            reserved: new Prisma.Decimal(0),
          },
        });
      }

      const transferInMovement = await tx.stockMovement.create({
        data: {
          org_id: orgId,
          branch_id: destinationBranchId,
          product_id: productId,
          variant_id: variantId ?? null,
          movement_type: 'transfer_in',
          quantity: new Prisma.Decimal(quantity),
          balance_before: new Prisma.Decimal(destOnHand),
          balance_after: new Prisma.Decimal(newDestOnHand),
          reference_id: transferRefId,
          actor_id: userId,
          notes: notes ? `Transfer from ${sourceBranch.name}: ${notes}` : `Transfer from ${sourceBranch.name}`,
        },
      });

      return {
        transferReferenceId: transferRefId,
        sourceMovementId: transferOutMovement.id,
        destinationMovementId: transferInMovement.id,
        transferredQuantity: quantity,
        sourceBalanceAfter: newSourceOnHand,
        destinationBalanceAfter: newDestOnHand,
      };
    });

    await this.invalidateStockCache(orgId, sourceBranchId);
    await this.invalidateStockCache(orgId, destinationBranchId);
    return result;
  }
}
