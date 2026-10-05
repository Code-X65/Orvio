import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { emailSender as defaultEmailSender, type EmailSender } from '../email/index.js';
import {
  assertValidSubdomain,
  deriveSubdomain,
  nextAvailableCandidates,
} from '../organizations/subdomain.js';
import { hashPassword, verifyPassword, assertPasswordPolicy } from '../../lib/password.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  generateOpaqueToken,
} from '../../lib/tokens.js';
import { issueVerificationToken, verifyAndConsumeToken, checkResendCooldown, invalidateUserTokens } from './verification.js';
import { createVerifyEmailTemplate } from './templates/verify-email.js';
import { createWelcomeEmailTemplate } from './templates/welcome.js';
import { createResetPasswordTemplate } from './templates/reset-password.js';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import crypto from 'node:crypto';
import type { RegisterInput } from './schemas.js';
import type { StartTrialInput, SetupPasswordAndVerifyInput } from './trial.schema.js';

export function getTenantUrl(subdomain: string): string {
  const protocol = env.NODE_ENV === 'production' ? 'https' : 'http';
  return `${protocol}://${subdomain}.${env.APP_BASE_DOMAIN}`;
}

function normalizeNigerianPhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `+234${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+234${digits}`;
  }
  if (trimmed.startsWith('+')) {
    return trimmed.replace(/\s+/g, '');
  }
  return `+234${digits}`;
}

export class AuthService {
  constructor(
    private db: PrismaClient = defaultPrisma,
    private emailSvc: EmailSender = defaultEmailSender
  ) {}

