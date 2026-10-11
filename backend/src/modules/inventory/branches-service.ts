import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { AppError } from '../../lib/errors.js';
import { inventoryCache } from '../../infrastructure/cache/in-memory-cache.js';
import type {
  CreateBranchInput,
  UpdateBranchInput,
  ListBranchesQueryInput,
  DeleteBranchQueryInput,
} from './branches-schemas.js';

export interface BranchListItem {
  id: string;
  name: string;
  code: string | null;
  type: string;
  status: string;
  is_primary: boolean;
  phone: string | null;
  email: string | null;
  address: any;
  total_products: number;
  total_on_hand: number;
  total_reserved: number;
  is_deleted: boolean;
  deleted_at: Date | null;
  deleted_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export class BranchService {
  constructor(private db: PrismaClient = defaultPrisma) {}

  private invalidateCache(orgId: string): void {
    inventoryCache.clearPrefix(`inv_onb_status:${orgId}`);
    inventoryCache.clearPrefix(`branches_list:${orgId}`);
    inventoryCache.clearPrefix(`products_list:${orgId}`);
    inventoryCache.clearPrefix(`products_detail:${orgId}`);
  }

  async listBranches(orgId: string, query?: ListBranchesQueryInput): Promise<BranchListItem[]> {
    const cacheKey = `branches_list:${orgId}:${JSON.stringify(query || {})}`;

    return await inventoryCache.fetchOrCompute(
      cacheKey,
      async () => {
        const whereClause: any = {
          org_id: orgId,
        };

        if (!query?.includeDeleted) {
          whereClause.is_deleted = false;
        }

        if (query?.status && query.status !== 'all') {
          whereClause.status = query.status;
        } else if (query?.activeOnly) {
          whereClause.status = 'active';
        }

        const branches = await this.db.branch.findMany({
          where: whereClause,
          include: {
            stock_levels: {
              select: {
                quantity_on_hand: true,
                reserved: true,
                product_id: true,
              },
            },
          },
          orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
        });

        return branches.map((b) => {
          let totalOnHand = 0;
          let totalReserved = 0;
          const uniqueProducts = new Set<string>();

          for (const sl of b.stock_levels) {
            totalOnHand += Number(sl.quantity_on_hand);
            totalReserved += Number(sl.reserved);
            if (sl.product_id) {
              uniqueProducts.add(sl.product_id);
            }
          }

          return {
            id: b.id,
            name: b.name,
            code: b.code,
            type: b.type,
            status: b.status,
            is_primary: b.is_primary,
            phone: b.phone,
            email: b.email,
            address: b.address,
            total_products: uniqueProducts.size,
            total_on_hand: totalOnHand,
            total_reserved: totalReserved,
            is_deleted: b.is_deleted,
            deleted_at: b.deleted_at,
            deleted_reason: b.deleted_reason,
            created_at: b.created_at,
            updated_at: b.updated_at,
          };
        });
      },
      30_000
    );
  }

  async getBranch(orgId: string, branchId: string): Promise<BranchListItem> {
    const branch = await this.db.branch.findFirst({
      where: { id: branchId, org_id: orgId, is_deleted: false },
      include: {
        stock_levels: {
          select: {
            quantity_on_hand: true,
            reserved: true,
            product_id: true,
          },
        },
      },
    });

    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    let totalOnHand = 0;
    let totalReserved = 0;
    const uniqueProducts = new Set<string>();

    for (const sl of branch.stock_levels) {
      totalOnHand += Number(sl.quantity_on_hand);
      totalReserved += Number(sl.reserved);
      if (sl.product_id) {
        uniqueProducts.add(sl.product_id);
      }
    }

    return {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      type: branch.type,
      status: branch.status,
      is_primary: branch.is_primary,
      phone: branch.phone,
      email: branch.email,
      address: branch.address,
      total_products: uniqueProducts.size,
      total_on_hand: totalOnHand,
      total_reserved: totalReserved,
      is_deleted: branch.is_deleted,
      deleted_at: branch.deleted_at,
      deleted_reason: branch.deleted_reason,
      created_at: branch.created_at,
      updated_at: branch.updated_at,
    };
  }

  async getBranchStock(orgId: string, branchId: string) {
    const branch = await this.db.branch.findFirst({
      where: { id: branchId, org_id: orgId, is_deleted: false },
    });

    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    const stockLevels = await this.db.stockLevel.findMany({
      where: { org_id: orgId, branch_id: branchId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            barcode: true,
            unit_of_measure: true,
            is_active: true,
            category: { select: { id: true, name: true } },
          },
        },
        variant: {
          select: {
            id: true,
            sku: true,
            barcode: true,
            attributes: true,
          },
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    return stockLevels.map((sl) => ({
      id: sl.id,
      product_id: sl.product_id,
      variant_id: sl.variant_id,
      product_name: sl.product?.name ?? 'Unknown',
      sku: sl.variant?.sku ?? sl.product?.sku ?? '',
      barcode: sl.variant?.barcode ?? sl.product?.barcode ?? null,
      unit_of_measure: sl.product?.unit_of_measure ?? 'pcs',
      category_name: sl.product?.category?.name ?? null,
      quantity_on_hand: Number(sl.quantity_on_hand),
      reserved: Number(sl.reserved),
      available: Number(sl.quantity_on_hand) - Number(sl.reserved),
      variant_attributes: sl.variant?.attributes ?? null,
      updated_at: sl.updated_at,
    }));
  }

  async createBranch(orgId: string, input: CreateBranchInput, _userId?: string) {
    // Check for duplicate branch name among active branches
    const existingName = await this.db.branch.findFirst({
      where: {
        org_id: orgId,
        name: { equals: input.name, mode: 'insensitive' },
        is_deleted: false,
      },
    });

    if (existingName) {
      throw new AppError(
        'DUPLICATE_BRANCH_NAME',
        `A branch named "${input.name}" already exists in your organization.`,
        400
      );
    }

    if (input.code) {
      const existingCode = await this.db.branch.findFirst({
        where: {
          org_id: orgId,
          code: { equals: input.code, mode: 'insensitive' },
          is_deleted: false,
        },
      });

      if (existingCode) {
        throw new AppError(
          'DUPLICATE_BRANCH_CODE',
          `A branch with code "${input.code}" already exists in your organization.`,
          400
        );
      }
    }

    // Check if this is the first branch in the org
    const activeBranchCount = await this.db.branch.count({
      where: { org_id: orgId, is_deleted: false },
    });

    const isPrimary = activeBranchCount === 0 ? true : Boolean(input.isPrimary);

    const result = await this.db.$transaction(async (tx) => {
      if (isPrimary && activeBranchCount > 0) {
        // Demote existing primaries
        await tx.branch.updateMany({
          where: { org_id: orgId, is_primary: true },
          data: { is_primary: false },
        });
      }

      return await tx.branch.create({
        data: {
          org_id: orgId,
          name: input.name,
          code: input.code || null,
          type: input.type,
          status: input.status,
          is_primary: isPrimary,
          phone: input.phone || null,
          email: input.email || null,
          address: (input.address as any) ?? undefined,
        },
      });
    });

    this.invalidateCache(orgId);
    return result;
  }

  async updateBranch(orgId: string, branchId: string, input: UpdateBranchInput, _userId?: string) {
    const existing = await this.db.branch.findFirst({
      where: { id: branchId, org_id: orgId, is_deleted: false },
    });

    if (!existing) {
      throw new AppError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicateName = await this.db.branch.findFirst({
        where: {
          org_id: orgId,
          name: { equals: input.name, mode: 'insensitive' },
          id: { not: branchId },
          is_deleted: false,
        },
      });

      if (duplicateName) {
        throw new AppError(
          'DUPLICATE_BRANCH_NAME',
          `A branch named "${input.name}" already exists.`,
          400
        );
      }
    }

    if (input.code && input.code.toLowerCase() !== (existing.code?.toLowerCase() || '')) {
      const duplicateCode = await this.db.branch.findFirst({
        where: {
          org_id: orgId,
          code: { equals: input.code, mode: 'insensitive' },
          id: { not: branchId },
          is_deleted: false,
        },
      });

      if (duplicateCode) {
        throw new AppError(
          'DUPLICATE_BRANCH_CODE',
          `A branch with code "${input.code}" already exists.`,
          400
        );
      }
    }

    if (input.isPrimary === false && existing.is_primary) {
      throw new AppError(
        'IS_PRIMARY_BRANCH',
        'Cannot unmark this branch as primary directly. Designate another branch as primary instead.',
        400
      );
    }

    const result = await this.db.$transaction(async (tx) => {
      if (input.isPrimary === true && !existing.is_primary) {
        await tx.branch.updateMany({
          where: { org_id: orgId, is_primary: true },
          data: { is_primary: false },
        });
      }

      return await tx.branch.update({
        where: { id: branchId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.code !== undefined && { code: input.code || null }),
          ...(input.type !== undefined && { type: input.type }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.isPrimary !== undefined && { is_primary: input.isPrimary }),
          ...(input.phone !== undefined && { phone: input.phone || null }),
          ...(input.email !== undefined && { email: input.email || null }),
          ...(input.address !== undefined && { address: (input.address as any) ?? undefined }),
        },
      });
    });

    this.invalidateCache(orgId);
    return result;
  }

  async deleteBranch(
    orgId: string,
    branchId: string,
    options: { userId?: string; reason?: string; confirmWithStock?: boolean } = {}
  ): Promise<{ success: true }> {
    const branch = await this.db.branch.findFirst({
      where: { id: branchId, org_id: orgId, is_deleted: false },
    });

    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    const activeCount = await this.db.branch.count({
      where: { org_id: orgId, is_deleted: false },
    });

    if (activeCount <= 1) {
      throw new AppError(
        'CANNOT_DELETE_ONLY_BRANCH',
        'Cannot archive the only branch in your organization. An organization must have at least one branch.',
        400
      );
    }

    if (branch.is_primary) {
      throw new AppError(
        'IS_PRIMARY_BRANCH',
        'Cannot archive the primary branch. Designate another branch as primary first.',
        400
      );
    }

    // Check stock levels
    const stockLevels = await this.db.stockLevel.findMany({
      where: { branch_id: branchId, org_id: orgId },
      select: { quantity_on_hand: true, reserved: true },
    });

    let totalOnHand = 0;
    let totalReserved = 0;

    for (const sl of stockLevels) {
      totalOnHand += Number(sl.quantity_on_hand);
      totalReserved += Number(sl.reserved);
    }

    if (totalReserved > 0) {
      throw new AppError(
        'BRANCH_HAS_RESERVED_STOCK',
        `Cannot archive branch with ${totalReserved} active reserved units. Fulfill or cancel pending orders first.`,
        400,
        { totalReserved }
      );
    }

    if (totalOnHand > 0 && !options.confirmWithStock) {
      throw new AppError(
        'BRANCH_HAS_STOCK',
        `Branch has ${totalOnHand} units on hand. Explicit confirmation required to archive.`,
        400,
        { totalOnHand }
      );
    }

    if (totalOnHand > 0 && options.confirmWithStock && !options.reason?.trim()) {
      throw new AppError(
        'VALIDATION_ERROR',
        'A reason is required when archiving a branch with stock on hand.',
        400
      );
    }

    await this.db.branch.update({
      where: { id: branchId },
      data: {
        is_deleted: true,
        deleted_at: new Date(),
        deleted_by_user_id: options.userId ?? null,
        deleted_reason: options.reason?.trim() ?? null,
      },
    });

    this.invalidateCache(orgId);
    return { success: true };
  }

  async restoreBranch(orgId: string, branchId: string): Promise<{ success: true }> {
    const branch = await this.db.branch.findFirst({
      where: { id: branchId, org_id: orgId, is_deleted: true },
    });

    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', 'Branch not found or is not archived', 404);
    }

    // Check name conflict with currently active branches
    const nameConflict = await this.db.branch.findFirst({
      where: {
        org_id: orgId,
        name: { equals: branch.name, mode: 'insensitive' },
        is_deleted: false,
      },
    });

    if (nameConflict) {
      throw new AppError(
        'DUPLICATE_BRANCH_NAME',
        `Cannot restore branch: an active branch named "${branch.name}" already exists.`,
        400
      );
    }

    await this.db.branch.update({
      where: { id: branchId },
      data: {
        is_deleted: false,
        deleted_at: null,
        deleted_by_user_id: null,
        deleted_reason: null,
      },
    });

    this.invalidateCache(orgId);
    return { success: true };
  }
}

export const branchService = new BranchService();
