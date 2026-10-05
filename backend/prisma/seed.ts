import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data for Orvio Hub...');

  const passwordHash = await argon2.hash('DemoPassword123!', {
    type: argon2.argon2id,
  });

  // 1. Upsert Demo User
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@orvio.com' },
    update: {},
    create: {
      email: 'demo@orvio.com',
      password_hash: passwordHash,
      full_name: 'Demo Merchant',
      phone: '08012345678',
      status: 'active',
      email_verified_at: new Date(),
    },
  });

  // 2. Upsert Demo Organization
  const demoOrg = await prisma.organization.upsert({
    where: { subdomain: 'demo' },
    update: {},
    create: {
      name: 'Orvio Demo Store',
      subdomain: 'demo',
      status: 'active',
      timezone: 'Africa/Lagos',
      currency: 'NGN',
      plan_code: 'bundle',
    },
  });

  // 3. Upsert Membership
  await prisma.membership.upsert({
    where: {
      org_id_user_id: {
        org_id: demoOrg.id,
        user_id: demoUser.id,
      },
    },
    update: {},
    create: {
      org_id: demoOrg.id,
      user_id: demoUser.id,
      role: 'owner',
      status: 'active',
    },
  });

  // 4. Ensure default branch exists
  const existingBranch = await prisma.branch.findFirst({
    where: { org_id: demoOrg.id, name: 'Main Store' },
  });

  if (!existingBranch) {
    await prisma.branch.create({
      data: {
        org_id: demoOrg.id,
        name: 'Main Store',
        type: 'store',
        status: 'active',
        address: {
          city: 'Lagos',
          state: 'Lagos State',
          country: 'Nigeria',
        },
      },
    });
  }

  console.log('Seed completed successfully (idempotent).');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
