import type { PrismaClient, Product, ProductVariant, ProductImage, measurement_unit } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { AppError } from '../../lib/errors.js';
import { inventoryCache } from '../../infrastructure/cache/in-memory-cache.js';
import { imageUploadService } from './image-upload-service.js';
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
  ListProductsQueryInput,
  SearchProductsQueryInput,
  DeleteProductInput,
  UpdateProductImageInput,
  ReorderProductImagesInput,
} from './products-schemas.js';

export const BUSINESS_TYPE_IMAGE_LIMITS: Record<string, number> = {
  retail_supermarket: 3,
  wholesale_distribution: 2,
  fashion_boutique: 5,
  electronics_tech: 5,
  pharmacy_cosmetics: 3,
  food_grocery: 3,
  manufacturing_other: 2,
  services_other: 1,
};

export const DEFAULT_MAX_IMAGES = 5;

export interface ProductUsageSummary {
  totalOnHand: number;
  totalReserved: number;
  variantCount: number;
  hasReservedStock: boolean;
  canDelete: boolean;
  branchStock: Array<{
    branchId: string;
    branchName: string;
    onHand: number;
    reserved: number;
  }>;
}

export interface ProductListItem {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  category_name: string | null;
  description: string | null;
  cost_price: number;
  selling_price: number;
  compare_at_price: number | null;
  unit_of_measure: measurement_unit;
  track_quantity: boolean;
  low_stock_threshold: number;
  has_variants: boolean;
  variants_count: number;
  is_active: boolean;
  is_deleted?: boolean;
  image_url: string | null;
  primary_image_url?: string | null;
  metadata: unknown;
  business_type: string | null;
  total_stock: number;
  reserved_stock: number;
  available_stock: number;
  created_at: Date;
  updated_at: Date;
}

export interface BranchStockItem {
  branch_id: string;
  branch_name: string;
  quantity_on_hand: number;
  reserved: number;
  available: number;
}

export interface ProductDetailResponse {
  product: Product & {
    category_name: string | null;
    variants: ProductVariant[];
    images: ProductImage[];
    stock_levels: BranchStockItem[];
    total_stock: number;
    reserved_stock: number;
    available_stock: number;
  };
}

export class ProductService {
  constructor(private db: PrismaClient = defaultPrisma) {}

  private invalidateCache(orgId: string): void {
    inventoryCache.clearPrefix(`products_list:${orgId}`);
    inventoryCache.clearPrefix(`products_detail:${orgId}`);
    inventoryCache.clearPrefix(`products_search:${orgId}`);
    // Invalidate category cache so category tree and product counts remain consistent
    inventoryCache.clearPrefix(`categories_tree:${orgId}`);
  }

  async generateUniqueSku(orgId: string, name: string): Promise<string> {
    const cleanName = name
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .trim();
    const words = cleanName.split(/\s+/).filter(Boolean);

    let basePrefix = 'PRD';
    if (words.length >= 2) {
      basePrefix = words.map((w) => w[0]).join('').slice(0, 4);
    } else if (words.length === 1) {
      basePrefix = words[0].slice(0, 4);
    }
    if (basePrefix.length < 2) basePrefix = 'PRD';

    let counter = 1;
    while (true) {
      const candidate = `${basePrefix}-${counter.toString().padStart(3, '0')}`;
      const existing = await this.db.product.findFirst({
        where: { org_id: orgId, sku: candidate },
        select: { id: true },
      });
      const existingVariant = await this.db.productVariant.findFirst({
        where: { org_id: orgId, sku: candidate },
        select: { id: true },
      });
      if (!existing && !existingVariant) {
        return candidate;
      }
      counter++;
    }
  }

