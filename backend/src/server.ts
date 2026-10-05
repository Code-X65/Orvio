import { env } from './config/env.js';
import { buildApp } from './app.js';
import { prisma } from './infrastructure/database/client.js';

const app = buildApp();

async function start() {
  try {
    await app.listen({ host: env.HOST, port: env.PORT });
    app.log.info(`🚀 Orvio Hub API running on http://${env.HOST}:${env.PORT}`);
    app.log.info(`📚 Swagger OpenAPI documentation available at http://${env.HOST}:${env.PORT}/docs`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  app.log.info(`Received ${signal}, gracefully shutting down...`);
  try {
    await app.close();
    await prisma.$disconnect();
    app.log.info('Server and database pool shut down cleanly.');
    process.exit(0);
  } catch (err) {
    app.log.error(err, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
