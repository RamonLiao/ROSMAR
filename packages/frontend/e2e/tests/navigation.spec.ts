import { test, expect } from '@playwright/test';
import { navigateTo } from '../helpers/navigation.helper';

test.describe('Navigation', () => {
  test('sidebar links navigate correctly', async ({ page }) => {
    await navigateTo(page, '/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const navItems = [
      { name: 'Profiles', url: '/profiles' },
      { name: 'Organizations', url: '/organizations' },
      { name: 'Deals', url: '/deals' },
      { name: 'Segments', url: '/segments' },
      { name: 'Campaigns', url: '/campaigns' },
      { name: 'Tickets', url: '/tickets' },
      { name: 'Vault', url: '/vault' },
      { name: 'Analytics', url: '/analytics' },
    ];

    for (const item of navItems) {
      await page.getByRole('link', { name: item.name }).click();
      await expect(page).toHaveURL(item.url);
    }
  });

  test('workspace selector visible', async ({ page }) => {
    await navigateTo(page, '/');
    await expect(
      page.getByRole('button', { name: /Select Workspace/i }),
    ).toBeVisible();
  });

  test('dashboard shows overview cards', async ({ page }) => {
    await navigateTo(page, '/');
    await expect(page.getByText('Total Profiles')).toBeVisible();
    await expect(page.getByText('Active Deals')).toBeVisible();
    await expect(page.getByText('Pipeline Total')).toBeVisible();
  });

  test('ROSMAR branding visible', async ({ page }) => {
    await navigateTo(page, '/');
    // ROSMAR is a <span> in the sidebar, only visible when expanded
    await expect(page.locator('text=ROSMAR').first()).toBeVisible();
  });
});
