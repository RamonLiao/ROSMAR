import { test, expect } from '@playwright/test';
import { navigateTo } from '../helpers/navigation.helper';

test.describe('Tickets', () => {
  test.describe.configure({ mode: 'serial' });

  test('navigate to tickets page', async ({ page }) => {
    await navigateTo(page, '/tickets');
    await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible();
    await expect(page.getByText('Support ticket management with SLA tracking')).toBeVisible();
  });

  test('create ticket', async ({ page }) => {
    await navigateTo(page, '/tickets');
    // Wait for page to stabilize before clicking dialog trigger
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /New Ticket/i }).click();
    await expect(page.getByText('Create Ticket')).toBeVisible();

    await page.getByPlaceholder('Describe the issue').fill('[E2E] Test ticket');

    // Set SLA deadline — tomorrow
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
    await page.locator('input[type="datetime-local"]').fill(tomorrow);

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('[E2E] Test ticket').first()).toBeVisible({ timeout: 10000 });
  });

  test('search tickets', async ({ page }) => {
    await navigateTo(page, '/tickets');
    await page.getByPlaceholder('Search tickets...').fill('[E2E]');
    await expect(page.getByText('[E2E] Test ticket').first()).toBeVisible();
  });

  test('view ticket detail', async ({ page }) => {
    await navigateTo(page, '/tickets');
    await page.getByRole('button', { name: 'View' }).first().click();
    // Dialog opens — check for "Ticket Details" label in the dialog
    await expect(page.getByRole('dialog', { name: 'Ticket Details' })).toBeVisible();
  });
});