  async startTrial(input: StartTrialInput, ip?: string) {
    const email = input.email.toLowerCase().trim();
    const cleanPhone = normalizeNigerianPhone(input.phone);
    
    // Derive subdomain from organizationName if not passed
    let cleanSubdomain = input.subdomain ? deriveSubdomain(input.subdomain) : deriveSubdomain(input.organizationName);
    if (cleanSubdomain.length < 3) {
      cleanSubdomain = `${cleanSubdomain}org`;
    }

    assertValidSubdomain(cleanSubdomain);

    // If password provided, validate policy; otherwise generate secure random placeholder
    const rawPassword = input.password ? input.password : crypto.randomBytes(32).toString('hex');
    if (input.password) {
      assertPasswordPolicy(input.password);
    }

    // 2. Validate email, phone & subdomain uniqueness before transaction
    const [existingUser, existingPhone, existingOrg] = await Promise.all([
      this.db.user.findUnique({
        where: { email },
        include: {
          memberships: {
            include: { organization: true },
          },
        },
      }),
      this.db.user.findFirst({ where: { phone: cleanPhone } }),
      this.db.organization.findUnique({ where: { subdomain: cleanSubdomain } }),
    ]);

    // Check if organization subdomain is already taken
    const isOwnedBySameUnverifiedUser =
      Boolean(
        existingUser &&
        existingOrg &&
        !existingUser.email_verified_at &&
        existingUser.memberships.some((m) => m.org_id === existingOrg.id)
      );

    if (existingOrg && !isOwnedBySameUnverifiedUser) {
      const suggestions = nextAvailableCandidates(cleanSubdomain, 3);
      throw new AppError('SUBDOMAIN_TAKEN', 'This organization subdomain is already taken', 409, {
        field: 'subdomain',
        suggestions,
      });
    }

    // If user already exists (and not resuming their exact unverified organization)
    if (existingUser && !isOwnedBySameUnverifiedUser) {
      throw new AppError('DUPLICATE_EMAIL', 'An account with this email address already exists. Please log in.', 409, {
        field: 'email',
      });
    }

    // If phone is used by another user, block
    if (existingPhone && existingPhone.id !== existingUser?.id) {
      throw new AppError('DUPLICATE_PHONE', 'An account with this phone number already exists', 409, {
        field: 'phone',
      });
    }

    // 3. Hash password with Argon2id
    const password_hash = await hashPassword(rawPassword);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14-day free trial

    const primaryApp = input.primaryApp || 'inventory';
    const uniqueApps = Array.from(new Set(input.selectedApps));

    // 4. Atomic Prisma Transaction creating User, Org, Membership, Branch, Products, and Flow
    const result = await this.db.$transaction(
      async (tx) => {
        const computedFullName =
          input.fullName?.trim() ||
          `${input.firstName?.trim() || ''} ${input.lastName?.trim() || ''}`.trim();

        // Create or update unverified user
        const user = existingUser
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: {
                full_name: computedFullName,
                password_hash,
                phone: cleanPhone,
                status: 'active',
                ...(ip ? { last_login_ip: ip } : {}),
              },
            })
          : await tx.user.create({
              data: {
                email,
                password_hash,
                full_name: computedFullName,
                phone: cleanPhone,
                status: 'active',
                email_verified_at: null, // explicit null until magic link setup
                ...(ip ? { last_login_ip: ip } : {}),
              },
            });

        // Create or update organization
        const org = existingOrg && isOwnedBySameUnverifiedUser
          ? await tx.organization.update({
              where: { id: existingOrg.id },
              data: {
                name: input.organizationName.trim(),
                status: 'active',
                plan_code: 'trial',
                trial_ends_at: trialEndsAt,
                description: input.organizationSize ? `Organization size: ${input.organizationSize}` : undefined,
              },
            })
          : await tx.organization.create({
              data: {
                name: input.organizationName.trim(),
                subdomain: cleanSubdomain,
                status: 'active',
                plan_code: 'trial',
                trial_ends_at: trialEndsAt,
                timezone: 'Africa/Lagos',
                currency: 'NGN',
                country: input.country || 'NG',
                description: input.organizationSize ? `Organization size: ${input.organizationSize}` : undefined,
              },
            });

        // Create or ensure membership
        const membership = await tx.membership.upsert({
          where: {
            org_id_user_id: {
              org_id: org.id,
              user_id: user.id,
            },
          },
          create: {
            org_id: org.id,
            user_id: user.id,
            role: 'owner',
            status: 'active',
          },
          update: {
            role: 'owner',
            status: 'active',
          },
        });

        // Create or update primary branch
        const existingBranch = await tx.branch.findFirst({
          where: { org_id: org.id, is_primary: true },
        });

        const branch = existingBranch
          ? await tx.branch.update({
              where: { id: existingBranch.id },
              data: {
                name: `${input.organizationName.trim()} Main Branch`,
                type: primaryApp === 'gym' ? 'studio' : 'store',
                product_key: primaryApp,
                status: 'active',
              },
            })
          : await tx.branch.create({
              data: {
                org_id: org.id,
                name: `${input.organizationName.trim()} Main Branch`,
                type: primaryApp === 'gym' ? 'studio' : 'store',
                product_key: primaryApp,
                is_primary: true,
                status: 'active',
              },
            });

        // Create or upsert Workspace Products for unique selected apps
        for (const appKey of uniqueApps) {
          await tx.workspaceProduct.upsert({
            where: {
              org_id_product_key: {
                org_id: org.id,
                product_key: appKey,
              },
            },
            create: {
              org_id: org.id,
              product_key: appKey,
              status: 'active',
              is_primary: appKey === primaryApp,
            },
            update: {
              status: 'active',
              is_primary: appKey === primaryApp,
            },
          });
        }

        await tx.onboardingFlow.upsert({
          where: { org_id: org.id },
          create: {
            org_id: org.id,
            current_step: 'organization_basics',
            step_data: {
              trial: true,
              selectedApps: uniqueApps,
              primaryApp,
              organizationSize: input.organizationSize,
              primaryInterest: input.primaryInterest,
              country: input.country,
              language: input.language,
            },
            status: 'in_progress',
          },
          update: {
            step_data: {
              trial: true,
              selectedApps: uniqueApps,
              primaryApp,
              organizationSize: input.organizationSize,
              primaryInterest: input.primaryInterest,
              country: input.country,
              language: input.language,
            },
          },
        });

        return { user, org, membership, branch };
      },
      { maxWait: 15000, timeout: 30000 }
    );

    // 5. Issue verification magic token
    const { rawToken } = await issueVerificationToken(this.db, result.user.id, 'email_verification', 24);

    // 6. Compute tenant workspace URL
    const orgUrl = getTenantUrl(result.org.subdomain);
    const verificationLink = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;

    // 7. Dispatch verification magic setup email
    const emailContent = createVerifyEmailTemplate({
      toName: result.user.full_name,
      organizationName: result.org.name,
      verificationLink,
      orgUrl,
    });

    await this.emailSvc.send({
      to: [{ email: result.user.email, name: result.user.full_name }],
      subject: `Set up your password and verify ${result.org.name} on Orvio`,
      htmlContent: emailContent.html,
    });

    // 8. Sign Access Token & Refresh Token for immediate dashboard access
    const accessToken = await signAccessToken({
      sub: result.user.id,
      email: result.user.email,
      org_id: result.org.id,
      role: 'owner',
      membership_id: result.membership.id,
    });

    const refreshExpiry = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const absoluteExpiry = new Date(Date.now() + env.SESSION_ABSOLUTE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const { rawToken: rawRefreshToken, tokenHash: refreshHash, jti } = generateRefreshToken();
    const familyId = generateOpaqueToken().rawToken;

    await this.db.refreshToken.create({
      data: {
        user_id: result.user.id,
        org_id: result.org.id,
        membership_id: result.membership.id,
        family_id: familyId,
        session_id: familyId,
        absolute_expires_at: absoluteExpiry,
        last_used_at: new Date(),
        created_ip: ip,
        token_hash: refreshHash,
        jti,
        expires_at: refreshExpiry,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.full_name,
        phone: result.user.phone,
        status: result.user.status,
        emailVerifiedAt: null,
      },
      organization: {
        id: result.org.id,
        name: result.org.name,
        subdomain: result.org.subdomain,
        status: result.org.status,
        planCode: result.org.plan_code,
        trialEndsAt: result.org.trial_ends_at,
        url: orgUrl,
      },
      redirectUrl: `${orgUrl}/orvio`,
    };
  }

  async setupPasswordAndVerify(input: SetupPasswordAndVerifyInput, ip?: string) {
    // 1. Assert password policy
    assertPasswordPolicy(input.password);

    // 2. Validate and consume token
    const tokenRecord = await verifyAndConsumeToken(this.db, input.token, 'email_verification');

    // Invalidate all prior pending verification and reset tokens for this user
    await invalidateUserTokens(this.db, tokenRecord.user_id, ['email_verification', 'magic_login', 'password_reset']);

    // 3. Hash new permanent password with Argon2id
    const password_hash = await hashPassword(input.password);

    // 4. Update user record
    const updatedUser = await this.db.user.update({
      where: { id: tokenRecord.user_id },
      data: {
        password_hash,
        status: 'active',
        email_verified_at: new Date(),
        last_login_at: new Date(),
        ...(ip ? { last_login_ip: ip } : {}),
      },
      include: {
        memberships: {
          where: { status: 'active' },
          orderBy: { created_at: 'asc' },
          include: { organization: true },
        },
      },
    });

    const primaryMembership = updatedUser.memberships[0];
    let org = primaryMembership?.organization;

    // Promote organization status to active if currently pending
    if (org && org.status === 'pending') {
      org = await this.db.organization.update({
        where: { id: org.id },
        data: { status: 'active' },
      });
    }

    const orgUrl = org ? getTenantUrl(org.subdomain) : undefined;

    // 5. Sign new tokens
    const accessToken = await signAccessToken({
      sub: updatedUser.id,
      email: updatedUser.email,
      org_id: primaryMembership?.org_id,
      role: primaryMembership?.role,
      membership_id: primaryMembership?.id,
    });

    const refreshExpiry = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const { rawToken: rawRefreshToken, tokenHash: refreshHash, jti } = generateRefreshToken();
    const familyId = generateOpaqueToken().rawToken;

    await this.db.refreshToken.create({
      data: {
        user_id: updatedUser.id,
        org_id: primaryMembership?.org_id,
        membership_id: primaryMembership?.id,
        family_id: familyId,
        session_id: familyId,
        absolute_expires_at: new Date(Date.now() + env.SESSION_ABSOLUTE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        last_used_at: new Date(),
        created_ip: ip,
        token_hash: refreshHash,
        jti,
        expires_at: refreshExpiry,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.full_name,
        phone: updatedUser.phone,
        status: updatedUser.status,
        emailVerifiedAt: updatedUser.email_verified_at ? updatedUser.email_verified_at.toISOString() : null,
      },
      organization: org
        ? {
            id: org.id,
            name: org.name,
            subdomain: org.subdomain,
            status: org.status,
            planCode: org.plan_code,
            url: orgUrl,
          }
        : null,
      redirectUrl: orgUrl ? `${orgUrl}/orvio` : undefined,
    };
  }


  async register(input: RegisterInput) {
    const email = input.email.toLowerCase().trim();
    const cleanSubdomain = deriveSubdomain(input.subdomain);

    // 1. Assert password policy & subdomain format
    assertPasswordPolicy(input.password);
    assertValidSubdomain(cleanSubdomain);

    // 2. Validate email & subdomain uniqueness before transaction
    const [existingUser, existingOrg] = await Promise.all([
      this.db.user.findUnique({ where: { email } }),
      this.db.organization.findUnique({ where: { subdomain: cleanSubdomain } }),
    ]);

    if (existingUser) {
      throw new AppError('DUPLICATE_RESOURCE', 'An account with this email address already exists', 409, {
        field: 'email',
      });
    }

    if (existingOrg) {
      const suggestions = nextAvailableCandidates(cleanSubdomain, 3);
      throw new AppError('SUBDOMAIN_TAKEN', 'This subdomain is already taken by another organization', 409, {
        field: 'subdomain',
        suggestions,
      });
    }

    // 3. Hash password with Argon2id
    const password_hash = await hashPassword(input.password);

    const initialProductKey = input.planCode === 'gym' ? 'gym' : 'inventory';

    // 4. Atomic Prisma Transaction creating User, Org, Membership, Branch, WorkspaceProduct, and Verification Token
    const result = await this.db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: input.organizationName.trim(),
          subdomain: cleanSubdomain,
          status: 'pending',
          plan_code: input.planCode ?? 'bundle',
          timezone: input.timezone ?? 'Africa/Lagos',
          currency: input.currency ?? 'NGN',
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          password_hash,
          full_name: input.fullName.trim(),
          phone: input.phone ?? null,
          status: 'active',
          email_verified_at: null,
        },
      });

      const membership = await tx.membership.create({
        data: {
          org_id: org.id,
          user_id: user.id,
          role: 'owner',
          status: 'active',
        },
      });

      const branch = await tx.branch.create({
        data: {
          org_id: org.id,
          name: input.organizationName.trim(),
          type: initialProductKey === 'gym' ? 'studio' : 'store',
          product_key: initialProductKey,
          is_primary: true,
          status: 'active',
        },
      });

      const product = await tx.workspaceProduct.create({
        data: {
          org_id: org.id,
          product_key: initialProductKey,
          status: 'active',
          is_primary: true,
        },
      });

      return { user, org, membership, branch, product };
    }, { maxWait: 15000, timeout: 30000 });

    // 5. Issue verification token
    const { rawToken } = await issueVerificationToken(this.db, result.user.id, 'email_verification', 24);

    // 6. Compute tenant workspace URL
    const orgUrl = getTenantUrl(result.org.subdomain);
    const verificationLink = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;

    // 7. Dispatch verification email
    const emailContent = createVerifyEmailTemplate({
      toName: result.user.full_name,
      organizationName: result.org.name,
      verificationLink,
      orgUrl,
    });

    await this.emailSvc.send({
      to: [{ email: result.user.email, name: result.user.full_name }],
      subject: emailContent.subject,
      htmlContent: emailContent.html,
    });

    return {
      userId: result.user.id,
      email: result.user.email,
      fullName: result.user.full_name,
      organization: {
        id: result.org.id,
        name: result.org.name,
        subdomain: result.org.subdomain,
        status: result.org.status,
        planCode: result.org.plan_code,
        url: orgUrl,
      },
    };
  }

  async verifyEmail(rawToken: string, ip?: string) {
    // 1. Validate and consume token
    const tokenRecord = await verifyAndConsumeToken(this.db, rawToken, 'email_verification');

    const primaryMembership = tokenRecord.user.memberships[0];
    const orgId = primaryMembership?.org_id;

    // 2. Activate user email verification, update telemetry and organization
    await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: tokenRecord.user_id },
        data: {
          email_verified_at: new Date(),
          last_login_at: new Date(),
          ...(ip ? { last_login_ip: ip } : {}),
        },
      });

      if (orgId) {
        await tx.organization.update({
          where: { id: orgId },
          data: { status: 'active' },
        });
      } else {
        const memberships = await tx.membership.findMany({
          where: { user_id: tokenRecord.user_id },
          select: { org_id: true },
        });
        for (const m of memberships) {
          await tx.organization.updateMany({
            where: { id: m.org_id, status: 'pending' },
            data: { status: 'active' },
          });
        }
      }
    }, { maxWait: 15000, timeout: 30000 });

    // 3. Issue Session Tokens with family ID
    const accessToken = await signAccessToken({
      sub: tokenRecord.user.id,
      email: tokenRecord.user.email,
      org_id: orgId,
      role: primaryMembership?.role,
      membership_id: primaryMembership?.id,
    });

    const refreshExpiry = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const { rawToken: rawRefreshToken, tokenHash: refreshHash, jti } = generateRefreshToken();
    const familyId = generateOpaqueToken().rawToken;

    await this.db.refreshToken.create({
      data: {
        user_id: tokenRecord.user_id,
        org_id: orgId,
        membership_id: primaryMembership?.id,
        family_id: familyId,
        session_id: familyId,
        absolute_expires_at: new Date(Date.now() + env.SESSION_ABSOLUTE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        last_used_at: new Date(),
        created_ip: ip,
        token_hash: refreshHash,
        jti,
        expires_at: refreshExpiry,
      },
    });

    const org = primaryMembership?.organization;
    const orgUrl = org ? getTenantUrl(org.subdomain) : undefined;

    // 4. Dispatch Welcome Email asynchronously
    if (org && orgUrl) {
      const welcomeContent = createWelcomeEmailTemplate({
        toName: tokenRecord.user.full_name,
        organizationName: org.name,
        orgUrl,
        planCode: org.plan_code ?? 'bundle',
      });

      this.emailSvc
        .send({
          to: [{ email: tokenRecord.user.email, name: tokenRecord.user.full_name }],
          subject: welcomeContent.subject,
          htmlContent: welcomeContent.html,
        })
        .catch((err) => console.error('[AuthService] Error sending welcome email:', err));
    }

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: tokenRecord.user.id,
        email: tokenRecord.user.email,
        fullName: tokenRecord.user.full_name,
        emailVerifiedAt: new Date().toISOString(),
      },
      organization: org
        ? {
            id: org.id,
            name: org.name,
            subdomain: org.subdomain,
            status: 'active',
            planCode: org.plan_code,
            url: orgUrl,
          }
        : null,
    };
  }

  async resendVerification(emailInput: string) {
    const email = emailInput.toLowerCase().trim();
    const user = await this.db.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { status: 'active' },
          orderBy: { created_at: 'asc' },
          include: { organization: true },
        },
      },
    });

    if (!user) {
      return { success: true };
    }

    if (user.email_verified_at) {
      // Anti-enumeration: return success: true without dispatching redundant verification email
      return { success: true };
    }

    // Check 60s cooldown strictly for email_verification
    await checkResendCooldown(this.db, user.id, 'email_verification', 60);

    // Issue new token
    const { rawToken } = await issueVerificationToken(this.db, user.id, 'email_verification', 24);

    const primaryOrg = user.memberships[0]?.organization;
    const orgUrl = primaryOrg ? getTenantUrl(primaryOrg.subdomain) : undefined;
    const verificationLink = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;

    const emailContent = createVerifyEmailTemplate({
      toName: user.full_name,
      organizationName: primaryOrg?.name ?? 'Orvio Hub',
      verificationLink,
      orgUrl,
    });

    await this.emailSvc.send({
      to: [{ email: user.email, name: user.full_name }],
      subject: emailContent.subject,
      htmlContent: emailContent.html,
    });

    return { success: true };
  }

  async login(emailInput: string, passwordInput: string, ip?: string, subdomain?: string, userAgent?: string) {
    const email = emailInput.toLowerCase().trim();
    const user = await this.db.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { status: 'active' },
          orderBy: { created_at: 'asc' },
          include: { organization: true },
        },
      },
    });

    if (!user) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const isValid = await verifyPassword(user.password_hash, passwordInput);
    if (!isValid) {
      if (!user.email_verified_at) {
        throw new AppError(
          'PASSWORD_NOT_SET',
          'You have not set a permanent password yet. Use the sign-in link sent to your email or click "Email me a sign-in link".',
          401,
          { unverified: true, email: user.email }
        );
      }
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    if (!user.email_verified_at) {
      throw new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email address to continue', 403, {
        unverified: true,
        email: user.email,
      });
    }

    // Verify tenant membership if subdomain is provided
    let activeMembership = user.memberships[0];
    if (subdomain) {
      const cleanSub = subdomain.toLowerCase().trim();
      const match = user.memberships.find(
        (m) => m.organization.subdomain.toLowerCase() === cleanSub
      );
      if (!match) {
        throw new AppError(
          'ORGANIZATION_ACCESS_DENIED',
          `Your account does not have access to the '${subdomain}' organization workspace.`,
          403
        );
      }
      activeMembership = match;
    }
    if (!activeMembership || activeMembership.status !== 'active') {
      throw new AppError('ORGANIZATION_ACCESS_DENIED', 'Your membership for this workspace is not active', 403);
    }

    // Update telemetry
    await this.db.user.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
        ...(ip ? { last_login_ip: ip } : {}),
      },
    });

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      org_id: activeMembership?.org_id,
      role: activeMembership?.role,
      membership_id: activeMembership?.id,
    });

    const refreshExpiry = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const { rawToken: rawRefreshToken, tokenHash: refreshHash, jti } = generateRefreshToken();
    const familyId = generateOpaqueToken().rawToken;

    await this.db.refreshToken.create({
      data: {
        user_id: user.id,
        org_id: activeMembership?.org_id,
        membership_id: activeMembership?.id,
        family_id: familyId,
        session_id: familyId,
        absolute_expires_at: new Date(Date.now() + env.SESSION_ABSOLUTE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        last_used_at: new Date(),
        created_ip: ip,
        user_agent: userAgent?.slice(0, 512),
        token_hash: refreshHash,
        jti,
        expires_at: refreshExpiry,
      },
    });

    const org = activeMembership?.organization;
    const orgUrl = org ? getTenantUrl(org.subdomain) : undefined;

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        emailVerifiedAt: user.email_verified_at ? user.email_verified_at.toISOString() : null,
      },
      organization: org
        ? {
            id: org.id,
            name: org.name,
            subdomain: org.subdomain,
            status: activeMembership.organization.status,
            planCode: org.plan_code,
            url: orgUrl,
          }
        : null,
    };
  }

  async requestMagicLogin(emailInput: string, subdomain?: string, ip?: string) {
    const email = emailInput.toLowerCase().trim();
    const user = await this.db.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { status: 'active' },
          orderBy: { created_at: 'asc' },
          include: { organization: true },
        },
      },
    });

    if (!user) {
      // Anti-enumeration: return success true
      return { success: true, message: 'If an account exists, a sign-in setup link has been sent to your email.' };
    }

    let targetOrg = user.memberships[0]?.organization;
    if (subdomain) {
      const cleanSub = subdomain.toLowerCase().trim();
      const match = user.memberships.find((m) => m.organization.subdomain.toLowerCase() === cleanSub);
      if (match) {
        targetOrg = match.organization;
      }
    }

    // Issue magic link token
    const { rawToken } = await issueVerificationToken(this.db, user.id, 'email_verification', 24);
    const orgUrl = targetOrg ? getTenantUrl(targetOrg.subdomain) : undefined;
    const verificationLink = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;

    const emailContent = createVerifyEmailTemplate({
      toName: user.full_name,
      organizationName: targetOrg?.name ?? 'Orvio Hub',
      verificationLink,
      orgUrl,
    });

    await this.emailSvc.send({
      to: [{ email: user.email, name: user.full_name }],
      subject: `Sign in and access ${targetOrg?.name ?? 'your workspace'} on Orvio`,
      htmlContent: emailContent.html,
    });

    return { success: true, message: 'A sign-in setup link has been sent to your email.' };
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);
    const tokenRecord = await this.db.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: {
        user: {
          include: {
            memberships: {
              where: { status: 'active' },
              orderBy: { created_at: 'asc' },
              include: { organization: true },
            },
          },
        },
      },
    });

    if (!tokenRecord) {
      throw new AppError('INVALID_REFRESH_TOKEN', 'Refresh token is invalid', 401);
    }

    // Reuse detection: token already revoked -> revoke full family!
    if (tokenRecord.revoked_at) {
      if (tokenRecord.family_id) {
        await this.db.refreshToken.updateMany({
          where: { family_id: tokenRecord.family_id },
          data: { revoked_at: new Date() },
        });
      }
      throw new AppError('INVALID_REFRESH_TOKEN', 'Refresh token reuse detected. Session invalidated.', 401);
    }

    if (new Date() > tokenRecord.expires_at || (tokenRecord.absolute_expires_at && new Date() > tokenRecord.absolute_expires_at)) {
      throw new AppError('INVALID_REFRESH_TOKEN', 'Refresh token has expired', 401);
    }

    const user = tokenRecord.user;
    // A refresh session is bound to the organization selected at login. Older,
    // unbound rows are deliberately rejected so they cannot switch tenants.
    const primaryMembership = user.memberships.find(
      (membership) => membership.id === tokenRecord.membership_id && membership.org_id === tokenRecord.org_id
    );
    if (!primaryMembership || primaryMembership.status !== 'active') {
      await this.db.refreshToken.updateMany({
        where: { membership_id: tokenRecord.membership_id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
      throw new AppError('INVALID_REFRESH_TOKEN', 'Refresh session is no longer valid', 401);
    }

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      org_id: primaryMembership?.org_id,
      role: primaryMembership?.role,
      membership_id: primaryMembership?.id,
    });

    const refreshExpiry = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const { rawToken: newRefreshToken, tokenHash: newRefreshHash, jti } = generateRefreshToken();

    // The compare-and-revoke operation and child creation must be one atomic
    // transaction. Concurrent requests can never both rotate this token.
    const rotated = await this.db.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: { id: tokenRecord.id, revoked_at: null, expires_at: { gt: new Date() } },
        data: { revoked_at: new Date() },
      });
      if (revoked.count !== 1) return false;

      await tx.refreshToken.create({
        data: {
          user_id: user.id,
          org_id: primaryMembership.org_id,
          membership_id: primaryMembership.id,
          family_id: tokenRecord.family_id ?? generateOpaqueToken().rawToken,
          session_id: tokenRecord.session_id ?? tokenRecord.family_id,
          absolute_expires_at: tokenRecord.absolute_expires_at,
          last_used_at: new Date(),
          created_ip: tokenRecord.created_ip,
          user_agent: tokenRecord.user_agent,
          token_hash: newRefreshHash,
          jti,
          expires_at: refreshExpiry,
        },
      });
      return true;
    });

    if (!rotated) {
      await this.db.refreshToken.updateMany({
        where: { family_id: tokenRecord.family_id },
        data: { revoked_at: new Date() },
      });
      throw new AppError('INVALID_REFRESH_TOKEN', 'Refresh token reuse detected. Session invalidated.', 401);
    }

    const org = primaryMembership?.organization;
    const orgUrl = org ? getTenantUrl(org.subdomain) : undefined;

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        emailVerifiedAt: user.email_verified_at ? user.email_verified_at.toISOString() : null,
      },
      organization: org
        ? {
            id: org.id,
            name: org.name,
            subdomain: org.subdomain,
            status: org.status,
            planCode: org.plan_code,
            url: orgUrl,
          }
        : null,
    };
  }

  async logout(rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await this.db.refreshToken.updateMany({
        where: { token_hash: tokenHash },
        data: { revoked_at: new Date() },
      });
    }
    return { success: true, message: 'Logged out successfully' };
  }

  async checkEmailAvailability(emailInput: string) {
    const email = emailInput.toLowerCase().trim();
    const existing = await this.db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    return {
      available: !existing,
      email,
    };
  }

  async forgotPassword(emailInput: string) {
    const email = emailInput.toLowerCase().trim();
    const user = await this.db.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Anti-enumeration
      return { success: true, message: 'If this email is registered, a password reset link has been dispatched.' };
    }

    // Check cooldown for password_reset
    await checkResendCooldown(this.db, user.id, 'password_reset', 60);

    const { rawToken } = await issueVerificationToken(this.db, user.id, 'password_reset', 2);
    const resetLink = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;

    const emailContent = createResetPasswordTemplate({
      toName: user.full_name,
      resetLink,
    });

    await this.emailSvc.send({
      to: [{ email: user.email, name: user.full_name }],
      subject: emailContent.subject,
      htmlContent: emailContent.html,
    });

    return { success: true, message: 'If this email is registered, a password reset link has been dispatched.' };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    assertPasswordPolicy(newPassword);

    const tokenRecord = await verifyAndConsumeToken(this.db, rawToken, 'password_reset');
    const password_hash = await hashPassword(newPassword);

    await this.db.$transaction([
      this.db.user.update({
        where: { id: tokenRecord.user_id },
        data: { password_hash },
      }),
      // Invalidate all active refresh tokens on password reset
      this.db.refreshToken.updateMany({
        where: { user_id: tokenRecord.user_id, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
    ]);

    return { success: true, message: 'Password has been reset successfully. Please log in.' };
  }

  async getCurrentUser(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: {
              include: {
                branches: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found', 404);
    }

    const primaryMembership = user.memberships[0];
    const org = primaryMembership?.organization;
    const orgUrl = org ? getTenantUrl(org.subdomain) : undefined;

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        status: user.status,
        emailVerifiedAt: user.email_verified_at ? user.email_verified_at.toISOString() : null,
        lastLoginAt: user.last_login_at ? user.last_login_at.toISOString() : null,
      },
      organization: org
        ? {
            id: org.id,
            name: org.name,
            subdomain: org.subdomain,
            status: org.status,
            planCode: org.plan_code,
            timezone: org.timezone,
            currency: org.currency,
            url: orgUrl,
            branches: org.branches,
          }
        : null,
      memberships: user.memberships.map((m) => ({
        id: m.id,
        orgId: m.org_id,
        role: m.role,
        status: m.status,
      })),
    };
  }
}

export const authService = new AuthService();
