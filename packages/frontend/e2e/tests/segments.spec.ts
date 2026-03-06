import { test, expect } from '@playwright/test';
import { ApiHelper } from '../helpers/api.helper';
import { navigateTo } from '../helpers/navigation.helper';

test.describe('Segments', () => {
  test.describe.configure({ mode: 'serial' });

  test('navigate to segments page', async ({ page }) => {
    await navigateTo(page, '/segments');
    await expect(page.getByRole('heading', { name: 'Segments' })).toBeVisible();
  });

  test('navigate to create segment page', async ({ page }) => {
    await navigateTo(page, '/segments');
    await page.getByRole('link', { name: /New Segment/i }).or(
      page.getByRole('button', { name: /New Segment/i }),
    ).click();

    await expect(page).toHaveURL(/\/segments\/new/);
  });

  test('view segment detail via list', async ({ page }) => {
    // Create segment via API first
    const api = new ApiHelper();
    await api.login();
    await api.createSegment({
      name: '[E2E] View Segment',
      description: 'E2E view test',
      rules: { conditions: [{ field: 'tags', operator: 'contains', value: 'e2e' }] },
    });

    // Navigate to segments list and click View to avoid hydration race
    await navigateTo(page, '/segments');
    await page.getByPlaceholder('Search segments...').fill('[E2E] View');
    await page.getByRole('button', { name: 'View' }).first().click();
    await expect(page).toHaveURL(/\/segments\/.+/);
    await expect(page.getByRole('heading', { name: '[E2E] View Segment' })).toBeVisible({ timeout: 10000 });
  });
});
