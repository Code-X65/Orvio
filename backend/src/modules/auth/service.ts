import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { emailSender as defaultEmailSender, type EmailSender } from '../email/index.js';
import {
  assertValidSubdomain,
  deriveSubdomain,
  nextAvailableCandidates,
} from '../organizations/subdomain.js';
import { hashPassword, verifyPassword, assertPasswordSecurity } from '../../lib/password.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  generateOpaqueToken,
} from '../../lib/tokens.js';
import { issueVerificationToken, verifyAndConsumeToken, checkResendCooldown, invalidateUserTokens, buildTokenLink } from './verification.js';
import { createVerifyEmailTemplate } from './templates/verify-email.js';
import { createWelcomeEmailTemplate } from './templates/welcome.js';
import { createResetPasswordTemplate } from './templates/reset-password.js';
import { createChangeEmailTemplate } from './templates/change-email.js';
import { recordAuditEvent, listUserAuditLogs } from '../audit/service.js';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import crypto from 'node:crypto';
import { isDisposableEmail, type RegisterInput, type UpdateProfileInput } from './schemas.js';
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

  private async pruneExcessSessions(userId: string, maxSessions = 10): Promise<void> {
    const activeTokens = await this.db.refreshToken.findMany({
      where: {
        user_id: userId,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'asc' },
    });

    if (activeTokens.length >= maxSessions) {
      const excessCount = activeTokens.length - maxSessions + 1;
      const toRevoke = activeTokens.slice(0, excessCount);
      await this.db.refreshToken.updateMany({
        where: { id: { in: toRevoke.map((t) => t.id) } },
        data: { revoked_at: new Date() },
      });
    }
  }

  async startTrial(input: StartTrialInput, ip?: string, userAgent?: string) {
    const email = input.email.toLowerCase().trim();
    const cleanPhone = input.phone ? normalizeNigerianPhone(input.phone) : null;
    
    // Derive subdomain from organizationName if not passed
    let cleanSubdomain = input.subdomain ? deriveSubdomain(input.subdomain) : deriveSubdomain(input.organizationName);
    if (cleanSubdomain.length < 3) {
      cleanSubdomain = `${cleanSubdomain}org`;
    }

    assertValidSubdomain(cleanSubdomain);

    // If password provided, validate policy; otherwise generate secure random placeholder
    const rawPassword = input.password ? input.password : crypto.randomBytes(32).toString('hex');
    if (input.password) {
      await assertPasswordSecurity(input.password, {
        email,
        fullName: input.fullName ?? `${input.firstName ?? ''} ${input.lastName ?? ''}`,
      });
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
      cleanPhone ? this.db.user.findFirst({ where: { phone: cleanPhone } }) : Promise.resolve(null),
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

        // Create or update organization in pending status until email verification
        const org = existingOrg && isOwnedBySameUnverifiedUser
          ? await tx.organization.update({
              where: { id: existingOrg.id },
              data: {
                name: input.organizationName.trim(),
                status: 'pending',
                plan_code: 'trial',
                trial_ends_at: trialEndsAt,
                description: input.organizationSize ? `Organization size: ${input.organizationSize}` : undefined,
              },
            })
          : await tx.organization.create({
              data: {
                name: input.organizationName.trim(),
                subdomain: cleanSubdomain,
                status: 'pending',
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
    const verificationLink = buildTokenLink(env.FRONTEND_URL, '/verify-email', rawToken);

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
    const familyId = generateOpaqueToken().rawToken;
    const accessToken = await signAccessToken({
      sub: result.user.id,
      email: result.user.email,
      org_id: result.org.id,
      role: 'owner',
      membership_id: result.membership.id,
      session_id: familyId,
    });

    const refreshExpiry = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const absoluteExpiry = new Date(Date.now() + env.SESSION_ABSOLUTE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const { rawToken: rawRefreshToken, tokenHash: refreshHash, jti } = generateRefreshToken();

    await this.pruneExcessSessions(result.user.id, 10);

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
        user_agent: userAgent?.slice(0, 512),
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

  async setupPasswordAndVerify(input: SetupPasswordAndVerifyInput, ip?: string, userAgent?: string) {
    const tokenHash = hashToken(input.token);
    const pendingRecord = await this.db.verificationToken.findUnique({
      where: { token_hash: tokenHash },
      include: { user: true },
    });

    if (!pendingRecord || pendingRecord.consumed_at || pendingRecord.expires_at < new Date() || !['email_verification', 'magic_login'].includes(pendingRecord.purpose)) {
      throw new AppError('INVALID_TOKEN', 'Verification token is invalid, expired, or already used', 400);
    }

    // 1. Assert password security with full user context (email & name)
    await assertPasswordSecurity(input.password, {
      email: pendingRecord.user.email,
      fullName: pendingRecord.user.full_name,
    });

    // 2. Validate and consume token
    const tokenRecord = await verifyAndConsumeToken(this.db, input.token, ['email_verification', 'magic_login']);

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
    const familyId = generateOpaqueToken().rawToken;
    const accessToken = await signAccessToken({
      sub: updatedUser.id,
      email: updatedUser.email,
      org_id: primaryMembership?.org_id,
      role: primaryMembership?.role,
      membership_id: primaryMembership?.id,
      session_id: familyId,
    });

    const refreshExpiry = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const { rawToken: rawRefreshToken, tokenHash: refreshHash, jti } = generateRefreshToken();

    await this.pruneExcessSessions(updatedUser.id, 10);

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
        user_agent: userAgent?.slice(0, 512),
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


  async register(input: RegisterInput, ip?: string, userAgent?: string) {
    const trialInput: StartTrialInput = {
      email: input.email,
      password: input.password,
      fullName: input.fullName,
      phone: input.phone,
      organizationName: input.organizationName,
      subdomain: input.subdomain,
      selectedApps: input.selectedApps,
      primaryApp: input.primaryApp,
      marketingOptIn: input.marketingOptIn,
      country: 'Nigeria',
      language: 'English',
      organizationSize: '1 - 5 employees',
      primaryInterest: 'Use it in my organization',
      termsAccepted: true,
    };

    const result = await this.startTrial(trialInput, ip, userAgent);
    return {
      ...result,
      userId: result.user.id,
      email: result.user.email,
      fullName: result.user.fullName,
    };
  }

  async verifyEmail(rawToken: string, ip?: string, userAgent?: string) {
    // 1. Validate and consume token (unified magic auth token)
    const tokenRecord = await verifyAndConsumeToken(this.db, rawToken, ['email_verification', 'magic_login']);
    await invalidateUserTokens(this.db, tokenRecord.user_id, ['email_verification', 'magic_login']);

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
        const ownerMembership = await tx.membership.findFirst({
          where: { user_id: tokenRecord.user_id, role: 'owner' },
        });
        if (ownerMembership) {
          await tx.organization.update({
            where: { id: ownerMembership.org_id },
            data: { status: 'active' },
          });
        }
      }
    }, { maxWait: 15000, timeout: 30000 });

    // 3. Issue Session Tokens with family ID
    const familyId = generateOpaqueToken().rawToken;
    const accessToken = await signAccessToken({
      sub: tokenRecord.user.id,
      email: tokenRecord.user.email,
      org_id: orgId,
      role: primaryMembership?.role,
      membership_id: primaryMembership?.id,
      session_id: familyId,
    });

    const refreshExpiry = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const { rawToken: rawRefreshToken, tokenHash: refreshHash, jti } = generateRefreshToken();

    await this.pruneExcessSessions(tokenRecord.user_id, 10);

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
        user_agent: userAgent?.slice(0, 512),
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

    // Issue new token (revokes any previously emailed verification link)
    const { rawToken } = await issueVerificationToken(this.db, user.id, 'email_verification', 24);

    const primaryOrg = user.memberships[0]?.organization;
    const orgUrl = primaryOrg ? getTenantUrl(primaryOrg.subdomain) : undefined;
    const verificationLink = buildTokenLink(env.FRONTEND_URL, '/verify-email', rawToken);

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
      await recordAuditEvent(this.db, {
        event: 'login_failed',
        status: 'failed',
        ipAddress: ip,
        userAgent,
        metadata: { email, reason: 'user_not_found' },
      });
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const isValid = await verifyPassword(user.password_hash, passwordInput);
    if (!isValid) {
      await recordAuditEvent(this.db, {
        userId: user.id,
        event: 'login_failed',
        status: 'failed',
        ipAddress: ip,
        userAgent,
        metadata: { email, reason: 'invalid_password' },
      });
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

    if (activeMembership.organization.status === 'suspended' || activeMembership.organization.status === 'deactivated') {
      throw new AppError('ORGANIZATION_ACCESS_DENIED', 'This workspace is not active', 403);
    }

    // Update telemetry
    await this.db.user.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
        ...(ip ? { last_login_ip: ip } : {}),
      },
    });

    const familyId = generateOpaqueToken().rawToken;
    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      org_id: activeMembership?.org_id,
      role: activeMembership?.role,
      membership_id: activeMembership?.id,
      session_id: familyId,
    });

    const refreshExpiry = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const { rawToken: rawRefreshToken, tokenHash: refreshHash, jti } = generateRefreshToken();

    await this.pruneExcessSessions(user.id, 10);

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

    await recordAuditEvent(this.db, {
      userId: user.id,
      orgId: activeMembership?.org_id,
      event: 'login_success',
      status: 'success',
      ipAddress: ip,
      userAgent,
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

    // Issue a dedicated magic sign-in token (24-hour expiry; revokes any earlier magic auth link)
    const { rawToken } = await issueVerificationToken(this.db, user.id, 'magic_login', 24);
    const orgUrl = targetOrg ? getTenantUrl(targetOrg.subdomain) : undefined;
    const verificationLink = buildTokenLink(env.FRONTEND_URL, '/verify-email', rawToken);

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

    if (user.status === 'deleted' || user.status === 'suspended') {
      throw new AppError('UNAUTHORIZED', 'Account is not active', 401);
    }

    if (primaryMembership.organization && (primaryMembership.organization.status === 'suspended' || primaryMembership.organization.status === 'deactivated')) {
      throw new AppError('ORGANIZATION_ACCESS_DENIED', 'Organization is not active', 403);
    }

    const currentSessionId = tokenRecord.session_id ?? tokenRecord.family_id ?? generateOpaqueToken().rawToken;
    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      org_id: primaryMembership?.org_id,
      role: primaryMembership?.role,
      membership_id: primaryMembership?.id,
      session_id: currentSessionId,
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

    await recordAuditEvent(this.db, {
      userId: user.id,
      orgId: primaryMembership?.org_id,
      event: 'token_refresh',
      status: 'success',
    });

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

  async logout(
    rawRefreshToken?: string,
    options?: { sessionId?: string; userId?: string; allSessions?: boolean }
  ) {
    const now = new Date();

    if (options?.allSessions && options?.userId) {
      await this.db.refreshToken.updateMany({
        where: { user_id: options.userId, revoked_at: null },
        data: { revoked_at: now },
      });
      await recordAuditEvent(this.db, {
        userId: options.userId,
        event: 'logout',
        status: 'success',
        metadata: { allSessions: true },
      });
      return { success: true, message: 'All sessions logged out successfully' };
    }

    let tokenSessionId = options?.sessionId;

    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      const tokenRecord = await this.db.refreshToken.findUnique({
        where: { token_hash: tokenHash },
      });
      if (tokenRecord) {
        tokenSessionId = tokenRecord.session_id || tokenRecord.family_id || undefined;
      }
      await this.db.refreshToken.updateMany({
        where: { token_hash: tokenHash },
        data: { revoked_at: now },
      });
    }

    if (tokenSessionId) {
      await this.db.refreshToken.updateMany({
        where: {
          OR: [{ session_id: tokenSessionId }, { family_id: tokenSessionId }],
          revoked_at: null,
        },
        data: { revoked_at: now },
      });
    }

    await recordAuditEvent(this.db, {
      userId: options?.userId,
      event: 'logout',
      status: 'success',
      metadata: { sessionId: tokenSessionId },
    });

    return { success: true, message: 'Logged out successfully' };
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const tokens = await this.db.refreshToken.findMany({
      where: {
        user_id: userId,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { last_used_at: 'desc' },
    });

    const sessionMap = new Map<
      string,
      {
        id: string;
        ipAddress: string | null;
        userAgent: string | null;
        createdAt: string;
        lastActiveAt: string | null;
        expiresAt: string;
        isCurrent: boolean;
      }
    >();

    for (const token of tokens) {
      const sId = token.session_id || token.family_id || token.id;
      if (!sessionMap.has(sId)) {
        sessionMap.set(sId, {
          id: sId,
          ipAddress: token.created_ip,
          userAgent: token.user_agent,
          createdAt: token.created_at.toISOString(),
          lastActiveAt: token.last_used_at ? token.last_used_at.toISOString() : null,
          expiresAt: (token.absolute_expires_at ?? token.expires_at).toISOString(),
          isCurrent: Boolean(currentSessionId && sId === currentSessionId),
        });
      }
    }

    return Array.from(sessionMap.values());
  }

  async revokeSession(userId: string, targetSessionId: string) {
    const result = await this.db.refreshToken.updateMany({
      where: {
        user_id: userId,
        OR: [
          { session_id: targetSessionId },
          { family_id: targetSessionId },
          { id: targetSessionId },
        ],
        revoked_at: null,
      },
      data: { revoked_at: new Date() },
    });

    if (result.count === 0) {
      throw new AppError('NOT_FOUND', 'Session not found or already revoked', 404);
    }

    await recordAuditEvent(this.db, {
      userId,
      event: 'session_revoked',
      status: 'success',
      metadata: { targetSessionId },
    });

    return {
      success: true,
      message: 'Session revoked successfully',
      revokedCount: result.count,
    };
  }

  async revokeAllSessions(userId: string, options?: { keepSessionId?: string }) {
    const whereClause: any = {
      user_id: userId,
      revoked_at: null,
    };

    if (options?.keepSessionId) {
      whereClause.NOT = [
        { session_id: options.keepSessionId },
        { family_id: options.keepSessionId },
      ];
    }

    const result = await this.db.refreshToken.updateMany({
      where: whereClause,
      data: { revoked_at: new Date() },
    });

    await recordAuditEvent(this.db, {
      userId,
      event: 'session_revoked',
      status: 'success',
      metadata: { all: true, keepSessionId: options?.keepSessionId },
    });

    return {
      success: true,
      message: options?.keepSessionId
        ? 'All other sessions have been revoked'
        : 'All active sessions have been revoked',
      revokedCount: result.count,
    };
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
    const resetLink = buildTokenLink(env.FRONTEND_URL, '/reset-password', rawToken);

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
    await assertPasswordSecurity(newPassword);

    const tokenRecord = await verifyAndConsumeToken(this.db, rawToken, 'password_reset');
    // Kill any other outstanding sign-in capable links once the password changes
    await invalidateUserTokens(this.db, tokenRecord.user_id, ['password_reset', 'magic_login']);
    const password_hash = await hashPassword(newPassword);

    await this.db.$transaction([
      this.db.user.update({
        where: { id: tokenRecord.user_id },
        data: {
          password_hash,
          email_verified_at: new Date(),
        },
      }),
      // Invalidate all active refresh tokens on password reset
      this.db.refreshToken.updateMany({
        where: { user_id: tokenRecord.user_id, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
    ]);

    await recordAuditEvent(this.db, {
      userId: tokenRecord.user_id,
      event: 'password_change',
      status: 'success',
    });

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
        phoneVerifiedAt: user.phone_verified_at ? user.phone_verified_at.toISOString() : null,
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

  // C1: Update User Profile
  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
    ip?: string,
    userAgent?: string
  ) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user || user.status === 'deleted') {
      throw new AppError('NOT_FOUND', 'User not found', 404);
    }

    let cleanPhone: string | null | undefined = undefined;
    if (input.phone !== undefined) {
      if (input.phone === null || input.phone === '') {
        cleanPhone = null;
      } else {
        cleanPhone = normalizeNigerianPhone(input.phone);
        // Check uniqueness if changed
        if (cleanPhone !== user.phone) {
          const existingPhone = await this.db.user.findFirst({
            where: { phone: cleanPhone, id: { not: userId } },
          });
          if (existingPhone) {
            throw new AppError('DUPLICATE_PHONE', 'This phone number is already in use by another account', 409);
          }
        }
      }
    }

    const updated = await this.db.user.update({
      where: { id: userId },
      data: {
        ...(input.fullName ? { full_name: input.fullName.trim() } : {}),
        ...(cleanPhone !== undefined ? { phone: cleanPhone, phone_verified_at: cleanPhone === user.phone ? user.phone_verified_at : null } : {}),
      },
    });

    await recordAuditEvent(this.db, {
      userId,
      event: 'profile_update',
      status: 'success',
      ipAddress: ip,
      userAgent,
      metadata: { fullName: input.fullName, phone: cleanPhone },
    });

    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.full_name,
      phone: updated.phone,
      emailVerifiedAt: updated.email_verified_at ? updated.email_verified_at.toISOString() : null,
      phoneVerifiedAt: updated.phone_verified_at ? updated.phone_verified_at.toISOString() : null,
    };
  }

  // C2: Request Email Change
  async requestEmailChange(
    userId: string,
    input: { newEmail: string; password: string },
    ip?: string,
    userAgent?: string
  ) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

    // Verify current password
    const isPasswordValid = await verifyPassword(user.password_hash, input.password);
    if (!isPasswordValid) {
      throw new AppError('INVALID_CREDENTIALS', 'Incorrect password. Identity verification failed.', 401);
    }

    const newEmail = input.newEmail.toLowerCase().trim();
    if (newEmail === user.email.toLowerCase()) {
      throw new AppError('VALIDATION_ERROR', 'New email address must be different from current email', 400);
    }

    if (isDisposableEmail(newEmail)) {
      throw new AppError('VALIDATION_ERROR', 'Disposable email addresses are not permitted', 400);
    }

    const existing = await this.db.user.findUnique({ where: { email: newEmail } });
    if (existing) {
      throw new AppError('DUPLICATE_EMAIL', 'An account with this email address already exists', 409);
    }

    await checkResendCooldown(this.db, userId, 'email_change', 60);

    const { rawToken } = await issueVerificationToken(this.db, userId, 'email_change', 24, {
      new_email: newEmail,
      old_email: user.email,
    });

    const confirmationLink = buildTokenLink(env.FRONTEND_URL, '/verify-email-change', rawToken);
    const emailContent = createChangeEmailTemplate({
      toName: user.full_name,
      newEmail,
      confirmationLink,
    });

    await this.emailSvc.send({
      to: [{ email: newEmail, name: user.full_name }],
      subject: `Confirm email change for Orvio Hub`,
      htmlContent: emailContent.html,
    });

    await recordAuditEvent(this.db, {
      userId,
      event: 'email_change_requested',
      status: 'success',
      ipAddress: ip,
      userAgent,
      metadata: { oldEmail: user.email, newEmail },
    });

    return {
      success: true,
      message: `Confirmation link has been sent to ${newEmail}. Please click the link to confirm.`,
    };
  }

  // C2: Confirm Email Change
  async confirmEmailChange(rawToken: string, ip?: string, userAgent?: string) {
    const tokenRecord = await verifyAndConsumeToken(this.db, rawToken, 'email_change');
    const newEmail = (tokenRecord.metadata as any)?.new_email;

    if (!newEmail || typeof newEmail !== 'string') {
      throw new AppError('INVALID_TOKEN', 'Email change payload is missing or invalid', 400);
    }

    // Double check email hasn't been claimed in the meantime
    const existing = await this.db.user.findUnique({ where: { email: newEmail } });
    if (existing && existing.id !== tokenRecord.user_id) {
      throw new AppError('DUPLICATE_EMAIL', 'This email address was claimed by another account', 409);
    }

    await this.db.$transaction([
      this.db.user.update({
        where: { id: tokenRecord.user_id },
        data: {
          email: newEmail,
          email_verified_at: new Date(),
        },
      }),
      // Revoke all other sessions on email change for security
      this.db.refreshToken.updateMany({
        where: { user_id: tokenRecord.user_id, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
    ]);

    await recordAuditEvent(this.db, {
      userId: tokenRecord.user_id,
      event: 'email_change_completed',
      status: 'success',
      ipAddress: ip,
      userAgent,
      metadata: { newEmail },
    });

    return {
      success: true,
      message: 'Your email address has been updated and verified successfully. Please sign in.',
    };
  }

  // C2: Request Phone Verification OTP
  async requestPhoneOtp(
    userId: string,
    input: { phone?: string },
    ip?: string,
    userAgent?: string
  ) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

    let targetPhone = user.phone;
    if (input.phone) {
      targetPhone = normalizeNigerianPhone(input.phone);
      if (targetPhone !== user.phone) {
        const existing = await this.db.user.findFirst({
          where: { phone: targetPhone, id: { not: userId } },
        });
        if (existing) {
          throw new AppError('DUPLICATE_PHONE', 'This phone number is already registered to another account', 409);
        }
        await this.db.user.update({
          where: { id: userId },
          data: { phone: targetPhone, phone_verified_at: null },
        });
      }
    }

    if (!targetPhone) {
      throw new AppError('VALIDATION_ERROR', 'Please provide a phone number to verify', 400);
    }

    await checkResendCooldown(this.db, userId, 'phone_verification', 60);

    // Generate 6-digit numeric OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const tokenHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate existing unused phone verification tokens
    await this.db.verificationToken.updateMany({
      where: { user_id: userId, purpose: 'phone_verification', consumed_at: null },
      data: { consumed_at: new Date() },
    });

    await this.db.verificationToken.create({
      data: {
        user_id: userId,
        token_hash: tokenHash,
        purpose: 'phone_verification',
        metadata: { phone: targetPhone, otpPreview: env.NODE_ENV === 'development' ? otp : undefined },
        expires_at: expiresAt,
      },
    });

    // Send notification email fallback with OTP
    await this.emailSvc.send({
      to: [{ email: user.email, name: user.full_name }],
      subject: `Your 6-digit verification code: ${otp}`,
      htmlContent: `<p>Hello ${user.full_name},</p><p>Your 6-digit verification code for phone ${targetPhone} is: <strong style="font-size:20px;letter-spacing:2px;">${otp}</strong>.</p><p>This code expires in 10 minutes.</p>`,
    });

    await recordAuditEvent(this.db, {
      userId,
      event: 'phone_otp_requested',
      status: 'success',
      ipAddress: ip,
      userAgent,
      metadata: { phone: targetPhone },
    });

    return {
      success: true,
      message: `A 6-digit verification code has been sent to ${targetPhone} and your email address.`,
      ...(env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
    };
  }

  // C2: Verify Phone OTP
  async verifyPhoneOtp(
    userId: string,
    input: { otp: string },
    ip?: string,
    userAgent?: string
  ) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { phone_verified_at: true },
    });
    if (user?.phone_verified_at) {
      return {
        success: true,
        message: 'Phone number is already verified.',
      };
    }

    const tokenHash = hashToken(input.otp.trim());
    const activeToken = await this.db.verificationToken.findFirst({
      where: {
        user_id: userId,
        purpose: 'phone_verification',
        consumed_at: null,
        expires_at: { gt: new Date() },
      },
    });

    if (!activeToken) {
      throw new AppError('INVALID_TOKEN', 'No active verification code found. Please request a new code.', 400);
    }

    if (activeToken.token_hash !== tokenHash) {
      const meta = (activeToken.metadata as Record<string, unknown>) || {};
      const attempts = ((meta.attempts as number) || 0) + 1;

      if (attempts >= 5) {
        await this.db.verificationToken.update({
          where: { id: activeToken.id },
          data: { consumed_at: new Date(), metadata: { ...meta, attempts } as any },
        });
        throw new AppError(
          'RATE_LIMIT_EXCEEDED',
          'Too many invalid attempts. This verification code has been invalidated. Please request a new code.',
          429
        );
      }

      await this.db.verificationToken.update({
        where: { id: activeToken.id },
        data: { metadata: { ...meta, attempts } as any },
      });

      throw new AppError(
        'INVALID_TOKEN',
        `The verification code entered is invalid. ${5 - attempts} attempts remaining.`,
        400
      );
    }

    await this.db.$transaction([
      this.db.verificationToken.update({
        where: { id: activeToken.id },
        data: { consumed_at: new Date() },
      }),
      this.db.user.update({
        where: { id: userId },
        data: { phone_verified_at: new Date() },
      }),
    ]);

    await recordAuditEvent(this.db, {
      userId,
      event: 'phone_verified',
      status: 'success',
      ipAddress: ip,
      userAgent,
    });

    return {
      success: true,
      message: 'Phone number has been verified successfully.',
    };
  }

  // C3: GDPR Data Export
  async exportUserData(userId: string, ip?: string, userAgent?: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: {
              include: {
                branches: true,
                products: true,
              },
            },
          },
        },
        audit_logs: {
          orderBy: { created_at: 'desc' },
          take: 100,
        },
      },
    });

    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

    const sessions = await this.listSessions(userId);

    await recordAuditEvent(this.db, {
      userId,
      event: 'data_exported',
      status: 'success',
      ipAddress: ip,
      userAgent,
    });

    return {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        status: user.status,
        emailVerifiedAt: user.email_verified_at,
        phoneVerifiedAt: user.phone_verified_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at,
        lastLoginIp: user.last_login_ip,
      },
      activeSessions: sessions,
      organizations: user.memberships.map((m) => ({
        organizationId: m.org_id,
        organizationName: m.organization.name,
        subdomain: m.organization.subdomain,
        role: m.role,
        membershipStatus: m.status,
        timezone: m.organization.timezone,
        currency: m.organization.currency,
        branches: m.organization.branches.map((b) => ({
          id: b.id,
          name: b.name,
          type: b.type,
          status: b.status,
        })),
        products: m.organization.products.map((p) => ({
          productKey: p.product_key,
          status: p.status,
        })),
      })),
      recentSecurityEvents: user.audit_logs.map((log) => ({
        event: log.event,
        status: log.status,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        timestamp: log.created_at,
      })),
    };
  }

  // C3: Soft Account Deletion
  async deleteAccount(
    userId: string,
    input: { password: string; reason?: string },
    ip?: string,
    userAgent?: string
  ) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: {
              include: {
                memberships: { where: { role: 'owner', status: 'active' } },
              },
            },
          },
        },
      },
    });

    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

    // Verify password
    const isPasswordValid = await verifyPassword(user.password_hash, input.password);
    if (!isPasswordValid) {
      throw new AppError('INVALID_CREDENTIALS', 'Incorrect password. Deletion cancelled.', 401);
    }

    const anonymizedEmail = `deleted_${user.id}_${Date.now()}@anonymized.orvio.com`;

    // Suspend organizations where user is the sole active owner
    const orgsToSuspend: string[] = [];
    for (const membership of user.memberships) {
      if (
        membership.role === 'owner' &&
        membership.organization.memberships.length === 1 &&
        membership.organization.memberships[0].user_id === userId
      ) {
        orgsToSuspend.push(membership.org_id);
      }
    }

    await this.db.$transaction([
      this.db.user.update({
        where: { id: userId },
        data: {
          status: 'deleted',
          email: anonymizedEmail,
          phone: null,
          full_name: 'Deleted User',
        },
      }),
      this.db.membership.updateMany({
        where: { user_id: userId },
        data: { status: 'suspended' },
      }),
      this.db.organization.updateMany({
        where: { id: { in: orgsToSuspend } },
        data: { status: 'suspended' },
      }),
      this.db.refreshToken.updateMany({
        where: { user_id: userId, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
    ]);

    await recordAuditEvent(this.db, {
      userId,
      event: 'account_deleted',
      status: 'success',
      ipAddress: ip,
      userAgent,
      metadata: { reason: input.reason },
    });

    return {
      success: true,
      message: 'Your account has been deleted and all active sessions have been revoked.',
    };
  }

  // C4: List Audit Logs
  async listAuditLogs(userId: string, options?: { page?: number; limit?: number }) {
    return listUserAuditLogs(this.db, userId, options);
  }
}

export const authService = new AuthService();

