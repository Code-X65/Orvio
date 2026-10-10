import type { PrismaClient, Organization, Membership, Branch, WorkspaceProduct } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import {
  deriveSubdomain,
  assertValidSubdomain,
  nextAvailableCandidates,
  validateSubdomain,
} from './subdomain.js';
import { AppError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { defaultAppCache } from '../../infrastructure/cache/in-memory-cache.js';

export interface SubdomainAvailabilityResult {
  available: boolean;
  subdomain: string;
  reason?: 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_CHARACTERS' | 'RESERVED' | 'ALREADY_TAKEN';
  suggestions?: string[];
}

export interface CreateOrgWithOwnerParams {
  name: string;
  subdomain: string;
  planCode?: string;
  timezone?: string;
  currency?: string;
  ownerUserId: string;
}

export interface OrganizationDetailsResult {
  organization: Organization & { url: string; products: WorkspaceProduct[] };
  membership: Membership | null;
  branch: Branch | null;
  branches: Branch[];
  products: WorkspaceProduct[];
}

export class OrgService {
  constructor(private db: PrismaClient = defaultPrisma) {}

  private computeOrgUrl(subdomain: string): string {
    const protocol = env.NODE_ENV === 'production' ? 'https' : 'http';
    return `${protocol}://${subdomain}.${env.APP_BASE_DOMAIN}`;
  }

  async findAvailability(rawSubdomain: string): Promise<SubdomainAvailabilityResult> {
    const subdomain = deriveSubdomain(rawSubdomain);
    const validation = validateSubdomain(subdomain);

    if (!validation.valid) {
      return {
        available: false,
        subdomain,
        reason: validation.reason,
        suggestions: nextAvailableCandidates(subdomain),
      };
    }

    const cacheKey = `subdomain_avail:${subdomain}`;
    return await defaultAppCache.fetchOrCompute(
      cacheKey,
      async () => {
        const existing = await this.db.organization.findUnique({
          where: { subdomain },
          select: { id: true },
        });

        if (existing) {
          return {
            available: false,
            subdomain,
            reason: 'ALREADY_TAKEN',
            suggestions: nextAvailableCandidates(subdomain),
          };
        }

        return {
          available: true,
          subdomain,
        };
      },
      10_000 // 10s TTL
    );
  }

  // Backwards compatible method name
  async checkSubdomainAvailability(rawSubdomain: string): Promise<SubdomainAvailabilityResult> {
    return this.findAvailability(rawSubdomain);
  }

  async getPublicOrgInfo(rawSubdomain: string): Promise<{
    exists: boolean;
    name?: string;
    subdomain: string;
    status?: string;
  }> {
    const subdomain = deriveSubdomain(rawSubdomain);
    const cacheKey = `public_org_info:${subdomain}`;

    return await defaultAppCache.fetchOrCompute(
      cacheKey,
      async () => {
        const org = await this.db.organization.findUnique({
          where: { subdomain },
          select: {
            id: true,
            name: true,
            subdomain: true,
            status: true,
          },
        });

        if (!org) {
          return { exists: false, subdomain };
        }

        return {
          exists: true,
          name: org.name,
          subdomain: org.subdomain,
          status: org.status,
        };
      },
      60_000 // 60s TTL
    );
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    return this.db.organization.findUnique({
      where: { id },
    });
  }

  async getOrganizationDetails(orgId: string, userId: string): Promise<OrganizationDetailsResult> {
    const cacheKey = `org_details:${orgId}:${userId}`;

    return await defaultAppCache.fetchOrCompute(
      cacheKey,
      async () => {
        const org = await this.db.organization.findUnique({
          where: { id: orgId },
          include: {
            branches: {
              orderBy: { created_at: 'asc' },
            },
            products: {
              orderBy: { created_at: 'asc' },
            },
          },
        });

        if (!org) {
          throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);
        }

        const membership = await this.db.membership.findFirst({
          where: {
            org_id: orgId,
            user_id: userId,
          },
        });

        const defaultBranch = org.branches.find((b) => b.type === 'store') ?? org.branches[0] ?? null;
        const orgUrl = this.computeOrgUrl(org.subdomain);

        return {
          organization: {
            ...org,
            url: orgUrl,
          },
          membership,
          branch: defaultBranch,
          branches: org.branches,
          products: org.products,
        };
      },
      30_000 // 30s TTL
    );
  }

  async addProduct(orgId: string, productKey: string): Promise<WorkspaceProduct[]> {
    const cleanKey = productKey.toLowerCase().trim();
    const existing = await this.db.workspaceProduct.findUnique({
      where: {
        org_id_product_key: {
          org_id: orgId,
          product_key: cleanKey,
        },
      },
    });

    if (!existing) {
      const existingProducts = await this.db.workspaceProduct.count({ where: { org_id: orgId } });
      await this.db.workspaceProduct.create({
        data: {
          org_id: orgId,
          product_key: cleanKey,
          status: 'active',
          is_primary: existingProducts === 0,
        },
      });
    }

    // Invalidate cached organization details
    defaultAppCache.clearPrefix(`org_details:${orgId}`);

    return this.db.workspaceProduct.findMany({
      where: { org_id: orgId },
      orderBy: { created_at: 'asc' },
    });
  }

  async removeProduct(orgId: string, productKey: string): Promise<WorkspaceProduct[]> {
    const cleanKey = productKey.toLowerCase().trim();
    const currentProducts = await this.db.workspaceProduct.findMany({
      where: { org_id: orgId },
    });

    if (currentProducts.length <= 1) {
      throw new AppError('VALIDATION_ERROR', 'Organization must have at least one active application', 400);
    }

    const target = currentProducts.find((p) => p.product_key === cleanKey);
    if (!target) {
      return currentProducts;
    }

    await this.db.$transaction(async (tx) => {
      await tx.workspaceProduct.delete({
        where: {
          org_id_product_key: {
            org_id: orgId,
            product_key: cleanKey,
          },
        },
      });

      // If removed product was primary, promote the first remaining product
      if (target.is_primary) {
        const remaining = currentProducts.filter((p) => p.product_key !== cleanKey);
        if (remaining[0]) {
          await tx.workspaceProduct.update({
            where: { id: remaining[0].id },
            data: { is_primary: true },
          });
        }
      }
    });

    // Invalidate cached organization details
    defaultAppCache.clearPrefix(`org_details:${orgId}`);

    return this.db.workspaceProduct.findMany({
      where: { org_id: orgId },
      orderBy: { created_at: 'asc' },
    });
  }

  async setPrimaryProduct(orgId: string, productKey: string): Promise<WorkspaceProduct[]> {
    const cleanKey = productKey.toLowerCase().trim();
    
    await this.db.$transaction(async (tx) => {
      await tx.workspaceProduct.updateMany({
        where: { org_id: orgId },
        data: { is_primary: false },
      });

      await tx.workspaceProduct.update({
        where: {
          org_id_product_key: {
            org_id: orgId,
            product_key: cleanKey,
          },
        },
        data: { is_primary: true },
      });
    });

    // Invalidate cached organization details
    defaultAppCache.clearPrefix(`org_details:${orgId}`);

    return this.db.workspaceProduct.findMany({
      where: { org_id: orgId },
      orderBy: { created_at: 'asc' },
    });
  }

  async updateProductSettings(
    orgId: string,
    productKey: string,
    newSettings: Record<string, any>
  ): Promise<WorkspaceProduct> {
    const cleanKey = productKey.toLowerCase().trim();
    const existing = await this.db.workspaceProduct.findUnique({
      where: {
        org_id_product_key: {
          org_id: orgId,
          product_key: cleanKey,
        },
      },
    });

    if (!existing) {
      throw new AppError('PRODUCT_NOT_INSTALLED', `Application module "${cleanKey}" is not installed in this workspace`, 404);
    }

    const currentSettings = (existing.settings && typeof existing.settings === 'object' ? existing.settings : {}) as Record<string, any>;
    const mergedSettings = { ...currentSettings, ...newSettings };

    const updated = await this.db.workspaceProduct.update({
      where: {
        org_id_product_key: {
          org_id: orgId,
          product_key: cleanKey,
        },
      },
      data: {
        settings: mergedSettings,
        updated_at: new Date(),
      },
    });

    // Invalidate cached organization details
    defaultAppCache.clearPrefix(`org_details:${orgId}`);

    return updated;
  }

  async listMembers(orgId: string): Promise<{
    members: Array<{
      id: string;
      fullName: string;
      email: string;
      role: string;
      status: string;
      createdAt: string;
    }>;
    count: number;
  }> {
    const cacheKey = `org_members:${orgId}`;

    return await defaultAppCache.fetchOrCompute(
      cacheKey,
      async () => {
        const memberships = await this.db.membership.findMany({
          where: { org_id: orgId },
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
                email: true,
                status: true,
              },
            },
          },
          orderBy: { created_at: 'asc' },
        });

        return {
          count: memberships.length,
          members: memberships.map((m) => ({
            id: m.id,
            fullName: m.user.full_name,
            email: m.user.email,
            role: m.role,
            status: m.status,
            createdAt: m.created_at.toISOString(),
          })),
        };
      },
      20_000 // 20s TTL
    );
  }

  async createOrganizationWithOwner(params: CreateOrgWithOwnerParams): Promise<Organization> {
    assertValidSubdomain(params.subdomain);

    const result = await this.db.$transaction(async (tx) => {
      const existing = await tx.organization.findUnique({
        where: { subdomain: params.subdomain },
      });
      if (existing) {
        throw new AppError('SUBDOMAIN_TAKEN', 'Organization subdomain is already taken', 409);
      }

      const initialProductKey = params.planCode === 'gym' ? 'gym' : 'inventory';

      const org = await tx.organization.create({
        data: {
          name: params.name.trim(),
          subdomain: params.subdomain,
          status: 'pending',
          plan_code: params.planCode ?? 'bundle',
          timezone: params.timezone ?? 'Africa/Lagos',
          currency: params.currency ?? 'NGN',
        },
      });

      await tx.membership.create({
        data: {
          org_id: org.id,
          user_id: params.ownerUserId,
          role: 'owner',
          status: 'active',
        },
      });

      await tx.branch.create({
        data: {
          org_id: org.id,
          name: params.name,
          type: initialProductKey === 'gym' ? 'studio' : 'store',
          product_key: initialProductKey,
          is_primary: true,
          status: 'active',
        },
      });

      await tx.workspaceProduct.create({
        data: {
          org_id: org.id,
          product_key: initialProductKey,
          status: 'active',
          is_primary: true,
        },
      });

      return org;
    });

    // Invalidate subdomain availability and public info
    defaultAppCache.delete(`subdomain_avail:${params.subdomain}`);
    defaultAppCache.delete(`public_org_info:${params.subdomain}`);

    return result;
  }
}

export const orgService = new OrgService();
