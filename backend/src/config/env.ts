import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_URL: z.string().optional(),
    JWT_SECRET: z
      .string()
      .min(32, 'JWT_SECRET must be at least 32 characters')
      .default('dev-jwt-secret-min-32-chars-for-safety!!'),
    JWT_ACCESS_EXPIRY: z.string().default('15m'),
    JWT_AUDIENCE: z.string().default('orvio-web'),
    JWT_KEY_ID: z.string().min(1).default('primary'),
    REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().default(30),
    SESSION_ABSOLUTE_EXPIRY_DAYS: z.coerce.number().min(1).max(365).default(90),
    COOKIE_SECRET: z
      .string()
      .min(32, 'COOKIE_SECRET must be at least 32 characters')
      .default('dev-cookie-secret-min-32-chars-for-safety!!'),
    CORS_ORIGIN: z.string().default('http://localhost:4000,http://app.localhost:4000'),
    EMAIL_TRANSPORT: z.enum(['console', 'brevo']).default('console'),
    BREVO_API_KEY: z.string().optional(),
    BREVO_SENDER_EMAIL: z.string().default('support@orvio.com'),
    BREVO_SENDER_NAME: z.string().default('Orvio Hub'),
    BREVO_TEMPLATE_ID: z.coerce.number().optional(),
    FRONTEND_URL: z.string().default('http://localhost:4000'),
    APP_BASE_DOMAIN: z.string().default('localhost:4000'),
    COOKIE_DOMAIN: z.string().optional(),
    TRUST_PROXY: z.enum(['true', 'false']).default('true'),
    DISPOSABLE_EMAIL_BLOCKLIST_ENABLED: z.coerce.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production') {
        return (
          data.JWT_SECRET !== 'dev-jwt-secret-min-32-chars-for-safety!!' &&
          data.COOKIE_SECRET !== 'dev-cookie-secret-min-32-chars-for-safety!!'
        );
      }
      return true;
    },
    {
      message: 'Default development secrets must not be used in production',
      path: ['JWT_SECRET'],
    }
  );

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('❌ Invalid environment variables:\n', result.error.format());
      process.exit(1);
    }
    // In test environment, fallback with defaults for required test run
    return envSchema.parse({
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/test',
    });
  }
  return result.data;
}

export const env = parseEnv();
