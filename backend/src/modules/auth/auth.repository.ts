import type { PrismaClient, User, Organization, Membership, Branch, VerificationToken, RefreshToken } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/database/prisma.js';

export interface CreateRegistrationData {
  user: {
    email: string;
    password_hash: string;
    full_name: string;
    phone?: string;
  };
  organization: {
    name: string;
    subdomain: string;
    plan_code?: string;
  };
  verificationToken: {
    token_hash: string;
    expires_at: Date;
  };
}

export interface RegistrationResult {
  user: User;
  organization: Organization;
  membership: Membership;
  branch: Branch;
  verificationToken: VerificationToken;
}

export class AuthRepository {
  constructor(private db: PrismaClient = defaultPrisma) {}

  async findByEmail(email: string): Promise<(User & { memberships: (Membership & { organization: Organization })[] }) | null> {
    return this.db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
      },
    });
  }

  async findUserById(id: string): Promise<(User & { memberships: (Membership & { organization: Organization })[] }) | null> {
    return this.db.user.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
      },
    });
  }

  async createRegistrationTx(data: CreateRegistrationData): Promise<RegistrationResult> {
    return this.db.$transaction(async (tx) => {
      // 1. Create Organization (status: pending)
      const organization = await tx.organization.create({
        data: {
          name: data.organization.name,
          subdomain: data.organization.subdomain.toLowerCase().trim(),
          status: 'pending',
          plan_code: data.organization.plan_code ?? null,
        },
      });

      // 2. Create User
      const user = await tx.user.create({
        data: {
          email: data.user.email.toLowerCase().trim(),
          password_hash: data.user.password_hash,
          full_name: data.user.full_name,
          phone: data.user.phone ?? null,
          status: 'active',
          email_verified_at: null,
        },
      });

      // 3. Create Membership (role: owner)
      const membership = await tx.membership.create({
        data: {
          org_id: organization.id,
          user_id: user.id,
          role: 'owner',
          status: 'active',
        },
      });

      // 4. Create Default Store Branch
      const branch = await tx.branch.create({
        data: {
          org_id: organization.id,
          name: 'Main Store',
          type: 'store',
          status: 'active',
        },
      });

      // 5. Create Verification Token
      const verificationToken = await tx.verificationToken.create({
        data: {
          user_id: user.id,
          token_hash: data.verificationToken.token_hash,
          purpose: 'email_verification',
          expires_at: data.verificationToken.expires_at,
        },
      });

      return {
        user,
        organization,
        membership,
        branch,
        verificationToken,
      };
    });
  }

  async findVerificationTokenByHash(tokenHash: string): Promise<(VerificationToken & { user: User & { memberships: (Membership & { organization: Organization })[] } }) | null> {
    return this.db.verificationToken.findUnique({
      where: { token_hash: tokenHash },
      include: {
        user: {
          include: {
            memberships: {
              include: {
                organization: true,
              },
            },
          },
        },
      },
    });
  }

  async verifyUserAndActivateOrg(tokenId: string, userId: string, orgId?: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      // 1. Consume token
      await tx.verificationToken.update({
        where: { id: tokenId },
        data: { consumed_at: new Date() },
      });

      // 2. Update user verified status
      await tx.user.update({
        where: { id: userId },
        data: { email_verified_at: new Date() },
      });

      // 3. If orgId provided or find pending orgs of user, update to active
      if (orgId) {
        await tx.organization.update({
          where: { id: orgId },
          data: { status: 'active' },
        });
      } else {
        const memberships = await tx.membership.findMany({
          where: { user_id: userId },
          select: { org_id: true },
        });
        for (const m of memberships) {
          await tx.organization.updateMany({
            where: { id: m.org_id, status: 'pending' },
            data: { status: 'active' },
          });
        }
      }
    });
  }

  async createVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<VerificationToken> {
    return this.db.verificationToken.create({
      data: {
        user_id: userId,
        token_hash: tokenHash,
        purpose: 'email_verification',
        expires_at: expiresAt,
      },
    });
  }

  async storeRefreshToken(userId: string, tokenHash: string, jti: string, expiresAt: Date): Promise<RefreshToken> {
    return this.db.refreshToken.create({
      data: {
        user_id: userId,
        token_hash: tokenHash,
        jti,
        expires_at: expiresAt,
      },
    });
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<(RefreshToken & { user: User & { memberships: (Membership & { organization: Organization })[] } }) | null> {
    return this.db.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: {
        user: {
          include: {
            memberships: {
              include: {
                organization: true,
              },
            },
          },
        },
      },
    });
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.db.refreshToken.update({
      where: { id: tokenId },
      data: { revoked_at: new Date() },
    });
  }
}

export const authRepository = new AuthRepository();
