import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../src/app.js';
import { prisma as defaultPrisma } from '../../src/infrastructure/database/client.js';
import { RecordingEmailSender } from './email.js';

export interface TestAppOptions {
  prisma?: PrismaClient;
  emailSender?: RecordingEmailSender;
}

export interface TestAppContext {
  app: FastifyInstance;
  emailSender: RecordingEmailSender;
  prisma: PrismaClient;
}

export async function createTestApp(options: TestAppOptions = {}): Promise<TestAppContext> {
  const emailSender = options.emailSender ?? new RecordingEmailSender();
  const dbPrisma = options.prisma ?? defaultPrisma;

  const app = await buildApp({ prisma: dbPrisma, emailSender });

  await app.ready();

  return {
    app,
    emailSender,
    prisma: dbPrisma,
  };
}
