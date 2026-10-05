import type { PrismaClient, Organization } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../infrastructure/database/prisma.js';

export class OrgRepository {
  constructor(private db: PrismaClient = defaultPrisma) {}

  async findBySubdomain(subdomain: string): Promise<Organization | null> {
    return this.db.organization.findUnique({
      where: { subdomain },
    });
  }

  async findById(id: string): Promise<Organization | null> {
    return this.db.organization.findUnique({
      where: { id },
    });
  }
}

export const orgRepository = new OrgRepository();
