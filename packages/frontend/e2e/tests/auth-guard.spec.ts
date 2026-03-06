import { test, expect } from '@playwright/test';

// These tests run WITHOUT storageState (unauthenticated)
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth Guard — unauthenticated redirect', () => {
  const protectedRoutes = [
    '/',
    '/profiles',
    '/organizations',
    '/deals',
    '/segments',
    '/campaigns',
    '/tickets',
    '/vault',
    '/analytics',
    '/settings/workspace',
  ];

  for (const route of protectedRoutes) {
    test(`${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign in')).toBeVisible();
    await expect(page.getByText('Choose your preferred authentication method')).toBeVisible();
    await expect(page.getByRole('button', { name: /Connect Wallet/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Use Passkey/i })).toBeVisible();
  });
});
