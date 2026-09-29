import { defineConfig, devices } from '@playwright/test';

const apiBaseUrl = 'http://127.0.0.1:3000';
const frontendBaseUrl = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: frontendBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --dir ../backend start',
      url: `${apiBaseUrl}/health`,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test', HOST: '127.0.0.1', PORT: '3000',
        DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://orvio:orvio@127.0.0.1:5432/orvio?schema=public',
        CORS_ORIGINS: frontendBaseUrl, FRONTEND_APP_URL: frontendBaseUrl, PUBLIC_API_URL: apiBaseUrl,
        JWT_SECRET: 'e2e-test-secret-that-is-longer-than-32-characters',
        BREVO_API_KEY: 'e2e-capture', BREVO_SENDER_EMAIL: 'no-reply@orvio.test',
        E2E_TEST_MODE: 'true', E2E_CAPTURE_SECRET: 'e2e-capture-secret-that-is-longer-than-32-characters',
      },
    },
    {
      command: 'pnpm vite preview --host 127.0.0.1 --port 4173',
      url: frontendBaseUrl,
      reuseExistingServer: !process.env.CI,
      env: { VITE_API_BASE_URL: `${apiBaseUrl}/api/v1` },
    },
  ],
});
