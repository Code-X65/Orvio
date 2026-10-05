import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { emailSender as defaultEmailSender, type EmailSender } from '../email/index.js';
import { AppError } from '../../lib/errors.js';
import { generateOpaqueToken, hashToken } from '../../lib/tokens.js';
import { deriveSubdomain, nextAvailableCandidates, assertValidSubdomain } from '../organizations/subdomain.js';
import { PRODUCT_CATALOG, type OrganizationFlowStep } from './constants.js';

export class OnboardingService {
  constructor(
    private db: PrismaClient = defaultPrisma,
    private emailSvc: EmailSender = defaultEmailSender
  ) {}

  async getOrganizationFlow(userId: string) {
    // 1. Find user's current membership
    const membership = await this.db.membership.findFirst({
      where: { user_id: userId },
      include: {
        organization: {
          include: {
            products: true,
            branches: { where: { is_primary: true } },
            onboarding_flow: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!membership || !membership.organization) {
      return {
        flow: null,
        organization: null,
        products: [],
        primaryBranch: null,
        catalog: PRODUCT_CATALOG,
        isCompleted: false,
      };
    }

    const org = membership.organization;
    const flow = org.onboarding_flow;

    const isCompleted = flow?.status === 'completed' || org.status === 'active';

    return {
      flow: flow
        ? {
            id: flow.id,
            currentStep: flow.current_step,
            stepData: flow.step_data ?? {},
            status: flow.status,
            completedAt: flow.completed_at,
          }
        : null,
      organization: {
        id: org.id,
        name: org.name,
        subdomain: org.subdomain,
        businessType: org.business_type,
        description: org.description,
        logoUrl: org.logo_url,
        country: org.country,
        currency: org.currency,
        timezone: org.timezone,
        businessEmail: org.business_email,
        phone: org.phone,
        website: org.website,
        planCode: org.plan_code,
        status: org.status,
      },
      products: org.products.map((p) => ({
        id: p.id,
        productKey: p.product_key,
        status: p.status,
        isPrimary: p.is_primary,
      })),
      primaryBranch: org.branches[0] ?? null,
      catalog: PRODUCT_CATALOG,
      isCompleted,
    };
  }

  async updateStep(userId: string, step: OrganizationFlowStep, payload: any) {
    // 1. Find user's existing membership and organization
    const existingMembership = await this.db.membership.findFirst({
      where: { user_id: userId },
      include: { organization: { include: { onboarding_flow: true, products: true, branches: true } } },
      orderBy: { created_at: 'desc' },
    });

    // Step 1: Organization Basics
    if (step === 'organization_basics') {
      const orgName = String(payload.organizationName || '').trim();
      const businessType = String(payload.businessType || '').trim();
      const description = payload.description ? String(payload.description).trim() : null;
      const logoUrl = payload.logoUrl ? String(payload.logoUrl).trim() : null;

      if (!orgName || orgName.length < 2) {
        throw new AppError('VALIDATION_ERROR', 'Organization Name must be at least 2 characters', 400);
      }

      if (existingMembership?.organization) {
        const org = existingMembership.organization;
        // Update existing org
        const updatedOrg = await this.db.organization.update({
          where: { id: org.id },
          data: {
            name: orgName,
            business_type: businessType,
            description,
            logo_url: logoUrl,
          },
        });

        const updatedFlow = await this.db.onboardingFlow.upsert({
          where: { org_id: org.id },
          create: {
            org_id: org.id,
            current_step: 'business_details',
            step_data: { organization_basics: payload },
          },
          update: {
            current_step: 'business_details',
            step_data: {
              ...((org.onboarding_flow?.step_data as object) ?? {}),
              organization_basics: payload,
            },
          },
        });

        return { organization: updatedOrg, flow: updatedFlow };
      } else {
        // Create new Organization atomically
        let cleanSubdomain = deriveSubdomain(orgName);
        if (cleanSubdomain.length < 3) cleanSubdomain = `${cleanSubdomain}org`;
        
        // Ensure subdomain uniqueness
        const subExists = await this.db.organization.findUnique({ where: { subdomain: cleanSubdomain } });
        if (subExists) {
          const candidates = nextAvailableCandidates(cleanSubdomain, 1);
          cleanSubdomain = candidates[0] || `${cleanSubdomain}${Math.floor(100 + Math.random() * 900)}`;
        }

        return await this.db.$transaction(async (tx) => {
          const org = await tx.organization.create({
            data: {
              name: orgName,
              subdomain: cleanSubdomain,
              business_type: businessType,
              description,
              logo_url: logoUrl,
              status: 'pending',
              plan_code: 'free',
              country: 'NG',
              currency: 'NGN',
              timezone: 'Africa/Lagos',
            },
          });

          await tx.membership.create({
            data: {
              org_id: org.id,
              user_id: userId,
              role: 'owner',
              status: 'active',
            },
          });

          const flow = await tx.onboardingFlow.create({
            data: {
              org_id: org.id,
              current_step: 'business_details',
              step_data: { organization_basics: payload },
              status: 'in_progress',
            },
          });

          return { organization: org, flow };
        });
      }
    }

    // For all subsequent steps, organization must exist and user must be owner/admin
    if (!existingMembership || !existingMembership.organization) {
      throw new AppError('ORGANIZATION_NOT_FOUND', 'Please complete Step 1 (Organization Basics) first', 400);
    }

    const org = existingMembership.organization;

    // Step 2: Business Details
    if (step === 'business_details') {
      const { country = 'NG', currency = 'NGN', timezone = 'Africa/Lagos', phone, businessEmail, website } = payload;

      const updatedOrg = await this.db.organization.update({
        where: { id: org.id },
        data: {
          country,
          currency,
          timezone,
          phone: phone || null,
          business_email: businessEmail || null,
          website: website || null,
        },
      });

      const updatedFlow = await this.db.onboardingFlow.upsert({
        where: { org_id: org.id },
        create: {
          org_id: org.id,
          current_step: 'application_selection',
          step_data: { business_details: payload },
        },
        update: {
          current_step: 'application_selection',
          step_data: {
            ...((org.onboarding_flow?.step_data as object) ?? {}),
            business_details: payload,
          },
        },
      });

      return { organization: updatedOrg, flow: updatedFlow };
    }

    // Step 3: Application Selection
    if (step === 'application_selection') {
      const { selectedProductKeys = [], primaryProductKey } = payload;

      if (!Array.isArray(selectedProductKeys) || selectedProductKeys.length === 0) {
        throw new AppError('VALIDATION_ERROR', 'At least one application must be selected', 400);
      }

      if (!selectedProductKeys.includes(primaryProductKey)) {
        throw new AppError('VALIDATION_ERROR', 'Primary application must be included in selected applications', 400);
      }

      await this.db.$transaction(async (tx) => {
        // Remove existing products that were deselected
        await tx.workspaceProduct.deleteMany({
          where: {
            org_id: org.id,
            product_key: { notIn: selectedProductKeys },
          },
        });

        // Upsert selected products: primary -> active, secondary -> setup_intent
        for (const prodKey of selectedProductKeys) {
          const isPrimary = prodKey === primaryProductKey;
          const status = isPrimary ? 'active' : 'setup_intent';

          await tx.workspaceProduct.upsert({
            where: {
              org_id_product_key: {
                org_id: org.id,
                product_key: prodKey,
              },
            },
            create: {
              org_id: org.id,
              product_key: prodKey,
              status,
              is_primary: isPrimary,
            },
            update: {
              status,
              is_primary: isPrimary,
            },
          });
        }
      });

      const updatedFlow = await this.db.onboardingFlow.upsert({
        where: { org_id: org.id },
        create: {
          org_id: org.id,
          current_step: 'primary_branch',
          step_data: { application_selection: payload },
        },
        update: {
          current_step: 'primary_branch',
          step_data: {
            ...((org.onboarding_flow?.step_data as object) ?? {}),
            application_selection: payload,
          },
        },
      });

      const products = await this.db.workspaceProduct.findMany({ where: { org_id: org.id } });
      return { organization: org, products, flow: updatedFlow };
    }

    // Step 4: Primary Branch
    if (step === 'primary_branch') {
      const { name, address, phone, email, type = 'store', productKey } = payload;

      const branchType = type === 'studio' ? 'studio' : 'store';

      const branch = await this.db.branch.upsert({
        where: {
          id: org.branches.find((b) => b.is_primary)?.id ?? 'non-existent-cuid',
        },
        create: {
          org_id: org.id,
          name: name || `${org.name} Main Branch`,
          type: branchType,
          product_key: productKey || 'inventory',
          is_primary: true,
          status: 'active',
          address,
          phone: phone || null,
          email: email || null,
        },
        update: {
          name: name || `${org.name} Main Branch`,
          type: branchType,
          address,
          phone: phone || null,
          email: email || null,
        },
      });

      const updatedFlow = await this.db.onboardingFlow.upsert({
        where: { org_id: org.id },
        create: {
          org_id: org.id,
          current_step: 'team_invites',
          step_data: { primary_branch: payload },
        },
        update: {
          current_step: 'team_invites',
          step_data: {
            ...((org.onboarding_flow?.step_data as object) ?? {}),
            primary_branch: payload,
          },
        },
      });

      return { organization: org, branch, flow: updatedFlow };
    }

    // Step 5: Team Invites
    if (step === 'team_invites') {
      const { invites = [], skipped = false } = payload;

      let inviteResults: Array<{ email: string; status: 'sent' | 'skipped' | 'failed'; error?: string }> = [];

      if (!skipped && Array.isArray(invites) && invites.length > 0) {
        inviteResults = await this.sendBulkInvitations(org.id, userId, invites);
      }

      const updatedFlow = await this.db.onboardingFlow.upsert({
        where: { org_id: org.id },
        create: {
          org_id: org.id,
          current_step: 'completed',
          step_data: { team_invites: { skipped, count: invites.length, results: inviteResults } },
        },
        update: {
          current_step: 'completed',
          step_data: {
            ...((org.onboarding_flow?.step_data as object) ?? {}),
            team_invites: { skipped, count: invites.length, results: inviteResults },
          },
        },
      });

      return { organization: org, invites: inviteResults, flow: updatedFlow };
    }

    throw new AppError('INVALID_STEP', `Step ${step} is not recognized`, 400);
  }

  async completeFlow(userId: string) {
    const membership = await this.db.membership.findFirst({
      where: { user_id: userId, role: 'owner' },
      include: { organization: { include: { onboarding_flow: true, products: true, branches: true } } },
    });

    if (!membership || !membership.organization) {
      throw new AppError('ORGANIZATION_NOT_FOUND', 'No active organization found for this user', 404);
    }

    const org = membership.organization;

    // Verify required steps: organization_basics and application_selection
    const activeProducts = org.products.filter((p) => p.status === 'active');
    if (activeProducts.length === 0) {
      throw new AppError('INCOMPLETE_ONBOARDING', 'Please select and activate at least one primary application', 400);
    }

    // Update flow & organization
    const completedAt = new Date();
    await this.db.$transaction([
      this.db.onboardingFlow.upsert({
        where: { org_id: org.id },
        create: {
          org_id: org.id,
          current_step: 'completed',
          status: 'completed',
          completed_at: completedAt,
        },
        update: {
          current_step: 'completed',
          status: 'completed',
          completed_at: completedAt,
        },
      }),
      this.db.organization.update({
        where: { id: org.id },
        data: {
          status: 'active',
        },
      }),
    ]);

    return {
      success: true,
      message: 'Organization onboarding journey completed successfully',
      organization: {
        id: org.id,
        name: org.name,
        subdomain: org.subdomain,
        status: 'active',
      },
    };
  }

  async sendBulkInvitations(
    orgId: string,
    inviterId: string,
    invites: Array<{ email: string; role: 'admin' | 'member'; productRoles?: Record<string, string>; branchIds?: string[] }>
  ) {
    const results: Array<{ email: string; status: 'sent' | 'skipped' | 'failed'; error?: string }> = [];

    const org = await this.db.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);

    for (const item of invites) {
      const cleanEmail = item.email.toLowerCase().trim();
      try {
        // Check if user is already a member
        const existingMember = await this.db.membership.findFirst({
          where: {
            org_id: orgId,
            user: { email: cleanEmail },
          },
        });

        if (existingMember) {
          results.push({ email: cleanEmail, status: 'skipped', error: 'User is already a member of this organization' });
          continue;
        }

        const { rawToken, tokenHash } = generateOpaqueToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await this.db.workspaceInvitation.upsert({
          where: { token_hash: tokenHash },
          create: {
            org_id: orgId,
            email: cleanEmail,
            role: item.role === 'admin' ? 'admin' : 'member',
            product_roles: item.productRoles ? (item.productRoles as any) : undefined,
            branch_ids: item.branchIds ? (item.branchIds as any) : undefined,
            token_hash: tokenHash,
            invited_by_id: inviterId,
            expires_at: expiresAt,
            status: 'pending',
          },
          update: {
            role: item.role === 'admin' ? 'admin' : 'member',
            product_roles: item.productRoles ? (item.productRoles as any) : undefined,
            branch_ids: item.branchIds ? (item.branchIds as any) : undefined,
            token_hash: tokenHash,
            expires_at: expiresAt,
            status: 'pending',
          },
        });

        // Dispatch invitation email
        await this.emailSvc.send({
          to: [{ email: cleanEmail }],
          subject: `You have been invited to join ${org.name} on Orvio`,
          htmlContent: `<p>You have been invited to join <strong>${org.name}</strong> as <strong>${item.role}</strong>.</p><p><a href="http://localhost:4000/invite?token=${rawToken}">Accept Invitation</a></p>`,
        });

        results.push({ email: cleanEmail, status: 'sent' });
      } catch (err: any) {
        results.push({ email: cleanEmail, status: 'failed', error: err.message || 'Failed to send invite' });
      }
    }

    return results;
  }
}

