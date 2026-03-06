import { test, expect } from '@playwright/test';
import { navigateTo } from '../helpers/navigation.helper';

test.describe('Profiles', () => {
  test.describe.configure({ mode: 'serial' });

  test('navigate to profiles page', async ({ page }) => {
    await navigateTo(page, '/profiles');
    await expect(page.getByRole('heading', { name: 'Profiles' })).toBeVisible();
    await expect(page.getByText('Manage your customer profiles')).toBeVisible();
    await expect(page.getByRole('button', { name: /Add Profile/i })).toBeVisible();
  });

  test('create profile — Create button disabled when empty', async ({ page }) => {
    await navigateTo(page, '/profiles');
    await page.getByRole('button', { name: /Add Profile/i }).click();
    await expect(page.getByText('Create Profile')).toBeVisible();
    // Create button should be disabled when address is empty
    await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  test('create profile — success', async ({ page }) => {
    await navigateTo(page, '/profiles');
    await page.getByRole('button', { name: /Add Profile/i }).click();

    await page.getByPlaceholder('0x...').fill(
      '0x00000000000000000000000000000000000000000000000000000000e2e00001',
    );
    await page.getByPlaceholder('name.sui').fill('[E2E] test-user.sui');
    await page.getByPlaceholder('vip, early-adopter, whale').fill('e2e, test');
    await page.getByRole('button', { name: 'Create' }).click();

    // Dialog closes, profile appears in table
    await expect(page.getByText('[E2E] test-user.sui').first()).toBeVisible({ timeout: 10000 });
  });

  test('search profiles', async ({ page }) => {
    await navigateTo(page, '/profiles');
    await page.getByPlaceholder('Search profiles...').fill('[E2E]');
    await expect(page.getByText('[E2E] test-user.sui').first()).toBeVisible();

    await page.getByPlaceholder('Search profiles...').fill('zzz_no_match');
    await expect(page.getByText('[E2E] test-user.sui')).toHaveCount(0);
  });

  test('view profile detail', async ({ page }) => {
    await navigateTo(page, '/profiles');
    await page.getByPlaceholder('Search profiles...').fill('[E2E]');
    await page.getByRole('button', { name: 'View' }).first().click();
    await expect(page).toHaveURL(/\/profiles\/.+/);
  });
});
