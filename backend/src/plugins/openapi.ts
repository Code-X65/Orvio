import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Orvio API',
        description: 'REST API for the Orvio operations platform. Product APIs are versioned under `/api/v1`.',
        version: '0.1.0',
      },
      tags: [
        { name: 'Infrastructure', description: 'Service health and readiness endpoints.' },
        { name: 'Authentication', description: 'Email/password and social sign-in endpoints.' },
        { name: 'Onboarding', description: 'Personal profile, phone verification, and onboarding survey.' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
}