  async createProduct(orgId: string, input: CreateProductInput): Promise<Product> {
    // 1. Resolve SKU
    let sku = input.sku?.trim().toUpperCase();
    if (!sku) {
      sku = await this.generateUniqueSku(orgId, input.name);
    } else {
      const existing = await this.db.product.findFirst({
        where: { org_id: orgId, sku: { equals: sku, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) {
        throw new AppError('PRODUCT_SKU_DUPLICATE', `SKU "${sku}" already exists in this organization`, 409, {
          field: 'sku',
        });
      }
    }

    // 2. Validate Barcode if provided
    const barcode = input.barcode?.trim() || null;
    if (barcode) {
      const existingBarcode = await this.db.product.findFirst({
        where: { org_id: orgId, barcode },
        select: { id: true },
      });
      if (existingBarcode) {
        throw new AppError(
          'PRODUCT_BARCODE_DUPLICATE',
          `Barcode "${barcode}" already exists in this organization`,
          409,
          { field: 'barcode' }
        );
      }
    }

    // 3. Validate Category if provided
    if (input.categoryId) {
      const category = await this.db.category.findFirst({
        where: { id: input.categoryId, org_id: orgId },
        select: { id: true },
      });
      if (!category) {
        throw new AppError('CATEGORY_NOT_FOUND', 'Category not found in this organization', 404);
      }
    }

    // 4. Validate Selling Price >= Cost Price
    if (input.sellingPrice < input.costPrice) {
      throw new AppError(
        'PRODUCT_PRICE_INVALID',
        'Selling price must not be less than cost price (no loss sales permitted)',
        400
      );
    }

    // 5. Retrieve org business_type for snapshot
    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      select: { business_type: true },
    });

    const product = await this.db.product.create({
      data: {
        org_id: orgId,
        category_id: input.categoryId || null,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        sku,
        barcode,
        cost_price: new Decimal(input.costPrice),
        selling_price: new Decimal(input.sellingPrice),
        compare_at_price:
          input.compareAtPrice !== undefined && input.compareAtPrice !== null
            ? new Decimal(input.compareAtPrice)
            : null,
        unit_of_measure: input.unitOfMeasure,
        track_quantity: input.trackQuantity,
        low_stock_threshold: input.lowStockThreshold,
        has_variants: input.hasVariants,
        is_active: input.isActive ?? true,
        image_url: input.imageUrl?.trim() || null,
        business_type: org?.business_type || null,
        metadata: (input.metadata as any) ?? undefined,
      },
    });

    // 5. Initial stock seeding (if track_quantity and initialStock > 0)
    if (input.trackQuantity && input.initialStock && input.initialStock > 0) {
      let branchId = input.branchId;
      if (!branchId) {
        const primaryBranch = await this.db.branch.findFirst({
          where: { org_id: orgId, is_primary: true, is_deleted: false },
          select: { id: true },
        });
        branchId = primaryBranch?.id;
      }

      if (branchId) {
        await this.db.stockLevel.upsert({
          where: {
            org_id_product_id_branch_id: {
              org_id: orgId,
              product_id: product.id,
              branch_id: branchId,
            },
          },
          create: {
            org_id: orgId,
            product_id: product.id,
            branch_id: branchId,
            quantity_on_hand: new Decimal(input.initialStock),
            reserved: new Decimal(0),
          },
          update: {
            quantity_on_hand: new Decimal(input.initialStock),
          },
        });
      }
    }

    this.invalidateCache(orgId);
    return product;
  }

  async listProducts(
    orgId: string,
    query: ListProductsQueryInput
  ): Promise<{ products: ProductListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const activeOnly = query.activeOnly ?? true;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const cacheKey = `products_list:${orgId}:${JSON.stringify(query)}`;

    return await inventoryCache.fetchOrCompute(
      cacheKey,
      async () => {
        const whereClause: any = {
          org_id: orgId,
        };

        if (query.status === 'archived') {
          whereClause.is_deleted = true;
        } else if (query.status === 'active') {
          whereClause.is_deleted = false;
          whereClause.is_active = true;
        } else if (query.status === 'inactive') {
          whereClause.is_deleted = false;
          whereClause.is_active = false;
        } else if (query.status === 'all') {
          whereClause.is_deleted = false;
        } else {
          whereClause.is_deleted = false;
          if (activeOnly) {
            whereClause.is_active = true;
          }
        }

        if (query.categoryId) {
          // Resolve target category + all its recursive child category IDs
          const allCategories = await this.db.category.findMany({
            where: { org_id: orgId, is_deleted: false },
            select: { id: true, parent_id: true },
          });
          const catIds = new Set<string>([query.categoryId]);
          let added = true;
          while (added) {
            added = false;
            for (const cat of allCategories) {
              if (cat.parent_id && catIds.has(cat.parent_id) && !catIds.has(cat.id)) {
                catIds.add(cat.id);
                added = true;
              }
            }
          }
          whereClause.category_id = { in: Array.from(catIds) };
        }

        if (query.trackQuantity !== undefined) {
          whereClause.track_quantity = query.trackQuantity;
        }

        if (query.search?.trim()) {
          const s = query.search.trim();
          whereClause.OR = [
            { name: { contains: s, mode: 'insensitive' } },
            { sku: { contains: s, mode: 'insensitive' } },
            { barcode: { contains: s, mode: 'insensitive' } },
            { description: { contains: s, mode: 'insensitive' } },
          ];
        }

        // Fetch products with counts and stock
        const [totalCount, rawProducts] = await Promise.all([
          this.db.product.count({ where: whereClause }),
          this.db.product.findMany({
            where: whereClause,
            include: {
              category: { select: { id: true, name: true } },
              variants: { select: { id: true } },
              images: {
                where: { variant_id: null },
                orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
                take: 1,
              },
              stock_levels: {
                select: {
                  quantity_on_hand: true,
                  reserved: true,
                  branch_id: true,
                },
                ...(query.branchId ? { where: { branch_id: query.branchId } } : {}),
              },
            },
            orderBy: {
              [query.sortBy]: query.sortOrder,
            },
            skip,
            take: limit,
          }),
        ]);

        let items: ProductListItem[] = rawProducts.map((p) => {
          let totalStock = 0;
          let reservedStock = 0;

          for (const sl of p.stock_levels) {
            totalStock += Number(sl.quantity_on_hand);
            reservedStock += Number(sl.reserved);
          }

          const availableStock = totalStock - reservedStock;
          const primaryImage = p.images?.[0]?.thumbnail_200 || p.images?.[0]?.url || p.image_url;

          return {
            id: p.id,
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            category_id: p.category_id,
            category_name: p.category?.name ?? null,
            description: p.description,
            cost_price: Number(p.cost_price),
            selling_price: Number(p.selling_price),
            compare_at_price: p.compare_at_price ? Number(p.compare_at_price) : null,
            unit_of_measure: p.unit_of_measure,
            track_quantity: p.track_quantity,
            low_stock_threshold: p.low_stock_threshold,
            has_variants: p.has_variants,
            variants_count: p.variants.length,
            is_active: p.is_active,
            is_deleted: p.is_deleted,
            image_url: primaryImage,
            primary_image_url: primaryImage,
            metadata: p.metadata,
            business_type: p.business_type,
            total_stock: totalStock,
            reserved_stock: reservedStock,
            available_stock: availableStock,
            created_at: p.created_at,
            updated_at: p.updated_at,
          };
        });

        if (query.lowStock) {
          items = items.filter(
            (p) => p.track_quantity && p.available_stock <= p.low_stock_threshold
          );
        }

        return {
          products: items,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit) || 1,
          },
        };
      },
      30_000
    );
  }

  async getProductById(orgId: string, productId: string): Promise<ProductDetailResponse> {
    const cacheKey = `products_detail:${orgId}:${productId}`;

    return await inventoryCache.fetchOrCompute(
      cacheKey,
      async () => {
        const product = await this.db.product.findFirst({
          where: { id: productId, org_id: orgId, is_deleted: false },
          include: {
            category: { select: { name: true } },
            variants: {
              where: { is_deleted: false },
              orderBy: { created_at: 'asc' },
            },
            images: {
              orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
            },
            stock_levels: {
              include: {
                branch: { select: { id: true, name: true } },
              },
            },
          },
        });

        if (!product) {
          throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
        }

        let totalStock = 0;
        let reservedStock = 0;
        const branchStocks: BranchStockItem[] = [];

        for (const sl of product.stock_levels) {
          const qty = Number(sl.quantity_on_hand);
          const res = Number(sl.reserved);
          totalStock += qty;
          reservedStock += res;
          branchStocks.push({
            branch_id: sl.branch_id,
            branch_name: sl.branch.name,
            quantity_on_hand: qty,
            reserved: res,
            available: qty - res,
          });
        }

        return {
          product: {
            ...product,
            category_name: product.category?.name ?? null,
            variants: product.variants,
            images: product.images,
            stock_levels: branchStocks as any,
            total_stock: totalStock,
            reserved_stock: reservedStock,
            available_stock: totalStock - reservedStock,
          },
        };
      },
      30_000
    );
  }

  async updateProduct(orgId: string, productId: string, input: UpdateProductInput): Promise<Product> {
    const existing = await this.db.product.findFirst({
      where: { id: productId, org_id: orgId, is_deleted: false },
    });

    if (!existing) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    // SKU uniqueness check if changed
    let sku = existing.sku;
    if (input.sku !== undefined && input.sku.trim()) {
      const newSku = input.sku.trim().toUpperCase();
      if (newSku !== existing.sku) {
        const duplicate = await this.db.product.findFirst({
          where: {
            org_id: orgId,
            sku: { equals: newSku, mode: 'insensitive' },
            id: { not: productId },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new AppError('PRODUCT_SKU_DUPLICATE', `SKU "${newSku}" already exists in this organization`, 409, {
            field: 'sku',
          });
        }
        sku = newSku;
      }
    }

    // Barcode uniqueness check if changed
    let barcode = existing.barcode;
    if (input.barcode !== undefined) {
      const newBarcode = input.barcode?.trim() || null;
      if (newBarcode && newBarcode !== existing.barcode) {
        const duplicateBarcode = await this.db.product.findFirst({
          where: {
            org_id: orgId,
            barcode: newBarcode,
            id: { not: productId },
          },
          select: { id: true },
        });
        if (duplicateBarcode) {
          throw new AppError('PRODUCT_BARCODE_DUPLICATE', `Barcode "${newBarcode}" already exists`, 409, {
            field: 'barcode',
          });
        }
      }
      barcode = newBarcode;
    }

    // Category validation if changed
    if (input.categoryId !== undefined && input.categoryId !== null) {
      const category = await this.db.category.findFirst({
        where: { id: input.categoryId, org_id: orgId },
        select: { id: true },
      });
      if (!category) {
        throw new AppError('CATEGORY_NOT_FOUND', 'Category not found in this organization', 404);
      }
    }

    // Price validation: Selling price must not be less than cost price
    const newCost = input.costPrice !== undefined ? input.costPrice : Number(existing.cost_price);
    const newSelling = input.sellingPrice !== undefined ? input.sellingPrice : Number(existing.selling_price);
    if (newSelling < newCost) {
      throw new AppError(
        'PRODUCT_PRICE_INVALID',
        'Selling price must not be less than cost price (no loss sales permitted)',
        400
      );
    }

    const oldCost = Number(existing.cost_price);
    const oldSelling = Number(existing.selling_price);
    const costChanged = input.costPrice !== undefined && input.costPrice !== oldCost;
    const sellingChanged = input.sellingPrice !== undefined && input.sellingPrice !== oldSelling;

    if (costChanged || sellingChanged) {
      await this.db.productPriceHistory.create({
        data: {
          org_id: orgId,
          product_id: productId,
          old_cost_price: existing.cost_price,
          new_cost_price: new Decimal(newCost),
          old_selling_price: existing.selling_price,
          new_selling_price: new Decimal(newSelling),
          reason: input.priceChangeReason?.trim() || null,
          changed_by_user_id: (input as any).userId || null,
        },
      });
    }

    const updateData: any = {
      sku,
      barcode,
    };
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.description !== undefined) updateData.description = input.description?.trim() || null;
    if (input.categoryId !== undefined) updateData.category_id = input.categoryId || null;
    if (input.costPrice !== undefined) updateData.cost_price = new Decimal(input.costPrice);
    if (input.sellingPrice !== undefined) updateData.selling_price = new Decimal(input.sellingPrice);
    if (input.compareAtPrice !== undefined) {
      updateData.compare_at_price = input.compareAtPrice !== null ? new Decimal(input.compareAtPrice) : null;
    }
    if (input.unitOfMeasure !== undefined) updateData.unit_of_measure = input.unitOfMeasure;
    if (input.trackQuantity !== undefined) updateData.track_quantity = input.trackQuantity;
    if (input.lowStockThreshold !== undefined) updateData.low_stock_threshold = input.lowStockThreshold;
    if (input.hasVariants !== undefined) updateData.has_variants = input.hasVariants;
    if (input.isActive !== undefined) updateData.is_active = input.isActive;
    if (input.imageUrl !== undefined) updateData.image_url = input.imageUrl?.trim() || null;
    if (input.metadata !== undefined) updateData.metadata = (input.metadata as any) ?? undefined;

    const updated = await this.db.product.update({
      where: { id: productId },
      data: updateData,
    });

    this.invalidateCache(orgId);
    return updated;
  }

  async getPriceHistory(orgId: string, productId: string) {
    const product = await this.db.product.findFirst({
      where: { id: productId, org_id: orgId, is_deleted: false },
      select: { id: true },
    });

    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    return await this.db.productPriceHistory.findMany({
      where: { org_id: orgId, product_id: productId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  async getProductUsage(orgId: string, productId: string): Promise<ProductUsageSummary> {
    const existing = await this.db.product.findFirst({
      where: { id: productId, org_id: orgId, is_deleted: false },
    });

    if (!existing) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    const variants = await this.db.productVariant.findMany({
      where: { product_id: productId, org_id: orgId },
      select: { id: true },
    });
    const variantIds = variants.map((v) => v.id);

    const stockLevels = await this.db.stockLevel.findMany({
      where: {
        org_id: orgId,
        OR: [
          { product_id: productId },
          ...(variantIds.length > 0 ? [{ variant_id: { in: variantIds } }] : []),
        ],
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    let totalOnHand = 0;
    let totalReserved = 0;
    const branchMap = new Map<string, { branchId: string; branchName: string; onHand: number; reserved: number }>();

    for (const sl of stockLevels) {
      const onHand = Number(sl.quantity_on_hand);
      const reserved = Number(sl.reserved);
      totalOnHand += onHand;
      totalReserved += reserved;

      const branchId = sl.branch_id;
      const branchName = sl.branch?.name ?? 'Branch';
      const existingBranch = branchMap.get(branchId);
      if (existingBranch) {
        existingBranch.onHand += onHand;
        existingBranch.reserved += reserved;
      } else {
        branchMap.set(branchId, {
          branchId,
          branchName,
          onHand,
          reserved,
        });
      }
    }

    const branchStock = Array.from(branchMap.values());
    const hasReservedStock = totalReserved > 0;
    const canDelete = !hasReservedStock;

    return {
      totalOnHand,
      totalReserved,
      variantCount: variants.length,
      hasReservedStock,
      canDelete,
      branchStock,
    };
  }

  async deleteProduct(
    orgId: string,
    productId: string,
    options: { userId?: string; reason?: string; confirmWithStock?: boolean } = {}
  ): Promise<{ success: true }> {
    const existing = await this.db.product.findFirst({
      where: { id: productId, org_id: orgId, is_deleted: false },
    });

    if (!existing) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    const usage = await this.getProductUsage(orgId, productId);

    if (usage.hasReservedStock) {
      throw new AppError(
        'PRODUCT_HAS_RESERVED_STOCK',
        `Cannot archive product with ${usage.totalReserved} active reserved units. Fulfill or cancel pending orders first.`,
        400,
        { usage }
      );
    }

    if (usage.totalOnHand > 0 && !options.confirmWithStock) {
      throw new AppError(
        'PRODUCT_HAS_STOCK',
        `Product has ${usage.totalOnHand} units on hand across branches. Explicit confirmation required to archive.`,
        400,
        { usage }
      );
    }

    if (usage.totalOnHand > 0 && options.confirmWithStock && !options.reason?.trim()) {
      throw new AppError(
        'VALIDATION_ERROR',
        'A reason is required when archiving a product with stock on hand.',
        400
      );
    }

    await this.db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          is_deleted: true,
          is_active: false,
          deleted_at: new Date(),
          deleted_by_user_id: options.userId ?? null,
          deleted_reason: options.reason?.trim() ?? null,
        },
      });

      await tx.productVariant.updateMany({
        where: { product_id: productId },
        data: { is_active: false },
      });

      await tx.auditLog.create({
        data: {
          org_id: orgId,
          user_id: options.userId ?? null,
          event: 'product_archived',
          status: 'success',
          metadata: {
            productId,
            productName: existing.name,
            totalOnHand: usage.totalOnHand,
            totalReserved: usage.totalReserved,
            variantCount: usage.variantCount,
            reason: options.reason?.trim() ?? null,
          },
        },
      });
    });

    this.invalidateCache(orgId);
    return { success: true };
  }

  async toggleProductStatus(orgId: string, productId: string): Promise<Product> {
    const existing = await this.db.product.findFirst({
      where: { id: productId, org_id: orgId, is_deleted: false },
    });

    if (!existing) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    const updated = await this.db.product.update({
      where: { id: productId },
      data: {
        is_active: !existing.is_active,
      },
    });

    this.invalidateCache(orgId);
    return updated;
  }

  async restoreProduct(orgId: string, productId: string, userId?: string): Promise<Product> {
    const existing = await this.db.product.findFirst({
      where: { id: productId, org_id: orgId, is_deleted: true },
    });

    if (!existing) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Archived product not found', 404);
    }

    const restored = await this.db.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id: productId },
        data: {
          is_deleted: false,
          is_active: true,
          deleted_at: null,
          deleted_by_user_id: null,
          deleted_reason: null,
        },
      });

      await tx.auditLog.create({
        data: {
          org_id: orgId,
          user_id: userId ?? null,
          event: 'product_restored',
          status: 'success',
          metadata: {
            productId,
            productName: existing.name,
          },
        },
      });

      return p;
    });

    this.invalidateCache(orgId);
    return restored;
  }

  async createVariant(orgId: string, productId: string, input: CreateVariantInput): Promise<ProductVariant> {
    const product = await this.db.product.findFirst({
      where: { id: productId, org_id: orgId, is_deleted: false },
    });

    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    if (!product.has_variants) {
      throw new AppError('VALIDATION_ERROR', 'Product does not have variants enabled', 400);
    }

    let sku = input.sku?.trim().toUpperCase();
    if (!sku) {
      const attrPart = Object.values(input.attributes).join('-').toUpperCase().replace(/[^A-Z0-9-]/g, '');
      sku = `${product.sku}-${attrPart}`;
    }

    const existingSku = await this.db.productVariant.findFirst({
      where: { org_id: orgId, sku: { equals: sku, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existingSku) {
      throw new AppError('PRODUCT_SKU_DUPLICATE', `Variant SKU "${sku}" already exists in this organization`, 409, {
        field: 'sku',
      });
    }

    const barcode = input.barcode?.trim() || null;
    if (barcode) {
      const existingBarcode = await this.db.productVariant.findFirst({
        where: { org_id: orgId, barcode },
        select: { id: true },
      });
      if (existingBarcode) {
        throw new AppError('PRODUCT_BARCODE_DUPLICATE', `Barcode "${barcode}" already exists`, 409, {
          field: 'barcode',
        });
      }
    }

    if (input.sellingPrice < input.costPrice) {
      throw new AppError(
        'PRODUCT_PRICE_INVALID',
        'Selling price must not be less than cost price (no loss sales permitted)',
        400
      );
    }

    const variant = await this.db.productVariant.create({
      data: {
        org_id: orgId,
        product_id: productId,
        sku,
        barcode,
        cost_price: new Decimal(input.costPrice),
        selling_price: new Decimal(input.sellingPrice),
        compare_at_price:
          input.compareAtPrice !== undefined && input.compareAtPrice !== null
            ? new Decimal(input.compareAtPrice)
            : null,
        attributes: input.attributes,
        is_active: input.isActive ?? true,
      },
    });

    // Initial stock for variant
    if (input.initialStock && input.initialStock > 0) {
      let branchId = input.branchId;
      if (!branchId) {
        const primaryBranch = await this.db.branch.findFirst({
          where: { org_id: orgId, is_primary: true, is_deleted: false },
          select: { id: true },
        });
        branchId = primaryBranch?.id;
      }

      if (branchId) {
        await this.db.stockLevel.upsert({
          where: {
            org_id_variant_id_branch_id: {
              org_id: orgId,
              variant_id: variant.id,
              branch_id: branchId,
            },
          },
          create: {
            org_id: orgId,
            variant_id: variant.id,
            branch_id: branchId,
            quantity_on_hand: new Decimal(input.initialStock),
            reserved: new Decimal(0),
          },
          update: {
            quantity_on_hand: new Decimal(input.initialStock),
          },
        });
      }
    }

    this.invalidateCache(orgId);
    return variant;
  }

  async updateVariant(
    orgId: string,
    productId: string,
    variantId: string,
    input: UpdateVariantInput,
    userId?: string
  ): Promise<ProductVariant> {
    const existing = await this.db.productVariant.findFirst({
      where: { id: variantId, product_id: productId, org_id: orgId, is_deleted: false },
    });

    if (!existing) {
      throw new AppError('VARIANT_NOT_FOUND', 'Variant not found', 404);
    }

    let sku = existing.sku;
    if (input.sku && input.sku.trim().toUpperCase() !== existing.sku) {
      sku = input.sku.trim().toUpperCase();
      const existingSku = await this.db.productVariant.findFirst({
        where: { org_id: orgId, sku: { equals: sku, mode: 'insensitive' }, id: { not: variantId } },
        select: { id: true },
      });
      if (existingSku) {
        throw new AppError('PRODUCT_SKU_DUPLICATE', `Variant SKU "${sku}" already exists in this organization`, 409, {
          field: 'sku',
        });
      }
    }

    let barcode = existing.barcode;
    if (input.barcode !== undefined) {
      barcode = input.barcode?.trim() || null;
      if (barcode && barcode !== existing.barcode) {
        const existingBarcode = await this.db.productVariant.findFirst({
          where: { org_id: orgId, barcode, id: { not: variantId } },
          select: { id: true },
        });
        if (existingBarcode) {
          throw new AppError('PRODUCT_BARCODE_DUPLICATE', `Barcode "${barcode}" already exists`, 409, {
            field: 'barcode',
          });
        }
      }
    }

    const nextCost = input.costPrice !== undefined ? input.costPrice : Number(existing.cost_price);
    const nextSelling = input.sellingPrice !== undefined ? input.sellingPrice : Number(existing.selling_price);

    if (nextSelling < nextCost) {
      throw new AppError(
        'PRODUCT_PRICE_INVALID',
        'Selling price must not be less than cost price (no loss sales permitted)',
        400
      );
    }

    const priceChanged =
      (input.costPrice !== undefined && input.costPrice !== Number(existing.cost_price)) ||
      (input.sellingPrice !== undefined && input.sellingPrice !== Number(existing.selling_price));

    const updated = await this.db.$transaction(async (tx) => {
      if (priceChanged) {
        await tx.productPriceHistory.create({
          data: {
            org_id: orgId,
            product_id: productId,
            variant_id: variantId,
            old_cost_price: existing.cost_price,
            new_cost_price: new Decimal(nextCost),
            old_selling_price: existing.selling_price,
            new_selling_price: new Decimal(nextSelling),
            reason: input.priceChangeReason?.trim() || null,
            changed_by_user_id: userId || null,
          },
        });
      }

      const updateData: any = {
        sku,
        barcode,
      };
      if (input.costPrice !== undefined) updateData.cost_price = new Decimal(input.costPrice);
      if (input.sellingPrice !== undefined) updateData.selling_price = new Decimal(input.sellingPrice);
      if (input.compareAtPrice !== undefined) {
        updateData.compare_at_price = input.compareAtPrice !== null ? new Decimal(input.compareAtPrice) : null;
      }
      if (input.attributes !== undefined) updateData.attributes = input.attributes;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;

      return await tx.productVariant.update({
        where: { id: variantId },
        data: updateData,
      });
    });

    this.invalidateCache(orgId);
    return updated;
  }

  async deleteVariant(
    orgId: string,
    productId: string,
    variantId: string,
    options: { userId?: string; reason?: string; confirmWithStock?: boolean } = {}
  ): Promise<{ success: true }> {
    const existing = await this.db.productVariant.findFirst({
      where: { id: variantId, product_id: productId, org_id: orgId, is_deleted: false },
    });

    if (!existing) {
      throw new AppError('VARIANT_NOT_FOUND', 'Variant not found', 404);
    }

    const stockLevels = await this.db.stockLevel.findMany({
      where: { org_id: orgId, variant_id: variantId },
    });

    let totalOnHand = 0;
    let totalReserved = 0;
    for (const sl of stockLevels) {
      totalOnHand += Number(sl.quantity_on_hand);
      totalReserved += Number(sl.reserved);
    }

    if (totalReserved > 0) {
      throw new AppError(
        'PRODUCT_HAS_RESERVED_STOCK',
        `Cannot archive variant with ${totalReserved} active reserved units. Fulfill or cancel pending orders first.`,
        400
      );
    }

    if (totalOnHand > 0 && !options.confirmWithStock) {
      throw new AppError(
        'PRODUCT_HAS_STOCK',
        `Variant has ${totalOnHand} units on hand. Explicit confirmation required to archive.`,
        400
      );
    }

    if (totalOnHand > 0 && options.confirmWithStock && !options.reason?.trim()) {
      throw new AppError(
        'VALIDATION_ERROR',
        'A reason is required when archiving a variant with stock on hand.',
        400
      );
    }

    await this.db.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          is_deleted: true,
          is_active: false,
          deleted_at: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          org_id: orgId,
          user_id: options.userId ?? null,
          event: 'product_variant_archived',
          status: 'success',
          metadata: {
            productId,
            variantId,
            sku: existing.sku,
            totalOnHand,
            totalReserved,
            reason: options.reason?.trim() ?? null,
          },
        },
      });
    });

    this.invalidateCache(orgId);
    return { success: true };
  }

  async getVariantPriceHistory(orgId: string, productId: string, variantId: string) {
    const variant = await this.db.productVariant.findFirst({
      where: { id: variantId, product_id: productId, org_id: orgId },
      select: { id: true },
    });

    if (!variant) {
      throw new AppError('VARIANT_NOT_FOUND', 'Variant not found', 404);
    }

    return await this.db.productPriceHistory.findMany({
      where: { org_id: orgId, product_id: productId, variant_id: variantId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  async searchProducts(
    orgId: string,
    query: SearchProductsQueryInput
  ): Promise<Array<{ id: string; name: string; sku: string; barcode: string | null; selling_price: number; is_active: boolean; available_stock: number }>> {
    const q = query.q.trim();
    if (!q) return [];

    const products = await this.db.product.findMany({
      where: {
        org_id: orgId,
        is_deleted: false,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { barcode: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: {
        stock_levels: {
          select: {
            quantity_on_hand: true,
            reserved: true,
          },
          ...(query.branchId ? { where: { branch_id: query.branchId } } : {}),
        },
      },
      take: query.limit || 10,
    });

    return products.map((p) => {
      let total = 0;
      let reserved = 0;
      for (const sl of p.stock_levels) {
        total += Number(sl.quantity_on_hand);
        reserved += Number(sl.reserved);
      }
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        selling_price: Number(p.selling_price),
        is_active: p.is_active,
        available_stock: total - reserved,
      };
    });
  }

  async uploadProductImages(
    orgId: string,
    productId: string,
    files: Array<{ buffer: Buffer; filename?: string; mimeType: string }>,
    variantId?: string | null
  ): Promise<ProductImage[]> {
    if (!files.length) {
      throw new AppError('VALIDATION_ERROR', 'No image files provided for upload', 400);
    }

    const product = await this.db.product.findFirst({
      where: { id: productId, org_id: orgId, is_deleted: false },
    });
    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    if (variantId) {
      const variant = await this.db.productVariant.findFirst({
        where: { id: variantId, product_id: productId, org_id: orgId, is_deleted: false },
      });
      if (!variant) {
        throw new AppError('VARIANT_NOT_FOUND', 'Product variant not found', 404);
      }
    }

    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      select: { business_type: true },
    });

    const maxAllowed: number =
      (org?.business_type ? BUSINESS_TYPE_IMAGE_LIMITS[org.business_type] : undefined) ?? DEFAULT_MAX_IMAGES;

    const existingImages = await this.db.productImage.findMany({
      where: {
        org_id: orgId,
        product_id: productId,
        variant_id: variantId || null,
      },
      orderBy: { sort_order: 'asc' },
    });

    if (existingImages.length + files.length > maxAllowed) {
      throw new AppError(
        'IMAGE_COUNT_EXCEEDED',
        `Image count limit exceeded. Maximum ${maxAllowed} images allowed for this ${variantId ? 'variant' : 'product'}. Current count: ${existingImages.length}, attempting to add: ${files.length}.`,
        422,
        {
          maxAllowed,
          currentCount: existingImages.length,
          attemptedAddCount: files.length,
        }
      );
    }

    const hasPrimary = existingImages.some((img) => img.is_primary);
    let nextSortOrder =
      existingImages.length > 0 ? Math.max(...existingImages.map((img) => img.sort_order)) + 1 : 0;

    const createdImages: ProductImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPrimary = !hasPrimary && i === 0;

      const processed = await imageUploadService.processAndSaveProductImage({
        orgId,
        productId,
        fileBuffer: file.buffer,
        originalFilename: file.filename,
        mimeType: file.mimeType,
      });

      const imageRecord = await this.db.productImage.create({
        data: {
          org_id: orgId,
          product_id: productId,
          variant_id: variantId || null,
          url: processed.url,
          thumbnail_200: processed.thumbnail_200,
          thumbnail_400: processed.thumbnail_400,
          thumbnail_800: processed.thumbnail_800,
          thumbnail_1200: processed.thumbnail_1200,
          sort_order: nextSortOrder++,
          is_primary: isPrimary,
          file_size: processed.file_size,
          mime_type: processed.mime_type,
        },
      });

      if (isPrimary && !variantId) {
        await this.db.product.update({
          where: { id: productId },
          data: { image_url: processed.url },
        });
      }

      createdImages.push(imageRecord);
    }

    this.invalidateCache(orgId);
    return createdImages;
  }

  async listProductImages(orgId: string, productId: string): Promise<ProductImage[]> {
    const product = await this.db.product.findFirst({
      where: { id: productId, org_id: orgId, is_deleted: false },
    });
    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    return await this.db.productImage.findMany({
      where: { org_id: orgId, product_id: productId },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });
  }

  async listVariantImages(
    orgId: string,
    variantId: string
  ): Promise<{ images: ProductImage[]; isInherited: boolean }> {
    const variant = await this.db.productVariant.findFirst({
      where: { id: variantId, org_id: orgId, is_deleted: false },
      include: { product: true },
    });
    if (!variant) {
      throw new AppError('VARIANT_NOT_FOUND', 'Variant not found', 404);
    }

    const variantImages = await this.db.productImage.findMany({
      where: { org_id: orgId, variant_id: variantId },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });

    if (variantImages.length > 0) {
      return { images: variantImages, isInherited: false };
    }

    const parentImages = await this.db.productImage.findMany({
      where: { org_id: orgId, product_id: variant.product_id, variant_id: null },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });

    return { images: parentImages, isInherited: true };
  }

  async reorderProductImages(
    orgId: string,
    productId: string,
    items: Array<{ id: string; sortOrder: number; isPrimary?: boolean }>
  ): Promise<ProductImage[]> {
    const product = await this.db.product.findFirst({
      where: { id: productId, org_id: orgId, is_deleted: false },
    });
    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    const imageIds = items.map((it) => it.id);
    const existing = await this.db.productImage.findMany({
      where: { id: { in: imageIds }, org_id: orgId, product_id: productId },
    });
    if (existing.length !== imageIds.length) {
      throw new AppError('IMAGE_NOT_FOUND', 'One or more image IDs not found for this product', 404);
    }

    await this.db.$transaction(async (tx) => {
      for (const item of items) {
        await tx.productImage.update({
          where: { id: item.id },
          data: { sort_order: item.sortOrder },
        });

        if (item.isPrimary) {
          const target = existing.find((e) => e.id === item.id);
          if (target) {
            await tx.productImage.updateMany({
              where: {
                product_id: productId,
                variant_id: target.variant_id,
                id: { not: target.id },
              },
              data: { is_primary: false },
            });
            await tx.productImage.update({
              where: { id: target.id },
              data: { is_primary: true },
            });
            if (!target.variant_id) {
              await tx.product.update({
                where: { id: productId },
                data: { image_url: target.url },
              });
            }
          }
        }
      }
    });

    this.invalidateCache(orgId);

    return await this.db.productImage.findMany({
      where: { org_id: orgId, product_id: productId },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });
  }

  async updateProductImage(
    orgId: string,
    imageId: string,
    input: { altText?: string | null; isPrimary?: boolean }
  ): Promise<ProductImage> {
    const image = await this.db.productImage.findFirst({
      where: { id: imageId, org_id: orgId },
    });
    if (!image) {
      throw new AppError('IMAGE_NOT_FOUND', 'Image not found', 404);
    }

    return await this.db.$transaction(async (tx) => {
      if (input.isPrimary === true) {
        await tx.productImage.updateMany({
          where: {
            product_id: image.product_id,
            variant_id: image.variant_id,
            id: { not: image.id },
          },
          data: { is_primary: false },
        });

        if (!image.variant_id) {
          await tx.product.update({
            where: { id: image.product_id },
            data: { image_url: image.url },
          });
        }
      }

      const updated = await tx.productImage.update({
        where: { id: imageId },
        data: {
          ...(input.altText !== undefined ? { alt_text: input.altText } : {}),
          ...(input.isPrimary !== undefined ? { is_primary: input.isPrimary } : {}),
        },
      });

      this.invalidateCache(orgId);
      return updated;
    });
  }

  async deleteProductImage(orgId: string, imageId: string): Promise<{ success: true }> {
    const image = await this.db.productImage.findFirst({
      where: { id: imageId, org_id: orgId },
    });
    if (!image) {
      throw new AppError('IMAGE_NOT_FOUND', 'Image not found', 404);
    }

    // Delete image files from storage
    const ext = image.url.split('.').pop();
    await imageUploadService.deleteProductImageFiles({
      orgId,
      productId: image.product_id,
      imageId: image.id,
      ext,
    });

    await this.db.$transaction(async (tx) => {
      await tx.productImage.delete({
        where: { id: imageId },
      });

      // If deleted image was primary, auto-promote the next available image
      if (image.is_primary) {
        const nextPrimary = await tx.productImage.findFirst({
          where: {
            product_id: image.product_id,
            variant_id: image.variant_id,
          },
          orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
        });

        if (nextPrimary) {
          await tx.productImage.update({
            where: { id: nextPrimary.id },
            data: { is_primary: true },
          });
          if (!image.variant_id) {
            await tx.product.update({
              where: { id: image.product_id },
              data: { image_url: nextPrimary.url },
            });
          }
        } else if (!image.variant_id) {
          await tx.product.update({
            where: { id: image.product_id },
            data: { image_url: null },
          });
        }
      }
    });

    this.invalidateCache(orgId);
    return { success: true };
  }
}
