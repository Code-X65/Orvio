import { expect, test } from '@playwright/test';

const apiBaseUrl = 'http://127.0.0.1:3000';
const captureSecret = 'e2e-capture-secret-that-is-longer-than-32-characters';

async function captured(kind: 'verification' | 'phone_otp', filter: Record<string, string>) {
  const params = new URLSearchParams({ kind, ...filter });
  const response = await fetch(`${apiBaseUrl}/api/v1/test/delivery?${params}`, { headers: { 'x-e2e-capture-secret': captureSecret } });
  expect(response.ok).toBeTruthy();
  return (await response.json()).data as { link?: string; code?: string };
}

async function hasCaptured(kind: 'verification' | 'phone_otp', filter: Record<string, string>) {
  const params = new URLSearchParams({ kind, ...filter });
  const response = await fetch(`${apiBaseUrl}/api/v1/test/delivery?${params}`, { headers: { 'x-e2e-capture-secret': captureSecret } });
  return response.ok;
}

test('@smoke completes signup, verification, login, phone onboarding, and survey', async ({ page }) => {
  const email = `e2e-${Date.now()}@orvio.test`;
  const password = 'StrongE2EPassword!2026';
  await fetch(`${apiBaseUrl}/api/v1/test/delivery`, { method: 'DELETE', headers: { 'x-e2e-capture-secret': captureSecret } });

  await page.goto('/register');
  await page.getByLabel('First name').fill('E2E');
  await page.getByLabel('Last name').fill('Tester');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.locator('input[type="checkbox"]').nth(0).check();
  await page.locator('input[type="checkbox"]').nth(1).check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect.poll(() => hasCaptured('verification', { email }), { timeout: 10_000 }).toBe(true);
  const { link } = await captured('verification', { email });
  await page.goto(link!);
  await expect(page.getByRole('heading', { name: 'Verify your phone' })).toBeVisible();

  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Verify your phone' })).toBeVisible();
  await page.getByLabel('Mobile number').fill('+2348012345678');
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect.poll(() => hasCaptured('phone_otp', { phone: '+2348012345678' }), { timeout: 10_000 }).toBe(true);
  const { code } = await captured('phone_otp', { phone: '+2348012345678' });
  await page.getByLabel('Verification code').fill(code!);
  await expect(page.getByRole('heading', { name: 'Help us understand your needs' })).toBeVisible();

  for (const option of ['Inventory management', 'Google search', 'Retail', '1–50', 'No']) {
    await page.getByLabel(option).check();
    await page.getByRole('button', { name: 'Next' }).click();
  }
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('heading', { name: /Welcome, E2E/ })).toBeVisible();
});
