import { test, expect } from '@playwright/test';
import { navigateTo } from '../helpers/navigation.helper';

test.describe('Organizations', () => {
  test.describe.configure({ mode: 'serial' });

  test('navigate to organizations page', async ({ page }) => {
    await navigateTo(page, '/organizations');
    await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible();
    await expect(page.getByText('Manage company and organization profiles')).toBeVisible();
  });

  test('create organization', async ({ page }) => {
    await navigateTo(page, '/organizations');
    await page.getByRole('button', { name: /New Organization/i }).click();

    await page.getByPlaceholder('Acme Corp').fill('[E2E] Test Corp');
    await page.getByPlaceholder('acme.com').fill('e2e-test.com');
    await page.getByPlaceholder('enterprise, partner, prospect').fill('e2e, test');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('[E2E] Test Corp').first()).toBeVisible({ timeout: 10000 });
  });

  test('search organizations', async ({ page }) => {
    await navigateTo(page, '/organizations');
    await page.getByPlaceholder('Search organizations...').fill('[E2E]');
    await expect(page.getByText('[E2E] Test Corp').first()).toBeVisible();
  });

  test('view organization detail', async ({ page }) => {
    await navigateTo(page, '/organizations');
    await page.getByPlaceholder('Search organizations...').fill('[E2E]');
    await page.getByRole('button', { name: 'View' }).first().click();
    await expect(page).toHaveURL(/\/organizations\/.+/);
  });
});
