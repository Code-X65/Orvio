import type { PrismaClient, Product, ProductVariant, measurement_unit } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { AppError } from '../../lib/errors.js';
import { inventoryCache } from '../../infrastructure/cache/in-memory-cache.js';
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  ListProductsQueryInput,
  SearchProductsQueryInput,
} from './products-schemas.js';

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
  image_url: string | null;
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
          where: { org_id: orgId, is_primary: true },
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
          is_deleted: false,
        };

        if (activeOnly) {
          whereClause.is_active = true;
        }

        if (query.categoryId) {
          whereClause.category_id = query.categoryId;
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
            image_url: p.image_url,
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
              where: { is_active: true },
              orderBy: { created_at: 'asc' },
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

  async deleteProduct(orgId: string, productId: string): Promise<{ success: true }> {
    const existing = await this.db.product.findFirst({
      where: { id: productId, org_id: orgId, is_deleted: false },
    });

    if (!existing) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    // Strict soft-delete per agreed decision
    await this.db.product.update({
      where: { id: productId },
      data: {
        is_deleted: true,
        is_active: false,
      },
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
          where: { org_id: orgId, is_primary: true },
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
}
