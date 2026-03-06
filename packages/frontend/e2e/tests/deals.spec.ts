import { test, expect } from '@playwright/test';
import { ApiHelper } from '../helpers/api.helper';
import { navigateTo } from '../helpers/navigation.helper';

test.describe('Deals', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const api = new ApiHelper();
    await api.login();
    // Create profile for deal (ignore if already exists from previous run)
    try {
      await api.createProfile({
        primaryAddress: '0x00000000000000000000000000000000000000000000000000000000e2e00002',
        suinsName: '[E2E] deal-profile.sui',
        tags: ['e2e'],
      });
    } catch { /* profile may already exist */ }
  });

  test('navigate to deals page', async ({ page }) => {
    await navigateTo(page, '/deals');
    await expect(page.getByRole('heading', { name: 'Deals Pipeline' })).toBeVisible();
    await expect(page.getByText('Drag and drop deals to update stages')).toBeVisible();
  });

  test('create deal', async ({ page }) => {
    await navigateTo(page, '/deals');
    await page.getByRole('button', { name: /New Deal/i }).click();
    await expect(page.getByText('Create Deal')).toBeVisible();

    // Select profile from dropdown
    await page.locator('[role="dialog"]').getByRole('combobox').first().click();
    await page.getByRole('option').first().click();

    await page.getByPlaceholder('Enterprise contract Q2').fill('[E2E] Test Deal');
    await page.getByPlaceholder('10000').fill('25000');
    await page.getByPlaceholder('Optional notes about this deal...').fill('E2E test deal');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('[E2E] Test Deal').first()).toBeVisible({ timeout: 10000 });
  });

  test('switch to list view and search', async ({ page }) => {
    await navigateTo(page, '/deals');
    await page.getByRole('button', { name: 'List view' }).click();

    await expect(page.getByText('Browse and search all deals')).toBeVisible();
    await page.getByPlaceholder('Search deals...').fill('[E2E]');
    await expect(page.getByText('[E2E] Test Deal').first()).toBeVisible();
  });

  test('view deal detail', async ({ page }) => {
    await navigateTo(page, '/deals');
    await page.getByRole('button', { name: 'List view' }).click();
    await page.getByPlaceholder('Search deals...').fill('[E2E]');
    await page.getByText('[E2E] Test Deal').first().click();

    await expect(page).toHaveURL(/\/deals\/.+/);
  });
});
