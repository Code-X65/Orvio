import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.string().url(),
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(z.string().url()).min(1)),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  JWT_SECRET: z.string().min(32),
  JWT_SECRET_PREVIOUS: z.string().min(32).optional(),
  EMAIL_LINK_SECRET: z.string().min(32).optional(),
  COOKIE_SECURE: z.coerce.boolean().optional(),
  FRONTEND_APP_URL: z.string().url(),
  BREVO_API_KEY: z.string().min(1),
  BREVO_SENDER_EMAIL: z.string().email(),
  BREVO_SENDER_NAME: z.string().min(1).default('Orvio'),
  AUTH_RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(5),
  AUTH_RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  AUTH_RATE_LIMIT_LOGIN_IP_MAX: z.coerce.number().int().positive().default(30),
  AUTH_RATE_LIMIT_REGISTRATION_MAX: z.coerce.number().int().positive().default(5),
  AUTH_RATE_LIMIT_REGISTRATION_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  AUTH_RATE_LIMIT_REGISTRATION_IP_MAX: z.coerce.number().int().positive().default(30),
  AUTH_RATE_LIMIT_OTP_MAX: z.coerce.number().int().positive().default(3),
  AUTH_RATE_LIMIT_OTP_WINDOW_MS: z.coerce.number().int().positive().default(600_000),
  AUTH_RATE_LIMIT_PASSWORD_MAX: z.coerce.number().int().positive().default(5),
  AUTH_RATE_LIMIT_PASSWORD_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  AUTH_RATE_LIMIT_PASSWORD_IP_MAX: z.coerce.number().int().positive().default(30),
  AUTH_SESSION_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().min(1825).default(1825),
  AUTH_CLEANUP_INTERVAL_MS: z.coerce.number().int().positive().default(3_600_000),
  E2E_TEST_MODE: z.coerce.boolean().default(false),
  E2E_CAPTURE_SECRET: z.string().min(32).optional(),
  PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
  ORVIO_ROOT_DOMAIN: z.string().min(3).default('orvio.com'),
  PAYSTACK_SECRET_KEY: z.string().min(1).optional(),
  PAYSTACK_INVENTORY_PLAN_CODE: z.string().min(1).optional(),
  PAYSTACK_GYM_PLAN_CODE: z.string().min(1).optional(),
  PAYSTACK_BUNDLE_PLAN_CODE: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  FACEBOOK_APP_ID: z.string().min(1).optional(),
  FACEBOOK_APP_SECRET: z.string().min(1).optional(),
  FACEBOOK_GRAPH_API_URL: z.string().url().default('https://graph.facebook.com'),
  TERMII_API_KEY: z.string().min(1).optional(),
  TERMII_SENDER_ID: z.string().min(1).optional(),
  TERMII_BASE_URL: z.string().url().default('https://api.ng.termii.com'),
});

export type AppEnv = z.output<typeof environmentSchema>;

export function parseEnvironment(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const env = environmentSchema.parse(source);
  if (env.NODE_ENV === 'production') {
    if (env.TRUST_PROXY_HOPS === undefined) throw new Error('TRUST_PROXY_HOPS must be configured in production.');
    if (env.COOKIE_SECURE === false) throw new Error('COOKIE_SECURE cannot be set to false in production.');
    const productionUrls = [env.FRONTEND_APP_URL, env.PUBLIC_API_URL, ...env.CORS_ORIGINS];
    if (productionUrls.some((url) => new URL(url).protocol !== 'https:')) {
      throw new Error('FRONTEND_APP_URL, PUBLIC_API_URL, and CORS_ORIGINS must use HTTPS in production.');
    }
    if (/^(replace|changeme|your-|secret|test-secret)/i.test(env.JWT_SECRET)) {
      throw new Error('JWT_SECRET cannot use default or placeholder values in production.');
    }
  }
  if (env.E2E_TEST_MODE && (!env.E2E_CAPTURE_SECRET || env.NODE_ENV === 'production')) {
    throw new Error('E2E_TEST_MODE requires E2E_CAPTURE_SECRET and is not available in production.');
  }
  return env;
}
