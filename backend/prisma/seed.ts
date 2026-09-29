import argon2 from 'argon2';
import { LegalDocumentType, OnboardingStage, PrismaClient, UserStatus } from '@prisma/client';

export const seedIds = {
  user: '10000000-0000-4000-8000-000000000001',
} as const;

export const seedCredentials = {
  email: 'owner@orvio.test',
  password: 'orvio-test-password',
} as const;

export function assertSeedEnvironment(environment = process.env.NODE_ENV): void {
  if (environment === 'production') throw new Error('Refusing to seed a production database.');
}

export async function seedDatabase(prisma: PrismaClient, environment = process.env.NODE_ENV): Promise<void> {
  assertSeedEnvironment(environment);
  const passwordHash = await argon2.hash(seedCredentials.password, { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email: seedCredentials.email },
    update: { passwordHash, passwordSetAt: new Date(), status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), phoneVerifiedAt: new Date(), onboardingCompletedAt: new Date(), deletedAt: null },
    create: { id: seedIds.user, email: seedCredentials.email, firstName: 'Orvio', lastName: 'Owner', passwordHash, passwordSetAt: new Date(), status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), phoneVerifiedAt: new Date(), onboardingCompletedAt: new Date() },
  });
  await prisma.userOnboarding.upsert({ where: { userId: user.id }, update: { stage: OnboardingStage.COMPLETE, completedAt: new Date() }, create: { userId: user.id, stage: OnboardingStage.COMPLETE, completedAt: new Date() } });
  for (const document of [
    { type: LegalDocumentType.TERMS, version: '2026-09-29', title: 'Orvio Terms of Service', content: 'Development placeholder. Replace with approved Terms of Service before production.' },
    { type: LegalDocumentType.PRIVACY, version: '2026-09-29', title: 'Orvio Privacy Policy', content: 'Development placeholder. Replace with an approved Privacy Policy before production.' },
  ]) {
    await prisma.legalDocument.updateMany({ where: { type: document.type }, data: { isCurrent: false } });
    await prisma.legalDocument.upsert({ where: { type_version: { type: document.type, version: document.version } }, update: { ...document, isCurrent: true }, create: { ...document, isCurrent: true } });
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try { await seedDatabase(prisma); } finally { await prisma.$disconnect(); }
}

await main();
console.log('Database seeded successfully.');
