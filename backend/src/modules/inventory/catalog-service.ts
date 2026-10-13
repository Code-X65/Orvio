import type { PrismaClient, BranchProduct, CatalogImport, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { AppError } from '../../lib/errors.js';
import { inventoryCache } from '../../infrastructure/cache/in-memory-cache.js';
import { eventBus, type RealtimeEventType } from '../../infrastructure/websocket/event-bus.js';
import type {
  ImportCatalogInput,
  ImportPreviewInput,
  ListBranchProductsQueryInput,
} from './catalog-schemas.js';

export interface BranchProductItem {
  id: string;
  org_id: string;
  branch_id: string;
  product_id: string;
  source_branch_id: string | null;
  source_branch_name: string | null;
  is_excluded: boolean;
  notes: string | null;
  added_at: Date;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    selling_price: number;
    cost_price: number;
    is_active: boolean;
    image_url: string | null;
    primary_thumbnail_url?: string | null;
    thumbnail_200?: string | null;
    thumbnail_400?: string | null;
    category_id: string | null;
    category_name: string | null;
    brand_id: string | null;
    brand_name: string | null;
    brand_logo: string | null;
    has_variants: boolean;
  };
  quantity_on_hand: number;
  reserved: number;
  available: number;
}

export class CatalogService {
  constructor(private db: PrismaClient = defaultPrisma) {}

  private invalidateCache(orgId: string, branchId?: string, event?: { type: RealtimeEventType; payload: Record<string, unknown> }): void {
    if (branchId) {
      inventoryCache.clearPrefix(`branch_products:${orgId}:${branchId}`);
      inventoryCache.clearPrefix(`branch_products_count:${orgId}:${branchId}`);
      inventoryCache.clearPrefix(`branch_products_page1:${orgId}:${branchId}`);
      inventoryCache.clearPrefix(`catalog_summary:${orgId}:${branchId}`);
    } else {
      inventoryCache.clearPrefix(`branch_products:${orgId}`);
      inventoryCache.clearPrefix(`branch_products_count:${orgId}`);
      inventoryCache.clearPrefix(`branch_products_page1:${orgId}`);
    }
    inventoryCache.clearPrefix(`products_list:${orgId}`);
    inventoryCache.clearPrefix(`products_detail:${orgId}`);
    inventoryCache.clearPrefix(`products_search:${orgId}`);
    if (event) {
      eventBus.broadcastToOrg(orgId, event);
    }
  }

  async listBranchProducts(
    orgId: string,
    branchId: string,
    query: ListBranchProductsQueryInput
  ): Promise<{
    items: BranchProductItem[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      nextCursor?: string | null;
      hasMore?: boolean;
    };
  }> {
    const branch = await this.db.branch.findFirst({
      where: { id: branchId, org_id: orgId, is_deleted: false },
    });

    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    const filterKey = this.stableStringify({
      search: query.search ?? null,
      categoryId: query.categoryId ?? null,
      brandId: query.brandId ?? null,
      includeExcluded: query.includeExcluded ?? false,
    });

    const isPage1 = !query.cursor && (!query.page || query.page === 1);

    if (isPage1) {
      const page1CacheKey = `branch_products_page1:${orgId}:${branchId}:${filterKey}:${query.limit}`;
      return await inventoryCache.fetchOrCompute(
        page1CacheKey,
        async () => this.fetchBranchProductsPage(orgId, branchId, query, filterKey),
        30_000
      );
    }

    // Deep pages or cursor-based queries: execute directly with cached total count
    return await this.fetchBranchProductsPage(orgId, branchId, query, filterKey);
  }

