import type { PrismaClient, Category } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { AppError } from '../../lib/errors.js';
import { inventoryCache } from '../../infrastructure/cache/in-memory-cache.js';
import { imageUploadService } from './image-upload-service.js';
import {
  DEFAULT_CATEGORIES_BY_BUSINESS_TYPE,
  GENERIC_DEFAULT_CATEGORIES,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from './categories-schemas.js';

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  depth: number;
  direct_product_count?: number;
  product_count?: number;
}

export interface CategoryWithPath extends Category {
  children_count: number;
  full_path: string;
}

export function slugify(text: string): string {
  const slug = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  return slug || 'category';
}

export class CategoryService {
  constructor(private db: PrismaClient = defaultPrisma) {}

  private invalidateCache(orgId: string): void {
    inventoryCache.clearPrefix(`categories_tree:${orgId}`);
    inventoryCache.clearPrefix(`category:${orgId}`);
    // Invalidate product caches so cached products reflect updated/deleted category names
    inventoryCache.clearPrefix(`products_list:${orgId}`);
    inventoryCache.clearPrefix(`products_detail:${orgId}`);
    inventoryCache.clearPrefix(`products_search:${orgId}`);
  }

  async resolveUniqueSlug(
    orgId: string,
    baseSlug: string,
    prismaClient: PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0] = this.db,
    excludeId?: string
  ): Promise<string> {
    let candidate = baseSlug || 'category';
    let counter = 1;

    while (true) {
      const existing = await (prismaClient as PrismaClient).category.findFirst({
        where: {
          org_id: orgId,
          slug: candidate,
          is_deleted: false,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }

      counter++;
      candidate = `${baseSlug}-${counter}`;
    }
  }

  private async calculateNodeDepth(orgId: string, parentId: string): Promise<number> {
    let depth = 1;
    let currentParentId: string | null = parentId;

    while (currentParentId) {
      depth++;
      if (depth > 5) {
        throw new AppError(
          'INVALID_CATEGORY_HIERARCHY',
          'Maximum category hierarchy depth of 5 levels reached',
          400
        );
      }

      const ancestor: { parent_id: string | null; org_id: string; is_deleted: boolean } | null = await this.db.category.findUnique({
        where: { id: currentParentId },
        select: { parent_id: true, org_id: true, is_deleted: true },
      });

      if (!ancestor || ancestor.org_id !== orgId || ancestor.is_deleted) {
        throw new AppError('CATEGORY_NOT_FOUND', 'Parent category not found in this organization', 404);
      }

      currentParentId = ancestor.parent_id;
    }

    return depth;
  }

  private async getSubtreeHeight(categoryId: string): Promise<number> {
    const children = await this.db.category.findMany({
      where: { parent_id: categoryId, is_deleted: false },
      select: { id: true },
    });

    if (children.length === 0) {
      return 1;
    }

    const heights = await Promise.all(children.map((c) => this.getSubtreeHeight(c.id)));
    return 1 + Math.max(...heights);
  }

  async getCategoryTree(
    orgId: string,
    options?: { activeOnly?: boolean; parentId?: string; includeInactive?: boolean }
  ): Promise<CategoryTreeNode[]> {
    const activeOnly = options?.includeInactive ? false : (options?.activeOnly ?? true);
    const parentFilter = options?.parentId ?? 'root';
    const cacheKey = `categories_tree:${orgId}:${activeOnly}:${parentFilter}`;

    return await inventoryCache.fetchOrCompute(
      cacheKey,
      async () => {
        const allCategories = await this.db.category.findMany({
          where: { org_id: orgId, is_deleted: false },
          orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
        });

        const categoryMap = new Map<string, Category>();
        for (const cat of allCategories) {
          categoryMap.set(cat.id, cat);
        }

        // Helper to check if any ancestor is inactive
        const isAncestorInactive = (cat: Category): boolean => {
          let currId = cat.parent_id;
          while (currId) {
            const ancestor = categoryMap.get(currId);
            if (!ancestor) break;
            if (!ancestor.is_active) return true;
            currId = ancestor.parent_id;
          }
          return false;
        };

        const eligibleCategories = allCategories.filter((cat) => {
          if (activeOnly) {
            if (!cat.is_active) return false;
            if (isAncestorInactive(cat)) return false;
          }
          return true;
        });

        // Fetch product counts per category
        const productCounts = await this.db.product.groupBy({
          by: ['category_id'],
          where: { org_id: orgId, is_deleted: false, category_id: { not: null } },
          _count: { id: true },
        });

        const directCountMap = new Map<string, number>();
        for (const item of productCounts) {
          if (item.category_id) {
            directCountMap.set(item.category_id, item._count.id);
          }
        }

        // Group by parent_id
        const childrenMap = new Map<string | null, Category[]>();
        for (const cat of eligibleCategories) {
          const pid = cat.parent_id ?? null;
          const list = childrenMap.get(pid) ?? [];
          list.push(cat);
          childrenMap.set(pid, list);
        }

        const buildTree = (parentId: string | null, depth = 0): CategoryTreeNode[] => {
          const directChildren = childrenMap.get(parentId) ?? [];
          return directChildren.map((item) => {
            const children = buildTree(item.id, depth + 1);
            const directProductCount = directCountMap.get(item.id) ?? 0;
            const subtreeProductCount = children.reduce(
              (sum, child) => sum + (child.product_count ?? 0),
              0
            );
            const totalProductCount = directProductCount + subtreeProductCount;

            return {
              ...item,
              depth,
              direct_product_count: directProductCount,
              product_count: totalProductCount,
              children,
            };
          });
        };

        if (options?.parentId) {
          return buildTree(options.parentId, 0);
        }

        return buildTree(null, 0);
      },
      30_000
    );
  }

  async getCategoryById(orgId: string, categoryId: string): Promise<CategoryWithPath> {
    const category = await this.db.category.findFirst({
      where: { id: categoryId, org_id: orgId, is_deleted: false },
    });

    if (!category) {
      throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
    }

    const childrenCount = await this.db.category.count({
      where: { parent_id: categoryId, is_deleted: false },
    });

    // Build path
    const pathSegments: string[] = [category.name];
    let currentParentId = category.parent_id;

    while (currentParentId) {
      const parent = await this.db.category.findUnique({
        where: { id: currentParentId },
        select: { name: true, parent_id: true, org_id: true, is_deleted: true },
      });
      if (!parent || parent.org_id !== orgId || parent.is_deleted) break;
      pathSegments.unshift(parent.name);
      currentParentId = parent.parent_id;
    }

    return {
      ...category,
      children_count: childrenCount,
      full_path: pathSegments.join(' > '),
    };
  }

  async getCategoryUsage(
    orgId: string,
    categoryId: string
  ): Promise<{ productCount: number; childCount: number }> {
    const category = await this.db.category.findFirst({
      where: { id: categoryId, org_id: orgId, is_deleted: false },
    });

    if (!category) {
      throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
    }

    const childCount = await this.db.category.count({
      where: { parent_id: categoryId, is_deleted: false },
    });

    const productCount = await this.db.product.count({
      where: { category_id: categoryId, org_id: orgId, is_deleted: false },
    });

    return { productCount, childCount };
  }

  async createCategory(orgId: string, input: CreateCategoryInput): Promise<Category> {
    const parentId = input.parentId ?? null;

    if (parentId) {
      const parent = await this.db.category.findFirst({
        where: { id: parentId, org_id: orgId, is_deleted: false },
      });
      if (!parent) {
        throw new AppError('CATEGORY_NOT_FOUND', 'Parent category not found in this organization', 404);
      }
      await this.calculateNodeDepth(orgId, parentId);
    }

    const baseSlug = slugify(input.name);
    const slug = await this.resolveUniqueSlug(orgId, baseSlug);

    // Compute next sort order for this parent
    const lastSibling = await this.db.category.findFirst({
      where: { org_id: orgId, parent_id: parentId, is_deleted: false },
      orderBy: { sort_order: 'desc' },
      select: { sort_order: true },
    });
    const sortOrder = lastSibling ? lastSibling.sort_order + 1 : 0;

    const created = await this.db.category.create({
      data: {
        org_id: orgId,
        name: input.name,
        slug,
        description: input.description ?? null,
        parent_id: parentId,
        sort_order: sortOrder,
        is_active: input.isActive ?? true,
      },
    });

    this.invalidateCache(orgId);
    return created;
  }

  async updateCategory(orgId: string, categoryId: string, input: UpdateCategoryInput): Promise<Category> {
    const existing = await this.db.category.findFirst({
      where: { id: categoryId, org_id: orgId, is_deleted: false },
    });

    if (!existing) {
      throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
    }

    let nextParentId = existing.parent_id;
    if (input.parentId !== undefined) {
      const requestedParentId = input.parentId ?? null;
      if (requestedParentId === categoryId) {
        throw new AppError('INVALID_CATEGORY_HIERARCHY', 'Category cannot be its own parent', 400);
      }

      if (requestedParentId !== null) {
        // Prevent circular hierarchy
        let checkId: string | null = requestedParentId;
        while (checkId) {
          if (checkId === categoryId) {
            throw new AppError(
              'INVALID_CATEGORY_HIERARCHY',
              'Cannot set a descendant category as parent (circular hierarchy)',
              400
            );
          }

          const ancestor: { parent_id: string | null; org_id: string; is_deleted: boolean } | null = await this.db.category.findUnique({
            where: { id: checkId },
            select: { parent_id: true, org_id: true, is_deleted: true },
          });

          if (!ancestor || ancestor.org_id !== orgId || ancestor.is_deleted) {
            throw new AppError('CATEGORY_NOT_FOUND', 'Parent category not found in this organization', 404);
          }

          checkId = ancestor.parent_id;
        }

        // Validate max depth
        const parentDepth = await this.calculateNodeDepth(orgId, requestedParentId);
        const subtreeHeight = await this.getSubtreeHeight(categoryId);
        if (parentDepth + subtreeHeight - 1 > 5) {
          throw new AppError(
            'INVALID_CATEGORY_HIERARCHY',
            'Moving category exceeds maximum hierarchy depth of 5 levels',
            400
          );
        }
      }

      nextParentId = requestedParentId;
    }

    const updated = await this.db.category.update({
      where: { id: categoryId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.parentId !== undefined ? { parent_id: nextParentId } : {}),
        ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
        ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
      },
    });

    this.invalidateCache(orgId);
    return updated;
  }

  async deleteCategory(
    orgId: string,
    categoryId: string,
    reassignToCategoryId?: string
  ): Promise<{ success: true; reassignedProductCount: number }> {
    const category = await this.db.category.findFirst({
      where: { id: categoryId, org_id: orgId, is_deleted: false },
    });

    if (!category) {
      throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
    }

    const childCount = await this.db.category.count({
      where: { parent_id: categoryId, is_deleted: false },
    });

    if (childCount > 0) {
      throw new AppError(
        'CANNOT_DELETE_PARENT_CATEGORY',
        'Cannot delete a category that has subcategories. Delete or move subcategories first.',
        400
      );
    }

    const productCount = await this.db.product.count({
      where: { category_id: categoryId, org_id: orgId, is_deleted: false },
    });

    if (productCount > 0) {
      if (!reassignToCategoryId) {
        throw new AppError(
          'CATEGORY_HAS_PRODUCTS',
          `Cannot delete category "${category.name}" because it has ${productCount} assigned product${productCount > 1 ? 's' : ''}. Please reassign them to another category first.`,
          400,
          { productCount }
        );
      }

      if (reassignToCategoryId === categoryId) {
        throw new AppError(
          'INVALID_REASSIGNMENT_CATEGORY',
          'Cannot reassign products to the category being deleted',
          400
        );
      }

      const targetCategory = await this.db.category.findFirst({
        where: { id: reassignToCategoryId, org_id: orgId, is_deleted: false },
      });

      if (!targetCategory) {
        throw new AppError(
          'INVALID_REASSIGNMENT_CATEGORY',
          'Target category for reassignment not found or inactive',
          404
        );
      }

      // Reassign products and soft-delete category atomically in transaction
      await this.db.$transaction([
        this.db.product.updateMany({
          where: { category_id: categoryId, org_id: orgId, is_deleted: false },
          data: { category_id: reassignToCategoryId },
        }),
        this.db.category.update({
          where: { id: categoryId },
          data: {
            is_deleted: true,
            is_active: false,
            deleted_at: new Date(),
          },
        }),
      ]);

      this.invalidateCache(orgId);
      return { success: true, reassignedProductCount: productCount };
    }

    // No products assigned: soft-delete category
    await this.db.category.update({
      where: { id: categoryId },
      data: {
        is_deleted: true,
        is_active: false,
        deleted_at: new Date(),
      },
    });

    this.invalidateCache(orgId);
    return { success: true, reassignedProductCount: 0 };
  }

  async reorderCategories(
    orgId: string,
    parentId: string | null | undefined,
    categoryIds: string[]
  ): Promise<Category[]> {
    const targetParentId = parentId ?? null;

    const categories = await this.db.category.findMany({
      where: {
        id: { in: categoryIds },
        org_id: orgId,
        parent_id: targetParentId,
        is_deleted: false,
      },
    });

    if (categories.length !== categoryIds.length) {
      throw new AppError(
        'INVALID_CATEGORY_HIERARCHY',
        'All category IDs must belong to this organization and share the same parent',
        400
      );
    }

    await this.db.$transaction(
      categoryIds.map((id, index) =>
        this.db.category.update({
          where: { id },
          data: { sort_order: index },
        })
      )
    );

    this.invalidateCache(orgId);

    return await this.db.category.findMany({
      where: {
        id: { in: categoryIds },
        org_id: orgId,
      },
      orderBy: { sort_order: 'asc' },
    });
  }

  async toggleCategoryStatus(orgId: string, categoryId: string): Promise<Category> {
    const category = await this.db.category.findFirst({
      where: { id: categoryId, org_id: orgId, is_deleted: false },
    });

    if (!category) {
      throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
    }

    const updated = await this.db.category.update({
      where: { id: categoryId },
      data: { is_active: !category.is_active },
    });

    this.invalidateCache(orgId);
    return updated;
  }

  async seedDefaultCategories(orgId: string, businessType?: string | null): Promise<{ count: number }> {
    const specs = (businessType && DEFAULT_CATEGORIES_BY_BUSINESS_TYPE[businessType])
      ? DEFAULT_CATEGORIES_BY_BUSINESS_TYPE[businessType]
      : GENERIC_DEFAULT_CATEGORIES;

    const result = await this.db.category.createMany({
      data: specs.map((spec, index) => ({
        org_id: orgId,
        name: spec.name,
        slug: slugify(spec.name),
        description: spec.description ?? null,
        parent_id: null,
        sort_order: index,
        is_active: true,
      })),
      skipDuplicates: true,
    });

    this.invalidateCache(orgId);
    return { count: result.count };
  }

  async uploadCategoryImage(
    orgId: string,
    categoryId: string,
    file: { buffer: Buffer; mimeType: string }
  ): Promise<Category> {
    const category = await this.db.category.findFirst({
      where: { id: categoryId, org_id: orgId, is_deleted: false },
    });
    if (!category) {
      throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
    }

    const { url } = await imageUploadService.processAndSaveCategoryImage({
      orgId,
      categoryId,
      fileBuffer: file.buffer,
      mimeType: file.mimeType,
    });

    const updated = await this.db.category.update({
      where: { id: categoryId },
      data: { image_url: url },
    });

    this.invalidateCache(orgId);
    return updated;
  }

  async deleteCategoryImage(orgId: string, categoryId: string): Promise<Category> {
    const category = await this.db.category.findFirst({
      where: { id: categoryId, org_id: orgId, is_deleted: false },
    });
    if (!category) {
      throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
    }

    await imageUploadService.deleteCategoryImageFile({ orgId, categoryId });

    const updated = await this.db.category.update({
      where: { id: categoryId },
      data: { image_url: null },
    });

    this.invalidateCache(orgId);
    return updated;
  }
}
