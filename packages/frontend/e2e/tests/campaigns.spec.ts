import { test, expect } from '@playwright/test';
import { ApiHelper } from '../helpers/api.helper';
import { navigateTo } from '../helpers/navigation.helper';

test.describe('Campaigns', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const api = new ApiHelper();
    await api.login();
    await api.createSegment({
      name: '[E2E] Campaign Segment',
      rules: { conditions: [{ field: 'tags', operator: 'contains', value: 'e2e' }] },
    });
  });

  test('navigate to campaigns page', async ({ page }) => {
    await navigateTo(page, '/campaigns');
    await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
    await expect(page.getByText('Create and manage marketing campaigns')).toBeVisible();
  });

  test('create campaign', async ({ page }) => {
    await navigateTo(page, '/campaigns');
    await page.getByRole('button', { name: /New Campaign/i }).click();
    await expect(page.getByText('Create Campaign')).toBeVisible();

    await page.getByPlaceholder('Q2 Outreach').fill('[E2E] Test Campaign');
    await page.getByPlaceholder('Campaign description...').fill('E2E test campaign');

    // Select target segment from dropdown
    await page.locator('[role="dialog"]').getByRole('combobox').click();
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('[E2E] Test Campaign').first()).toBeVisible({ timeout: 10000 });
  });
});