  /**
   * Actual DB fetch for a branch products page with keyset/cursor and offset support.
   */
  private async fetchBranchProductsPage(
    orgId: string,
    branchId: string,
    query: ListBranchProductsQueryInput,
    filterKey?: string
  ): Promise<{
    items: BranchProductItem[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      nextCursor?: string | null;
      hasMore?: boolean;
    };
  }> {
    const where: Prisma.BranchProductWhereInput = {
      org_id: orgId,
      branch_id: branchId,
      ...(query.includeExcluded ? {} : { is_excluded: false }),
      ...(query.categoryId
        ? {
            OR: [
              { category_id: query.categoryId },
              { category_id: null, product: { category_id: query.categoryId } },
            ],
          }
        : {}),
      ...(query.brandId
        ? {
            OR: [
              { brand_id: query.brandId },
              { brand_id: null, product: { brand_id: query.brandId } },
            ],
          }
        : {}),
      product: {
        is_deleted: false,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { sku: { contains: query.search, mode: 'insensitive' } },
                { barcode: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    };

    const actualFilterKey =
      filterKey ??
      this.stableStringify({
        search: query.search ?? null,
        categoryId: query.categoryId ?? null,
        brandId: query.brandId ?? null,
        includeExcluded: query.includeExcluded ?? false,
      });

    // 1. Fetch or compute total count via cached aggregate (60s TTL)
    const countCacheKey = `branch_products_count:${orgId}:${branchId}:${actualFilterKey}`;
    const totalPromise = inventoryCache.fetchOrCompute(
      countCacheKey,
      async () => this.db.branchProduct.count({ where }),
      60_000
    );

    // 2. Fetch page slice using cursor (O(1)) or offset fallback
    const hasCursor = Boolean(query.cursor);
    const rawItemsPromise = this.db.branchProduct.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true, logo_url: true } },
        product: {
          include: {
            category: { select: { id: true, name: true, branch_id: true } },
            brand: { select: { id: true, name: true, logo_url: true, branch_id: true } },
            images: {
              select: {
                url: true,
                thumbnail_200: true,
                thumbnail_400: true,
                is_primary: true,
              },
              orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
              take: 1,
            },
          },
        },
        source_branch: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ added_at: 'desc' }, { id: 'desc' }],
      ...(hasCursor
        ? { cursor: { id: query.cursor! }, skip: 1 }
        : { skip: (query.page - 1) * query.limit }),
      take: query.limit,
    });

    const [total, rawItems] = await Promise.all([totalPromise, rawItemsPromise]);

    // Database-level stock aggregation for page products
    const stockMap = new Map<string, { qoh: number; res: number }>();
    if (rawItems.length > 0) {
      const productIds = rawItems.map((item) => item.product_id);
      const stockAggs = await this.db.$queryRaw<
        Array<{ product_id: string; qoh: string | number; res: string | number }>
      >`
        SELECT 
          COALESCE(sl.product_id, pv.product_id) AS product_id,
          COALESCE(SUM(sl.quantity_on_hand), 0) AS qoh,
          COALESCE(SUM(sl.reserved), 0) AS res
        FROM stock_levels sl
        LEFT JOIN product_variants pv ON sl.variant_id = pv.id
        WHERE sl.org_id = ${orgId}
          AND sl.branch_id = ${branchId}
          AND (sl.product_id = ANY(${productIds}) OR pv.product_id = ANY(${productIds}))
        GROUP BY COALESCE(sl.product_id, pv.product_id)
      `;
      for (const row of stockAggs) {
        stockMap.set(row.product_id, {
          qoh: Number(row.qoh),
          res: Number(row.res),
        });
      }
    }

    const items: BranchProductItem[] = rawItems.map((item) => {
      const stock = stockMap.get(item.product_id) ?? { qoh: 0, res: 0 };
      const qoh = stock.qoh;
      const res = stock.res;

      const sameBranchCategory = item.product.category?.branch_id === branchId;
      const sameBranchBrand = item.product.brand?.branch_id === branchId;
      const primaryImage = item.product.images?.[0];
      const primaryThumb = primaryImage?.thumbnail_200 || primaryImage?.url || item.product.image_url;

      return {
        id: item.id,
        org_id: item.org_id,
        branch_id: item.branch_id,
        product_id: item.product_id,
        source_branch_id: item.source_branch_id,
        source_branch_name: item.source_branch?.name ?? null,
        is_excluded: item.is_excluded,
        notes: item.notes,
        added_at: item.added_at,
        product: {
          id: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          barcode: item.product.barcode,
          selling_price: Number(item.product.selling_price),
          cost_price: Number(item.product.cost_price),
          is_active: item.product.is_active,
          image_url: item.product.image_url,
          primary_thumbnail_url: primaryThumb,
          thumbnail_200: primaryImage?.thumbnail_200 ?? null,
          thumbnail_400: primaryImage?.thumbnail_400 ?? null,
          category_id: item.category_id ?? (sameBranchCategory ? item.product.category_id : null),
          category_name: item.category?.name ?? (sameBranchCategory ? item.product.category?.name ?? null : null),
          brand_id: item.brand_id ?? (sameBranchBrand ? item.product.brand_id : null),
          brand_name: item.brand?.name ?? (sameBranchBrand ? item.product.brand?.name ?? null : null),
          brand_logo: item.brand?.logo_url ?? (sameBranchBrand ? item.product.brand?.logo_url ?? null : null),
          has_variants: item.product.has_variants,
        },
        quantity_on_hand: qoh,
        reserved: res,
        available: qoh - res,
      };
    });

    const nextCursor = rawItems.length === query.limit ? rawItems[rawItems.length - 1].id : null;
    const hasMore = rawItems.length === query.limit;

    return {
      items,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1,
        nextCursor,
        hasMore,
      },
    };
  }

  /**
   * Deterministic JSON stringify with sorted keys — used for stable cache keys.
   */
  private stableStringify(obj: Record<string, unknown>): string {
    const sortedKeys = Object.keys(obj).sort();
    const parts = sortedKeys.map((k) => `${k}:${JSON.stringify(obj[k])}`);
    return `{${parts.join(',')}}`;
  }

  async assignProductToBranch(
    orgId: string,
    branchId: string,
    productId: string,
    userId?: string,
    notes?: string
  ): Promise<BranchProduct> {
    const [branch, product] = await Promise.all([
      this.db.branch.findFirst({ where: { id: branchId, org_id: orgId, is_deleted: false } }),
      this.db.product.findFirst({ where: { id: productId, org_id: orgId, is_deleted: false } }),
    ]);

    if (!branch) throw new AppError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    if (!product) throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);

    const branchProduct = await this.db.branchProduct.upsert({
      where: {
        org_id_branch_id_product_id: {
          org_id: orgId,
          branch_id: branchId,
          product_id: productId,
        },
      },
      create: {
        org_id: orgId,
        branch_id: branchId,
        product_id: productId,
        added_by_user_id: userId ?? null,
        notes: notes ?? null,
        is_excluded: false,
      },
      update: {
        is_excluded: false,
        added_by_user_id: userId ?? undefined,
        notes: notes !== undefined ? notes : undefined,
      },
    });

    this.invalidateCache(orgId, branchId, { type: 'catalog:updated', payload: { branchId, productId } });
    return branchProduct;
  }

  async removeProductFromBranch(
    orgId: string,
    branchId: string,
    productId: string,
    _userId?: string,
    reason?: string
  ): Promise<{ success: boolean }> {
    const existing = await this.db.branchProduct.findUnique({
      where: {
        org_id_branch_id_product_id: {
          org_id: orgId,
          branch_id: branchId,
          product_id: productId,
        },
      },
    });

    if (!existing) {
      throw new AppError('BRANCH_PRODUCT_NOT_FOUND', 'Product is not in this branch catalog', 404);
    }

    await this.db.branchProduct.update({
      where: { id: existing.id },
      data: {
        is_excluded: true,
        notes: reason ? (existing.notes ? `${existing.notes} | Excluded: ${reason}` : `Excluded: ${reason}`) : existing.notes,
      },
    });

    this.invalidateCache(orgId, branchId, { type: 'catalog:updated', payload: { branchId, productId, excluded: true } });
    return { success: true };
  }

  async restoreProductToBranch(
    orgId: string,
    branchId: string,
    productId: string
  ): Promise<BranchProduct> {
    const existing = await this.db.branchProduct.findUnique({
      where: {
        org_id_branch_id_product_id: {
          org_id: orgId,
          branch_id: branchId,
          product_id: productId,
        },
      },
    });

    if (!existing) {
      throw new AppError('BRANCH_PRODUCT_NOT_FOUND', 'Product not found in this branch catalog', 404);
    }

    const updated = await this.db.branchProduct.update({
      where: { id: existing.id },
      data: { is_excluded: false },
    });

    this.invalidateCache(orgId, branchId, { type: 'catalog:updated', payload: { branchId, productId, restored: true } });
    return updated;
  }

  async importCatalog(
    orgId: string,
    sourceBranchId: string,
    targetBranchId: string,
    input: ImportCatalogInput,
    userId?: string
  ): Promise<{
    importedCount: number;
    skippedCount: number;
    auditLog: CatalogImport;
  }> {
    if (sourceBranchId === targetBranchId) {
      throw new AppError('CATALOG_IMPORT_FAILED', 'Cannot import catalog from the same branch', 400);
    }

    const [sourceBranch, targetBranch] = await Promise.all([
      this.db.branch.findFirst({ where: { id: sourceBranchId, org_id: orgId, is_deleted: false } }),
      this.db.branch.findFirst({ where: { id: targetBranchId, org_id: orgId, is_deleted: false } }),
    ]);

    if (!sourceBranch) throw new AppError('BRANCH_NOT_FOUND', 'Source branch not found', 404);
    if (!targetBranch) throw new AppError('BRANCH_NOT_FOUND', 'Target branch not found', 404);

    let productIdsToImport = input.productIds;

    if (input.importAll || productIdsToImport.length === 0) {
      const sourceProducts = await this.db.branchProduct.findMany({
        where: {
          org_id: orgId,
          branch_id: sourceBranchId,
          is_excluded: false,
          product: { is_deleted: false },
        },
        select: { product_id: true },
      });
      productIdsToImport = sourceProducts.map((p) => p.product_id);
    }

    if (productIdsToImport.length === 0) {
      throw new AppError('CATALOG_IMPORT_FAILED', 'No products available to import from source branch', 400);
    }

    let importedCount = 0;
    let skippedCount = 0;

    const resultAudit = await this.db.$transaction(async (tx) => {
      // Fetch existing assignments in target branch
      const existingInTarget = await tx.branchProduct.findMany({
        where: {
          org_id: orgId,
          branch_id: targetBranchId,
          product_id: { in: productIdsToImport },
        },
      });

      const existingMap = new Map(existingInTarget.map((e) => [e.product_id, e]));
      const categoryCacheMap = new Map<string, string>();
      const brandCacheMap = new Map<string, string>();

      // Fetch source products to know their category & brand
      const sourceProducts = await tx.product.findMany({
        where: { id: { in: productIdsToImport }, org_id: orgId },
        select: {
          id: true,
          category_id: true,
          brand_id: true,
          branch_assignments: {
            where: { branch_id: sourceBranchId },
            select: { category_id: true, brand_id: true },
          },
        },
      });
      const sourceProductMap = new Map(sourceProducts.map((p) => [p.id, p]));

      // 1. Batch Taxonomy Pre-resolution
      if (input.importTaxonomy) {
        const uniqueCatIds = new Set<string>();
        const uniqueBrandIds = new Set<string>();

        for (const sp of sourceProducts) {
          const catId = sp.branch_assignments[0]?.category_id || sp.category_id;
          if (catId) uniqueCatIds.add(catId);
          const brandId = sp.branch_assignments[0]?.brand_id || sp.brand_id;
          if (brandId) uniqueBrandIds.add(brandId);
        }

        // Batch resolve Brands
        if (uniqueBrandIds.size > 0) {
          const sourceBrands = await tx.brand.findMany({
            where: { id: { in: Array.from(uniqueBrandIds) }, org_id: orgId, is_deleted: false },
          });
          const targetBrands = await tx.brand.findMany({
            where: { org_id: orgId, branch_id: targetBranchId, is_deleted: false },
          });
          const targetBrandSlugMap = new Map(targetBrands.map((b) => [b.slug, b]));

          for (const sb of sourceBrands) {
            const matched = targetBrandSlugMap.get(sb.slug);
            if (matched) {
              brandCacheMap.set(sb.id, matched.id);
            } else {
              const newBrand = await tx.brand.create({
                data: {
                  org_id: orgId,
                  branch_id: targetBranchId,
                  name: sb.name,
                  slug: sb.slug,
                  description: sb.description,
                  logo_url: sb.logo_url,
                  website_url: sb.website_url,
                  sort_order: sb.sort_order,
                  metadata: (sb.metadata as any) ?? undefined,
                  is_active: true,
                },
                select: { id: true, slug: true },
              });
              targetBrandSlugMap.set(newBrand.slug, newBrand as any);
              brandCacheMap.set(sb.id, newBrand.id);
            }
          }
        }

        // Batch resolve Categories
        if (uniqueCatIds.size > 0) {
          const allOrgCategories = await tx.category.findMany({
            where: { org_id: orgId, is_deleted: false },
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              image_url: true,
              parent_id: true,
              sort_order: true,
              branch_id: true,
            },
          });
          const orgCatMap = new Map(allOrgCategories.map((c) => [c.id, c]));

          const targetCategories = allOrgCategories.filter((c) => c.branch_id === targetBranchId);
          const targetCatKeyMap = new Map(
            targetCategories.map((c) => [`${c.slug}:${c.parent_id ?? 'root'}`, c.id])
          );

          for (const srcCatId of uniqueCatIds) {
            const chain: typeof allOrgCategories = [];
            let curr: string | null = srcCatId;
            while (curr) {
              const cat = orgCatMap.get(curr);
              if (!cat) break;
              chain.unshift(cat);
              curr = cat.parent_id;
            }

            let currentTargetParentId: string | null = null;
            for (const node of chain) {
              const cacheKey: string = `${node.id}:${currentTargetParentId ?? 'root'}`;
              if (categoryCacheMap.has(cacheKey)) {
                currentTargetParentId = categoryCacheMap.get(cacheKey)!;
                continue;
              }

              const targetLookupKey = `${node.slug}:${currentTargetParentId ?? 'root'}`;
              const existingTargetId = targetCatKeyMap.get(targetLookupKey);

              if (existingTargetId) {
                currentTargetParentId = existingTargetId;
              } else {
                let finalSlug = node.slug;
                const hasSlugConflict = targetCategories.some(
                  (c) => c.slug === node.slug && c.parent_id !== currentTargetParentId
                );
                if (hasSlugConflict) {
                  let counter = 2;
                  while (targetCategories.some((c) => c.slug === `${node.slug}-${counter}`)) {
                    counter++;
                  }
                  finalSlug = `${node.slug}-${counter}`;
                }

                const createdCat: { id: string; slug: string; parent_id: string | null } = await tx.category.create({
                  data: {
                    org_id: orgId,
                    branch_id: targetBranchId,
                    name: node.name,
                    slug: finalSlug,
                    description: node.description,
                    image_url: node.image_url,
                    parent_id: currentTargetParentId,
                    sort_order: node.sort_order,
                    is_active: true,
                  },
                  select: { id: true, slug: true, parent_id: true },
                });

                currentTargetParentId = createdCat.id;
                targetCatKeyMap.set(`${createdCat.slug}:${createdCat.parent_id ?? 'root'}`, createdCat.id);
                targetCategories.push({
                  id: createdCat.id,
                  name: node.name,
                  slug: createdCat.slug,
                  description: node.description,
                  image_url: node.image_url,
                  parent_id: createdCat.parent_id,
                  sort_order: node.sort_order,
                  branch_id: targetBranchId,
                });
              }

              if (currentTargetParentId) {
                categoryCacheMap.set(cacheKey, currentTargetParentId);
              }
            }

            if (currentTargetParentId) {
              categoryCacheMap.set(`target:${srcCatId}`, currentTargetParentId);
            }
          }
        }
      }

      // 2. Prepare BranchProduct assignments
      const toCreateAssignments: Prisma.BranchProductCreateManyInput[] = [];
      const toUpdateAssignments: Array<{
        id: string;
        category_id: string | null;
        brand_id: string | null;
        notes: string | null;
      }> = [];

      for (const prodId of productIdsToImport) {
        const existingAssignment = existingMap.get(prodId);
        const srcProd = sourceProductMap.get(prodId);

        let targetCategoryId: string | null = null;
        let targetBrandId: string | null = null;

        if (input.importTaxonomy) {
          const rawCatId = srcProd?.branch_assignments[0]?.category_id || srcProd?.category_id;
          if (rawCatId) {
            targetCategoryId = categoryCacheMap.get(`target:${rawCatId}`) ?? null;
          }

          const rawBrandId = srcProd?.branch_assignments[0]?.brand_id || srcProd?.brand_id;
          if (rawBrandId) {
            targetBrandId = brandCacheMap.get(rawBrandId) ?? null;
          }
        }

        if (existingAssignment) {
          if (!existingAssignment.is_excluded && !input.overwriteExisting) {
            skippedCount++;
            continue;
          }

          toUpdateAssignments.push({
            id: existingAssignment.id,
            category_id: targetCategoryId,
            brand_id: targetBrandId,
            notes: input.notes ?? existingAssignment.notes,
          });
          importedCount++;
        } else {
          toCreateAssignments.push({
            org_id: orgId,
            branch_id: targetBranchId,
            product_id: prodId,
            category_id: targetCategoryId,
            brand_id: targetBrandId,
            source_branch_id: sourceBranchId,
            added_by_user_id: userId ?? null,
            notes: input.notes ?? null,
            is_excluded: false,
          });
          importedCount++;
        }
      }

      // Bulk create new branch product assignments
      if (toCreateAssignments.length > 0) {
        await tx.branchProduct.createMany({
          data: toCreateAssignments,
          skipDuplicates: true,
        });
      }

      // Update existing branch product assignments
      for (const item of toUpdateAssignments) {
        await tx.branchProduct.update({
          where: { id: item.id },
          data: {
            is_excluded: false,
            source_branch_id: sourceBranchId,
            category_id: item.category_id,
            brand_id: item.brand_id,
            notes: item.notes,
          },
        });
      }

      // 3. Batch Stock Level Replication
      if (input.copyStock && productIdsToImport.length > 0) {
        const sourceStockLevels = await tx.stockLevel.findMany({
          where: {
            org_id: orgId,
            branch_id: sourceBranchId,
            OR: [
              { product_id: { in: productIdsToImport } },
              { variant: { product_id: { in: productIdsToImport } } },
            ],
          },
        });

        if (sourceStockLevels.length > 0) {
          const targetStockLevels = await tx.stockLevel.findMany({
            where: {
              org_id: orgId,
              branch_id: targetBranchId,
              OR: [
                { product_id: { in: productIdsToImport } },
                { variant: { product_id: { in: productIdsToImport } } },
              ],
            },
          });

          const targetStockMap = new Map<string, (typeof targetStockLevels)[0]>();
          for (const tsl of targetStockLevels) {
            const key = tsl.variant_id ? `var:${tsl.variant_id}` : `prod:${tsl.product_id}`;
            targetStockMap.set(key, tsl);
          }

          const stockToCreate: Prisma.StockLevelCreateManyInput[] = [];
          for (const ssl of sourceStockLevels) {
            const key = ssl.variant_id ? `var:${ssl.variant_id}` : `prod:${ssl.product_id}`;
            const existingTargetSl = targetStockMap.get(key);

            if (existingTargetSl) {
              if (input.overwriteExisting) {
                await tx.stockLevel.update({
                  where: { id: existingTargetSl.id },
                  data: {
                    quantity_on_hand: ssl.quantity_on_hand,
                  },
                });
              }
            } else {
              stockToCreate.push({
                org_id: orgId,
                branch_id: targetBranchId,
                product_id: ssl.product_id,
                variant_id: ssl.variant_id,
                quantity_on_hand: ssl.quantity_on_hand,
                reserved: 0,
              });
            }
          }

          if (stockToCreate.length > 0) {
            await tx.stockLevel.createMany({
              data: stockToCreate,
              skipDuplicates: true,
            });
          }
        }
      }

      // Create CatalogImport record
      const auditLog = await tx.catalogImport.create({
        data: {
          org_id: orgId,
          source_branch_id: sourceBranchId,
          target_branch_id: targetBranchId,
          imported_by_user_id: userId ?? null,
          product_count: importedCount,
          copy_stock: input.copyStock,
          notes: input.notes ?? null,
        },
      });

      return auditLog;
    }, { timeout: 30000, maxWait: 10000 });

    this.invalidateCache(orgId, targetBranchId, {
      type: 'catalog:import_complete',
      payload: { sourceBranchId, targetBranchId, importedCount, skippedCount },
    });
    return {
      importedCount,
      skippedCount,
      auditLog: resultAudit,
    };
  }

  async getBranchCatalogSummary(
    orgId: string,
    branchId: string
  ): Promise<{
    branch: { id: string; name: string };
    totalAssignedProducts: number;
    activeAssignedProducts: number;
    excludedProducts: number;
    importedProductsCount: number;
    categoriesCount: number;
    brandsCount: number;
  }> {
    const branch = await this.db.branch.findFirst({
      where: { id: branchId, org_id: orgId, is_deleted: false },
    });

    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    return await inventoryCache.fetchOrCompute(
      `catalog_summary:${orgId}:${branchId}`,
      async () => {
        const [assigned, activeAssigned, excluded, imported, categories, brands] = await Promise.all([
          this.db.branchProduct.count({
            where: { org_id: orgId, branch_id: branchId, product: { is_deleted: false } },
          }),
          this.db.branchProduct.count({
            where: { org_id: orgId, branch_id: branchId, is_excluded: false, product: { is_deleted: false, is_active: true } },
          }),
          this.db.branchProduct.count({
            where: { org_id: orgId, branch_id: branchId, is_excluded: true, product: { is_deleted: false } },
          }),
          this.db.branchProduct.count({
            where: { org_id: orgId, branch_id: branchId, source_branch_id: { not: null }, is_excluded: false },
          }),
          this.db.product.groupBy({
            by: ['category_id'],
            where: {
              org_id: orgId,
              branch_assignments: { some: { branch_id: branchId, is_excluded: false } },
              category_id: { not: null },
              is_deleted: false,
            },
          }),
          this.db.product.groupBy({
            by: ['brand_id'],
            where: {
              org_id: orgId,
              branch_assignments: { some: { branch_id: branchId, is_excluded: false } },
              brand_id: { not: null },
              is_deleted: false,
            },
          }),
        ]);

        return {
          branch: { id: branch.id, name: branch.name },
          totalAssignedProducts: assigned,
          activeAssignedProducts: activeAssigned,
          excludedProducts: excluded,
          importedProductsCount: imported,
          categoriesCount: categories.length,
          brandsCount: brands.length,
        };
      },
      60_000
    );
  }

  async listCatalogImports(
    orgId: string,
    page = 1,
    limit = 20
  ): Promise<{
    imports: Array<CatalogImport & { source_branch_name: string; target_branch_name: string; user_name: string | null }>;
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const where = { org_id: orgId };
    const skip = (page - 1) * limit;

    const [total, rawImports] = await Promise.all([
      this.db.catalogImport.count({ where }),
      this.db.catalogImport.findMany({
        where,
        include: {
          source_branch: { select: { name: true } },
          target_branch: { select: { name: true } },
          user: { select: { full_name: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const imports = rawImports.map((imp) => ({
      id: imp.id,
      org_id: imp.org_id,
      source_branch_id: imp.source_branch_id,
      target_branch_id: imp.target_branch_id,
      imported_by_user_id: imp.imported_by_user_id,
      product_count: imp.product_count,
      copy_stock: imp.copy_stock,
      notes: imp.notes,
      created_at: imp.created_at,
      source_branch_name: imp.source_branch.name,
      target_branch_name: imp.target_branch.name,
      user_name: imp.user?.full_name ?? null,
    }));

    return {
      imports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async resolveCategoryHierarchy(
    orgId: string,
    sourceCategoryId: string,
    targetBranchId: string,
    tx: Prisma.TransactionClient,
    cacheMap: Map<string, string>
  ): Promise<string | null> {
    const chain: Array<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      image_url: string | null;
      parent_id: string | null;
      sort_order: number;
    }> = [];

    let currId: string | null = sourceCategoryId;
    while (currId) {
      const cat: {
        id: string;
        name: string;
        slug: string;
        description: string | null;
        image_url: string | null;
        parent_id: string | null;
        sort_order: number;
      } | null = await tx.category.findFirst({
        where: { id: currId, org_id: orgId, is_deleted: false },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          image_url: true,
          parent_id: true,
          sort_order: true,
        },
      });
      if (!cat) break;
      chain.unshift(cat);
      currId = cat.parent_id;
    }

    if (chain.length === 0) return null;

    let currentTargetParentId: string | null = null;
    for (const node of chain) {
      const cacheKey: string = `${node.id}:${currentTargetParentId ?? 'root'}`;
      if (cacheMap.has(cacheKey)) {
        currentTargetParentId = cacheMap.get(cacheKey)!;
        continue;
      }

      // Check if targetBranchId already has this category with matching slug & parent_id
      const existingInTarget: { id: string } | null = await tx.category.findFirst({
        where: {
          org_id: orgId,
          branch_id: targetBranchId,
          slug: node.slug,
          parent_id: currentTargetParentId,
          is_deleted: false,
        },
        select: { id: true },
      });

      if (existingInTarget) {
        currentTargetParentId = existingInTarget.id;
      } else {
        // Resolve slug conflict if slug exists under a different parent in targetBranchId
        let finalSlug = node.slug;
        const slugConflict = await tx.category.findFirst({
          where: {
            org_id: orgId,
            branch_id: targetBranchId,
            slug: node.slug,
            is_deleted: false,
          },
          select: { id: true },
        });

        if (slugConflict) {
          const conflictingSlugs = await tx.category.findMany({
            where: {
              org_id: orgId,
              branch_id: targetBranchId,
              slug: { startsWith: `${node.slug}-` },
              is_deleted: false,
            },
            select: { slug: true },
          });
          const existingSlugSet = new Set(conflictingSlugs.map((c) => c.slug));
          let counter = 2;
          while (existingSlugSet.has(`${node.slug}-${counter}`)) {
            counter++;
          }
          finalSlug = `${node.slug}-${counter}`;
        }

        const createdCat: { id: string } = await tx.category.create({
          data: {
            org_id: orgId,
            branch_id: targetBranchId,
            name: node.name,
            slug: finalSlug,
            description: node.description,
            image_url: node.image_url,
            parent_id: currentTargetParentId,
            sort_order: node.sort_order,
            is_active: true,
          },
          select: { id: true },
        });

        currentTargetParentId = createdCat.id;
      }

      if (currentTargetParentId) {
        cacheMap.set(cacheKey, currentTargetParentId);
      }
    }

    return currentTargetParentId;
  }

  async resolveBrand(
    orgId: string,
    sourceBrandId: string,
    targetBranchId: string,
    tx: Prisma.TransactionClient,
    brandCacheMap: Map<string, string>
  ): Promise<string | null> {
    if (brandCacheMap.has(sourceBrandId)) {
      return brandCacheMap.get(sourceBrandId)!;
    }

    const sourceBrand: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      logo_url: string | null;
      website_url: string | null;
      sort_order: number;
      metadata: unknown;
    } | null = await tx.brand.findFirst({
      where: { id: sourceBrandId, org_id: orgId, is_deleted: false },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logo_url: true,
        website_url: true,
        sort_order: true,
        metadata: true,
      },
    });

    if (!sourceBrand) return null;

    const existingBrand: { id: string } | null = await tx.brand.findFirst({
      where: {
        org_id: orgId,
        branch_id: targetBranchId,
        slug: sourceBrand.slug,
        is_deleted: false,
      },
      select: { id: true },
    });

    if (existingBrand) {
      brandCacheMap.set(sourceBrandId, existingBrand.id);
      return existingBrand.id;
    }

    const createdBrand: { id: string } = await tx.brand.create({
      data: {
        org_id: orgId,
        branch_id: targetBranchId,
        name: sourceBrand.name,
        slug: sourceBrand.slug,
        description: sourceBrand.description,
        logo_url: sourceBrand.logo_url,
        website_url: sourceBrand.website_url,
        sort_order: sourceBrand.sort_order,
        metadata: (sourceBrand.metadata as any) ?? undefined,
        is_active: true,
      },
      select: { id: true },
    });

    brandCacheMap.set(sourceBrandId, createdBrand.id);
    return createdBrand.id;
  }

  async previewImportTaxonomy(
    orgId: string,
    targetBranchId: string,
    input: ImportPreviewInput
  ): Promise<{
    totalProducts: number;
    matchedCategories: Array<{ id: string; name: string; slug: string; path: string }>;
    newCategories: Array<{ name: string; slug: string; path: string; parentName: string | null }>;
    matchedBrands: Array<{ id: string; name: string; slug: string }>;
    newBrands: Array<{ name: string; slug: string }>;
  }> {
    let productIdsToPreview = input.productIds;
    if (input.importAll || productIdsToPreview.length === 0) {
      const sourceProducts = await this.db.branchProduct.findMany({
        where: {
          org_id: orgId,
          branch_id: input.sourceBranchId,
          is_excluded: false,
          product: { is_deleted: false },
        },
        select: { product_id: true },
      });
      productIdsToPreview = sourceProducts.map((p) => p.product_id);
    }

    if (productIdsToPreview.length === 0) {
      return {
        totalProducts: 0,
        matchedCategories: [],
        newCategories: [],
        matchedBrands: [],
        newBrands: [],
      };
    }

    const products = await this.db.product.findMany({
      where: { id: { in: productIdsToPreview }, org_id: orgId, is_deleted: false },
      select: {
        id: true,
        category_id: true,
        brand_id: true,
        branch_assignments: {
          where: { branch_id: input.sourceBranchId },
          select: { category_id: true, brand_id: true },
        },
      },
    });

    const uniqueCatIds = new Set<string>();
    const uniqueBrandIds = new Set<string>();

    for (const p of products) {
      const catId = p.branch_assignments[0]?.category_id || p.category_id;
      if (catId) uniqueCatIds.add(catId);
      const brandId = p.branch_assignments[0]?.brand_id || p.brand_id;
      if (brandId) uniqueBrandIds.add(brandId);
    }

    // Resolve Brand preview
    const matchedBrands: Array<{ id: string; name: string; slug: string }> = [];
    const newBrands: Array<{ name: string; slug: string }> = [];

    if (uniqueBrandIds.size > 0) {
      const sourceBrands = await this.db.brand.findMany({
        where: { id: { in: Array.from(uniqueBrandIds) }, org_id: orgId, is_deleted: false },
        select: { id: true, name: true, slug: true },
      });

      const targetBrands = await this.db.brand.findMany({
        where: { org_id: orgId, branch_id: targetBranchId, is_deleted: false },
        select: { id: true, name: true, slug: true },
      });
      const targetBrandSlugMap = new Map(targetBrands.map((b) => [b.slug, b]));

      for (const sb of sourceBrands) {
        const matched = targetBrandSlugMap.get(sb.slug);
        if (matched) {
          matchedBrands.push({ id: matched.id, name: matched.name, slug: matched.slug });
        } else {
          newBrands.push({ name: sb.name, slug: sb.slug });
        }
      }
    }

    // Resolve Category preview
    const matchedCategories: Array<{ id: string; name: string; slug: string; path: string }> = [];
    const newCategories: Array<{ name: string; slug: string; path: string; parentName: string | null }> = [];

    if (uniqueCatIds.size > 0) {
      const allTargetCategories = await this.db.category.findMany({
        where: { org_id: orgId, branch_id: targetBranchId, is_deleted: false },
        select: { id: true, name: true, slug: true, parent_id: true },
      });

      // Target category lookup map: slug:parent_id -> category (O(1) lookup)
      const targetCatSlugMap = new Map<string, { id: string; name: string; slug: string; parent_id: string | null }>();
      for (const tc of allTargetCategories) {
        targetCatSlugMap.set(`${tc.slug}:${tc.parent_id ?? 'root'}`, tc);
      }

      // Targeted source category resolution: iteratively fetch ONLY candidate ancestors instead of entire org
      let currentIds = Array.from(uniqueCatIds);
      const sourceCatMap = new Map<string, { id: string; name: string; slug: string; parent_id: string | null }>();
      while (currentIds.length > 0) {
        const cats = await this.db.category.findMany({
          where: { id: { in: currentIds }, org_id: orgId, is_deleted: false },
          select: { id: true, name: true, slug: true, parent_id: true },
        });
        const nextParentIds: string[] = [];
        for (const c of cats) {
          sourceCatMap.set(c.id, c);
          if (c.parent_id && !sourceCatMap.has(c.parent_id)) {
            nextParentIds.push(c.parent_id);
          }
        }
        currentIds = Array.from(new Set(nextParentIds));
      }

      const seenNodes = new Set<string>();

      for (const catId of uniqueCatIds) {
        const chain: Array<{ id: string; name: string; slug: string; parent_id: string | null }> = [];
        let curr: any = sourceCatMap.get(catId);
        while (curr) {
          chain.unshift(curr);
          curr = curr.parent_id ? sourceCatMap.get(curr.parent_id) : null;
        }

        let currentTargetParentId: string | null = null;
        const pathParts: string[] = [];

        for (const node of chain) {
          pathParts.push(node.name);
          const fullPath = pathParts.join(' > ');
          const nodeKey = `${node.slug}:${currentTargetParentId ?? 'root'}`;

          const existingInTarget = targetCatSlugMap.get(nodeKey);

          if (existingInTarget) {
            currentTargetParentId = existingInTarget.id;
            if (!seenNodes.has(nodeKey)) {
              seenNodes.add(nodeKey);
              matchedCategories.push({
                id: existingInTarget.id,
                name: node.name,
                slug: node.slug,
                path: fullPath,
              });
            }
          } else {
            const fakeId = `sim_${node.id}`;
            const simulatedCat = {
              id: fakeId,
              name: node.name,
              slug: node.slug,
              parent_id: currentTargetParentId,
            };
            targetCatSlugMap.set(nodeKey, simulatedCat);
            currentTargetParentId = fakeId;

            if (!seenNodes.has(nodeKey)) {
              seenNodes.add(nodeKey);
              newCategories.push({
                name: node.name,
                slug: node.slug,
                path: fullPath,
                parentName: pathParts.length > 1 ? pathParts[pathParts.length - 2] : null,
              });
            }
          }
        }
      }
    }

    return {
      totalProducts: productIdsToPreview.length,
      matchedCategories,
      newCategories,
      matchedBrands,
      newBrands,
    };
  }
}
