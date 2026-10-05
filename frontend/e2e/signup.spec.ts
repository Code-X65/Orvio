import { test, expect } from '@playwright/test';

test.describe('Signup Flow @smoke', () => {
  test('completes 3-step organization signup wizard and renders workspace confirmation', async ({
    page,
  }) => {
    // Intercept backend API calls with mock response for isolated deterministic smoke run
    await page.route('**/api/v1/orgs/check-subdomain*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            available: true,
            subdomain: 'e2efitnessclub',
          },
        }),
      });
    });

    await page.route('**/api/v1/auth/register', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            userId: 'usr_e2e_1',
            email: 'founder@e2e.com',
            fullName: 'E2E Founder',
            accessToken: 'e2e_access_token_mock',
            organization: {
              id: 'org_e2e_1',
              name: 'E2E Fitness Club',
              subdomain: 'e2efitnessclub',
              status: 'pending',
              planCode: 'inventory',
            },
          },
        }),
      });
    });

    // 1. Visit Signup Page with inventory plan preselected
    await page.goto('/signup?plan=inventory');

    // Verify Step 1 Account View
    await expect(page.getByText('Create your administrator account')).toBeVisible();

    // Fill Step 1 Inputs
    await page.getByLabel('Full Name *').fill('E2E Founder');
    await page.getByLabel('Work Email *').fill('founder@e2e.com');
    await page.getByLabel('Password *').fill('SecurePassword123!');

    // Proceed to Step 2
    await page.getByRole('button', { name: 'Continue to Business Details' }).click();

    // Verify Step 2 Business View
    await expect(page.getByText('Set up your business workspace')).toBeVisible();

    // Fill Step 2 Inputs
    await page.getByLabel('Business / Organization Name *').fill('E2E Fitness Club');

    // Wait for availability check badge
    await expect(page.getByText(/is available!/i)).toBeVisible();

    // Submit Registration
    await page.getByRole('button', { name: 'Create Workspace' }).click();

    // Verify Step 3 Confirmation View
    await expect(page.getByText('Verify your email address')).toBeVisible();
    await expect(page.getByText('founder@e2e.com')).toBeVisible();
    await expect(page.getByText('https://e2efitnessclub.orvio.com')).toBeVisible();
    await expect(page.getByRole('button', { name: /Resend Verification Email/i })).toBeVisible();
  });
});
