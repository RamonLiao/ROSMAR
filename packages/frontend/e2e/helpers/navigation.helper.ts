import type { Page } from '@playwright/test';

const SIDEBAR_LINKS: Record<string, string> = {
  '/profiles': 'Profiles',
  '/organizations': 'Organizations',
  '/deals': 'Deals',
  '/segments': 'Segments',
  '/campaigns': 'Campaigns',
  '/tickets': 'Tickets',
  '/vault': 'Vault',
  '/analytics': 'Analytics',
  '/settings/workspace': 'Settings',
};

/**
 * Navigate to a page, handling Zustand persist hydration race.
 *
 * For known sidebar routes: goto('/') → wait for hydration → click sidebar link.
 * For detail pages (with IDs): goto('/') → sidebar → then page.goto(detailUrl).
 */
export async function navigateTo(page: Page, path: string) {
  // 1. Go to root and wait for hydration to settle
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  if (path === '/') return;

  // 2. Check if this is a known sidebar route
  const linkName = SIDEBAR_LINKS[path];
  if (linkName) {
    await page.getByRole('link', { name: linkName }).click();
    await page.waitForLoadState('networkidle');
    return;
  }

  // 3. For detail pages (/profiles/:id etc.), first navigate to the parent
  //    via sidebar, then use direct navigation (JS state is now warm)
  const parentPath = '/' + path.split('/')[1]; // e.g. '/profiles'
  const parentLink = SIDEBAR_LINKS[parentPath];
  if (parentLink) {
    await page.getByRole('link', { name: parentLink }).click();
    await page.waitForLoadState('networkidle');
  }

  // Client-side navigation via URL bar (Next.js Link-style)
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}
