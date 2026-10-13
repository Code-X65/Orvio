import type { PrismaClient, Brand, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { AppError } from '../../lib/errors.js';
import { inventoryCache } from '../../infrastructure/cache/in-memory-cache.js';
import { eventBus, type RealtimeEventType } from '../../infrastructure/websocket/event-bus.js';
import type {
  CreateBrandInput,
  UpdateBrandInput,
  DeleteBrandInput,
  ListBrandsQueryInput,
} from './brands-schemas.js';

export function slugifyBrandName(name: string): string {
  const slug = name
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  return slug || 'brand';
}

export interface BrandWithCount extends Brand {
  product_count: number;
}

export class BrandService {
  constructor(private db: PrismaClient = defaultPrisma) {}

  private invalidateCache(orgId: string, event?: { type: RealtimeEventType; payload: Record<string, unknown> }): void {
    inventoryCache.clearPrefix(`brands_list:${orgId}`);
    inventoryCache.clearPrefix(`brand:${orgId}`);
    inventoryCache.clearPrefix(`products_list:${orgId}`);
    inventoryCache.clearPrefix(`products_detail:${orgId}`);
    if (event) {
      eventBus.broadcastToOrg(orgId, event);
    }
  }

  async resolveBranchId(orgId: string, branchId?: string): Promise<string> {
    if (branchId) {
      const branch = await this.db.branch.findFirst({
        where: { id: branchId, org_id: orgId, is_deleted: false },
        select: { id: true },
      });
      if (!branch) {
        throw new AppError('BRANCH_NOT_FOUND', 'Branch not found in this organization', 404);
      }
      return branch.id;
    }

    const primary = await this.db.branch.findFirst({
      where: { org_id: orgId, is_deleted: false },
      orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
      select: { id: true },
    });
    if (!primary) {
      throw new AppError('BRANCH_NOT_FOUND', 'No active branch found in this organization', 404);
    }
    return primary.id;
  }

  async resolveUniqueSlug(
    orgId: string,
    branchId: string,
    baseSlug: string,
    prismaClient: PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0] = this.db,
    excludeId?: string
  ): Promise<string> {
    let candidate = baseSlug || 'brand';
    let counter = 1;

    while (true) {
      const existing = await (prismaClient as PrismaClient).brand.findFirst({
        where: {
          org_id: orgId,
          branch_id: branchId,
          slug: candidate,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }

      counter += 1;
      candidate = `${baseSlug}-${counter}`;
    }
  }

  async listBrands(
    orgId: string,
    query: ListBrandsQueryInput
  ): Promise<{ brands: BrandWithCount[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const targetBranchId = await this.resolveBranchId(orgId, query.branchId);
    const where: Prisma.BrandWhereInput = {
      org_id: orgId,
      branch_id: targetBranchId,
      ...(query.includeDeleted ? {} : { is_deleted: false }),
      ...(query.activeOnly ? { is_active: true } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const [total, rawBrands] = await Promise.all([
      this.db.brand.count({ where }),
      this.db.brand.findMany({
        where,
        include: {
          _count: {
            select: {
              products: {
                where: { is_deleted: false },
              },
            },
          },
        },
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
        skip,
        take: query.limit,
      }),
    ]);

    const brands: BrandWithCount[] = rawBrands.map((b) => {
      const { _count, ...rest } = b;
      return {
        ...rest,
        product_count: _count.products,
      };
    });

    return {
      brands,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async getBrand(orgId: string, brandId: string): Promise<BrandWithCount> {
    const raw = await this.db.brand.findFirst({
      where: {
        id: brandId,
        org_id: orgId,
      },
      include: {
        _count: {
          select: {
            products: {
              where: { is_deleted: false },
            },
          },
        },
      },
    });

    if (!raw) {
      throw new AppError('BRAND_NOT_FOUND', 'Brand not found', 404);
    }

    const { _count, ...brand } = raw;
    return {
      ...brand,
      product_count: _count.products,
    };
  }

  async createBrand(orgId: string, input: CreateBrandInput): Promise<Brand> {
    const targetBranchId = await this.resolveBranchId(orgId, input.branchId);
    const rawSlug = input.slug?.trim() ? slugifyBrandName(input.slug) : slugifyBrandName(input.name);
    const slug = await this.resolveUniqueSlug(orgId, targetBranchId, rawSlug);

    const brand = await this.db.brand.create({
      data: {
        org_id: orgId,
        branch_id: targetBranchId,
        name: input.name,
        slug,
        description: input.description ?? null,
        logo_url: input.logoUrl ?? null,
        website_url: input.websiteUrl ?? null,
        is_active: input.isActive ?? true,
        sort_order: input.sortOrder ?? 0,
        metadata: (input.metadata as any) ?? undefined,
      },
    });

    this.invalidateCache(orgId, { type: 'brand:created', payload: { id: brand.id, branchId: targetBranchId } });
    return brand;
  }

  async updateBrand(orgId: string, brandId: string, input: UpdateBrandInput): Promise<Brand> {
    const existing = await this.db.brand.findFirst({
      where: { id: brandId, org_id: orgId },
    });

    if (!existing) {
      throw new AppError('BRAND_NOT_FOUND', 'Brand not found', 404);
    }

    let slug = existing.slug;
    if (input.slug !== undefined && input.slug.trim()) {
      const candidateSlug = slugifyBrandName(input.slug);
      if (candidateSlug !== existing.slug) {
        slug = await this.resolveUniqueSlug(orgId, existing.branch_id, candidateSlug, this.db, brandId);
      }
    } else if (input.name && input.name !== existing.name && !input.slug) {
      // Keep existing slug unless explicitly changed or if slug is empty
    }

    const updated = await this.db.brand.update({
      where: { id: brandId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(slug !== existing.slug ? { slug } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.logoUrl !== undefined ? { logo_url: input.logoUrl ?? null } : {}),
        ...(input.websiteUrl !== undefined ? { website_url: input.websiteUrl ?? null } : {}),
        ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
        ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
        ...(input.metadata !== undefined
          ? { metadata: (input.metadata as any) ?? undefined }
          : {}),
      },
    });

    this.invalidateCache(orgId, { type: 'brand:updated', payload: { id: brandId, branchId: existing.branch_id } });
    return updated;
  }

  async deleteBrand(
    orgId: string,
    brandId: string,
    userId: string,
    options?: DeleteBrandInput
  ): Promise<{ success: boolean; reassignedCount: number }> {
    const existing = await this.db.brand.findFirst({
      where: { id: brandId, org_id: orgId, is_deleted: false },
    });

    if (!existing) {
      throw new AppError('BRAND_NOT_FOUND', 'Brand not found', 404);
    }

    let reassignedCount = 0;

    await this.db.$transaction(async (tx) => {
      if (options?.reassignToBrandId) {
        if (options.reassignToBrandId === brandId) {
          throw new AppError('BRAND_NOT_FOUND', 'Cannot reassign products to the brand being deleted', 400);
        }

        const targetBrand = await tx.brand.findFirst({
          where: { id: options.reassignToBrandId, org_id: orgId, branch_id: existing.branch_id, is_deleted: false },
        });

        if (!targetBrand) {
          throw new AppError('BRAND_NOT_FOUND', 'Target reassignment brand not found in this branch', 404);
        }

        const updateRes = await tx.product.updateMany({
          where: { org_id: orgId, brand_id: brandId },
          data: { brand_id: options.reassignToBrandId },
        });

        reassignedCount = updateRes.count;
      }

      await tx.brand.update({
        where: { id: brandId },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
          deleted_by_user_id: userId,
          deleted_reason: options?.reason ?? null,
        },
      });
    });

    this.invalidateCache(orgId, { type: 'brand:deleted', payload: { id: brandId } });
    return { success: true, reassignedCount };
  }

  async restoreBrand(orgId: string, brandId: string): Promise<Brand> {
    const existing = await this.db.brand.findFirst({
      where: { id: brandId, org_id: orgId, is_deleted: true },
    });

    if (!existing) {
      throw new AppError('BRAND_NOT_FOUND', 'Deleted brand not found', 404);
    }

    const restored = await this.db.brand.update({
      where: { id: brandId },
      data: {
        is_deleted: false,
        deleted_at: null,
        deleted_by_user_id: null,
        deleted_reason: null,
      },
    });

    this.invalidateCache(orgId, { type: 'brand:updated', payload: { id: brandId, restored: true } });
    return restored;
  }

  async listBrandProducts(
    orgId: string,
    brandId: string,
    page = 1,
    limit = 20
  ): Promise<{ products: Array<{ id: string; name: string; sku: string; selling_price: number; image_url: string | null }>; total: number }> {
    const brand = await this.db.brand.findFirst({
      where: { id: brandId, org_id: orgId },
    });

    if (!brand) {
      throw new AppError('BRAND_NOT_FOUND', 'Brand not found', 404);
    }

    const where = {
      org_id: orgId,
      brand_id: brandId,
      is_deleted: false,
    };

    const skip = (page - 1) * limit;

    const [total, rawProducts] = await Promise.all([
      this.db.product.count({ where }),
      this.db.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          sku: true,
          selling_price: true,
          image_url: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      products: rawProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        selling_price: Number(p.selling_price),
        image_url: p.image_url,
      })),
    };
  }
}
