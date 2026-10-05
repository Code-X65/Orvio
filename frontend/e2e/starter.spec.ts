import { expect, test } from '@playwright/test';

test('renders the marketing landing page and navigates to signup', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('OrvioHub')).toBeVisible();
  const signupLink = page.getByRole('link', { name: /Start Free Trial|Get Started|Try Free/i }).first();
  await expect(signupLink).toBeVisible();
});
