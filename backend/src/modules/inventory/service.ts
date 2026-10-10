import type { PrismaClient, Branch, InventoryOnboarding } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { AppError } from '../../lib/errors.js';
import { inventoryCache } from '../../infrastructure/cache/in-memory-cache.js';
import type { InventoryBranchSetupInput, SaveOnboardingDraftInput } from './schemas.js';
import {
  DEFAULT_CATEGORIES_BY_BUSINESS_TYPE,
  GENERIC_DEFAULT_CATEGORIES,
} from './categories-schemas.js';
import { slugify } from './categories-service.js';

export interface InventoryOnboardingStatusResult {
  completed: boolean;
  status: 'pending' | 'completed';
  branch: Branch | null;
  branches: Branch[];
  stepData: unknown;
  organization: {
    id: string;
    name: string;
    subdomain: string;
    currency: string;
    timezone: string;
    businessEmail: string | null;
    phone: string | null;
  };
}

export class InventoryOnboardingService {
  constructor(private db: PrismaClient = defaultPrisma) {}

  async getStatus(orgId: string): Promise<InventoryOnboardingStatusResult> {
    const cacheKey = `inv_onb_status:${orgId}`;

    return await inventoryCache.fetchOrCompute(
      cacheKey,
      async () => {
        const org = await this.db.organization.findUnique({
          where: { id: orgId },
          include: {
            inventory_onboarding: {
              include: {
                branch: true,
              },
            },
            branches: {
              where: { status: 'active' },
              orderBy: { created_at: 'asc' },
            },
          },
        });

        if (!org) {
          throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);
        }

        const onboarding = org.inventory_onboarding;
        const isCompleted = onboarding?.status === 'completed';
        const activeBranch = onboarding?.branch ?? org.branches[0] ?? null;

        return {
          completed: isCompleted,
          status: isCompleted ? 'completed' : 'pending',
          branch: activeBranch,
          branches: org.branches,
          stepData: onboarding?.step_data ?? null,
          organization: {
            id: org.id,
            name: org.name,
            subdomain: org.subdomain,
            currency: org.currency,
            timezone: org.timezone,
            businessEmail: org.business_email,
            phone: org.phone,
          },
        };
      },
      30_000 // Cache for 30s
    );
  }

  async saveDraft(
    orgId: string,
    userId: string,
    input: SaveOnboardingDraftInput
  ): Promise<{ success: boolean; onboarding: InventoryOnboarding }> {
    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      include: {
        memberships: {
          where: { user_id: userId, status: 'active' },
        },
      },
    });

    if (!org) {
      throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);
    }

    const membership = org.memberships[0];
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new AppError(
        'FORBIDDEN',
        'Only organization owners and administrators can save inventory onboarding progress',
        403
      );
    }

    const onboarding = await this.db.inventoryOnboarding.upsert({
      where: { org_id: orgId },
      create: {
        org_id: orgId,
        status: 'pending',
        step_data: {
          currentStep: input.currentStep,
          ...input.stepData,
        },
      },
      update: {
        status: 'pending',
        step_data: {
          currentStep: input.currentStep,
          ...input.stepData,
        },
      },
    });

    // Invalidate status cache on draft save
    inventoryCache.clearPrefix(`inv_onb_status:${orgId}`);

    return {
      success: true,
      onboarding,
    };
  }

  async completeBranchSetup(
    orgId: string,
    userId: string,
    input: InventoryBranchSetupInput
  ): Promise<{ success: boolean; branch: Branch; onboarding: InventoryOnboarding }> {
    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      include: {
        memberships: {
          where: { user_id: userId, status: 'active' },
          include: { user: true },
        },
      },
    });

    if (!org) {
      throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);
    }

    const membership = org.memberships[0];
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new AppError(
        'FORBIDDEN',
        'Only organization owners and administrators can configure initial inventory branches',
        403
      );
    }

    // Resolve branch email and phone
    const branchEmail = input.useOrgEmail
      ? org.business_email || membership.user.email
      : input.branchEmail || org.business_email || membership.user.email;

    const branchPhone = input.useOrgPhone
      ? org.phone || membership.user.phone
      : input.branchPhone || org.phone || membership.user.phone;

    return await this.db.$transaction(async (tx) => {
      // 1. Create or update primary branch for this inventory setup
      const existingBranch = await tx.branch.findFirst({
        where: {
          org_id: orgId,
          name: { equals: input.branchName.trim(), mode: 'insensitive' },
        },
      });

      let branch: Branch;
      if (existingBranch) {
        branch = await tx.branch.update({
          where: { id: existingBranch.id },
          data: {
            name: input.branchName.trim(),
            code: input.branchCode.toUpperCase(),
            type: 'store',
            email: branchEmail,
            phone: branchPhone,
            address: input.address,
            is_primary: true,
            status: 'active',
            product_key: 'inventory',
          },
        });
      } else {
        // Demote previous primary flags if any
        await tx.branch.updateMany({
          where: { org_id: orgId, is_primary: true },
          data: { is_primary: false },
        });

        branch = await tx.branch.create({
          data: {
            org_id: orgId,
            name: input.branchName.trim(),
            code: input.branchCode.toUpperCase(),
            type: 'store',
            email: branchEmail,
            phone: branchPhone,
            address: input.address,
            is_primary: true,
            status: 'active',
            product_key: 'inventory',
          },
        });
      }

      // 2. Upsert InventoryOnboarding record
      const fullStepData = {
        businessType: input.businessType,
        businessDescription: input.businessDescription,
        branchName: input.branchName,
        branchCode: input.branchCode,
        useOrgEmail: input.useOrgEmail,
        branchEmail,
        useOrgPhone: input.useOrgPhone,
        branchPhone,
        address: input.address,
        currency: input.currency,
      };

      const onboarding = await tx.inventoryOnboarding.upsert({
        where: { org_id: orgId },
        create: {
          org_id: orgId,
          branch_id: branch.id,
          status: 'completed',
          completed_at: new Date(),
          step_data: fullStepData,
        },
        update: {
          branch_id: branch.id,
          status: 'completed',
          completed_at: new Date(),
          step_data: fullStepData,
        },
      });

      // 3. Ensure WorkspaceProduct for inventory exists and is active
      await tx.workspaceProduct.upsert({
        where: {
          org_id_product_key: {
            org_id: orgId,
            product_key: 'inventory',
          },
        },
        create: {
          org_id: orgId,
          product_key: 'inventory',
          status: 'active',
          is_primary: true,
        },
        update: {
          status: 'active',
        },
      });

      // 4. Record audit log
      await tx.auditLog.create({
        data: {
          org_id: orgId,
          user_id: userId,
          event: 'inventory_onboarding_completed',
          status: 'success',
          metadata: {
            branchId: branch.id,
            branchName: branch.name,
            branchCode: branch.code,
            businessType: input.businessType,
          },
        },
      });

      // 5. Seed default categories based on businessType if none exist yet
      const defaultCategories =
        DEFAULT_CATEGORIES_BY_BUSINESS_TYPE[input.businessType] || GENERIC_DEFAULT_CATEGORIES;

      const existingCount = await tx.category.count({
        where: { org_id: orgId },
      });

      if (existingCount === 0 && defaultCategories.length > 0) {
        await tx.category.createMany({
          data: defaultCategories.map((cat, index) => ({
            org_id: orgId,
            name: cat.name,
            slug: slugify(cat.name),
            description: cat.description ?? null,
            parent_id: null,
            sort_order: index,
            is_active: true,
          })),
          skipDuplicates: true,
        });
      }

      // Invalidate status and categories cache on setup completion
      inventoryCache.clearPrefix(`inv_onb_status:${orgId}`);
      inventoryCache.clearPrefix(`categories_tree:${orgId}`);

      return {
        success: true,
        branch,
        onboarding,
      };
    }, { maxWait: 15000, timeout: 30000 });
  }
}
