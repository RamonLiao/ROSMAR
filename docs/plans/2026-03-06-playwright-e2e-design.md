# Playwright E2E Tests — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automated E2E tests for ROSMAR CRM covering auth guard, CRUD flows for all domain entities, and navigation.

**Architecture:** BFF test-login endpoint (NODE_ENV=test only) issues real JWT cookies. Playwright globalSetup calls it to create authenticated storageState. Each spec creates test data via BFF API, runs UI assertions, and cleans up.

**Tech Stack:** Playwright, NestJS conditional module, existing AuthService.issueTokens()

---

## Task 1: Install Playwright & scaffold config

**Files:**
- Modify: `packages/frontend/package.json` (add devDeps + scripts)
- Create: `packages/frontend/e2e/playwright.config.ts`
- Modify: `packages/frontend/.gitignore` (add e2e/.auth/)

**Step 1: Install Playwright**

```bash
cd packages/frontend && pnpm add -D @playwright/test
npx playwright install chromium
```

**Step 2: Create Playwright config**

```typescript
// packages/frontend/e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    storageState: './e2e/.auth/storage-state.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /global-setup\.ts/, teardown: 'teardown' },
    { name: 'teardown', testMatch: /global-teardown\.ts/ },
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
      dependencies: ['setup'],
    },
  ],
});
```

**Step 3: Add scripts to package.json**

```json
{
  "scripts": {
    "e2e": "playwright test --config=e2e/playwright.config.ts",
    "e2e:ui": "playwright test --config=e2e/playwright.config.ts --ui",
    "e2e:headed": "playwright test --config=e2e/playwright.config.ts --headed"
  }
}
```

**Step 4: Add `.auth/` to gitignore**

Append `e2e/.auth/` to `packages/frontend/.gitignore`.

**Step 5: Commit**

```bash
git add packages/frontend/package.json packages/frontend/e2e/ packages/frontend/.gitignore
git commit -m "chore: install Playwright and scaffold E2E config"
```

---

## Task 2: BFF TestAuthModule (conditional endpoint)

**Files:**
- Create: `packages/bff/src/auth/test-auth.controller.ts`
- Create: `packages/bff/src/auth/test-auth.module.ts`
- Modify: `packages/bff/src/app.module.ts` (conditional import)

**Step 1: Create TestAuthController**

```typescript
// packages/bff/src/auth/test-auth.controller.ts
import { Controller, Post, Res, Body } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class TestAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('test-login')
  async testLogin(
    @Body() body: { address?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const address = body?.address || '0xe2e_test_000000000000000000000000000000000000000000000000000000000001';

    // Use auth service's internal method to resolve workspace & issue tokens
    const membership = await this.authService.resolveOrCreateMembership(address);
    const tokens = this.authService.issueTokens({
      address,
      workspaceId: membership.workspaceId,
      workspaceName: membership.workspace.name,
      role: membership.roleLevel,
      permissions: membership.permissions,
    });

    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { success: true, user: tokens.user };
  }
}
```

> **Note:** `resolveOrCreateMembership` and `issueTokens` may be private. If so, make them `public` or add a dedicated `testLogin(address)` method on AuthService. Check actual visibility before implementing.

**Step 2: Create TestAuthModule**

```typescript
// packages/bff/src/auth/test-auth.module.ts
import { Module } from '@nestjs/common';
import { TestAuthController } from './test-auth.controller';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TestAuthController],
})
export class TestAuthModule {}
```

**Step 3: Conditional import in AppModule**

In `packages/bff/src/app.module.ts`, add to the `imports` array:

```typescript
...(process.env.NODE_ENV === 'test' ? [TestAuthModule] : []),
```

Add the import statement at the top:
```typescript
import { TestAuthModule } from './auth/test-auth.module';
```

**Step 4: Verify — start BFF with NODE_ENV=test and curl**

```bash
cd packages/bff
NODE_ENV=test pnpm dev &
sleep 3
curl -s -X POST http://localhost:3001/api/auth/test-login \
  -H 'Content-Type: application/json' \
  -d '{}' -v 2>&1 | grep -E 'Set-Cookie|success'
# Expected: Set-Cookie: access_token=... and Set-Cookie: refresh_token=...
```

**Step 5: Verify — normal mode has no test-login route**

```bash
NODE_ENV=development curl -s -X POST http://localhost:3001/api/auth/test-login -o /dev/null -w '%{http_code}'
# Expected: 404
```

**Step 6: Commit**

```bash
git add packages/bff/src/auth/test-auth.controller.ts packages/bff/src/auth/test-auth.module.ts packages/bff/src/app.module.ts
git commit -m "feat(bff): add TestAuthModule for E2E (NODE_ENV=test only)"
```

---

## Task 3: Playwright global setup & auth fixture

**Files:**
- Create: `packages/frontend/e2e/global-setup.ts`
- Create: `packages/frontend/e2e/global-teardown.ts`
- Create: `packages/frontend/e2e/helpers/api.helper.ts`

**Step 1: Create API helper**

```typescript
// packages/frontend/e2e/helpers/api.helper.ts
const API = process.env.API_URL || 'http://localhost:3001/api';

export class ApiHelper {
  private cookies: string = '';

  async login(address?: string): Promise<void> {
    const res = await fetch(`${API}/auth/test-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    const setCookies = res.headers.getSetCookie();
    this.cookies = setCookies.map(c => c.split(';')[0]).join('; ');
  }

  getCookies(): { name: string; value: string; domain: string; path: string }[] {
    return this.cookies.split('; ').map(c => {
      const [name, value] = c.split('=');
      return { name, value, domain: 'localhost', path: '/' };
    });
  }

  private async request(method: string, path: string, body?: unknown) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Cookie: this.cookies,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  // Profiles
  createProfile(data: { primaryAddress: string; suinsName?: string; tags?: string[] }) {
    return this.request('POST', '/profiles', data);
  }
  listProfiles() {
    return this.request('GET', '/profiles');
  }

  // Organizations
  createOrganization(data: { name: string; domain?: string; tags?: string[] }) {
    return this.request('POST', '/organizations', data);
  }
  linkProfile(orgId: string, profileId: string) {
    return this.request('POST', `/organizations/${orgId}/profiles/${profileId}`);
  }

  // Deals
  createDeal(data: { profileId: string; title: string; amountUsd: number; stage: string; notes?: string }) {
    return this.request('POST', '/deals', data);
  }

  // Segments
  createSegment(data: { name: string; description?: string; rules: unknown }) {
    return this.request('POST', '/segments', data);
  }

  // Campaigns
  createCampaign(data: { name: string; segmentId: string; workflowSteps: unknown[] }) {
    return this.request('POST', '/campaigns', data);
  }

  // Tickets
  createTicket(data: { title: string; priority?: string; assignee?: string; slaDeadline?: string }) {
    return this.request('POST', '/tickets', data);
  }
}
```

**Step 2: Create global-setup.ts**

```typescript
// packages/frontend/e2e/global-setup.ts
import { chromium } from '@playwright/test';
import { ApiHelper } from './helpers/api.helper';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup() {
  const api = new ApiHelper();
  await api.login();

  // Create browser context with cookies to generate storageState
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies(api.getCookies());

  // Also set localStorage auth-storage for Zustand auth store
  const page = await context.newPage();
  await page.goto('http://localhost:3000/login');
  await page.evaluate((addr) => {
    localStorage.setItem('auth-storage', JSON.stringify({
      state: { isAuthenticated: true, userAddress: addr },
      version: 0,
    }));
  }, '0xe2e_test_000000000000000000000000000000000000000000000000000000000001');

  const authDir = path.join(__dirname, '.auth');
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
  await context.storageState({ path: path.join(authDir, 'storage-state.json') });

  await browser.close();
}

export default globalSetup;
```

**Step 3: Create global-teardown.ts**

```typescript
// packages/frontend/e2e/global-teardown.ts
async function globalTeardown() {
  // Future: cleanup test data via API if needed
}

export default globalTeardown;
```

**Step 4: Create .auth directory and verify**

```bash
mkdir -p packages/frontend/e2e/.auth
echo '*.json' > packages/frontend/e2e/.auth/.gitignore
```

**Step 5: Commit**

```bash
git add packages/frontend/e2e/global-setup.ts packages/frontend/e2e/global-teardown.ts packages/frontend/e2e/helpers/ packages/frontend/e2e/.auth/.gitignore
git commit -m "feat(e2e): add global setup with test-login auth and API helper"
```

---

## Task 4: Auth guard tests

**Files:**
- Create: `packages/frontend/e2e/tests/auth-guard.spec.ts`

**Step 1: Write auth guard spec**

```typescript
// packages/frontend/e2e/tests/auth-guard.spec.ts
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
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByText('Choose your preferred authentication method')).toBeVisible();
    await expect(page.getByRole('button', { name: /Connect Wallet/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Use Passkey/i })).toBeVisible();
  });
});
```

**Step 2: Run and verify**

```bash
cd packages/frontend && pnpm e2e tests/auth-guard.spec.ts
# Expected: all tests pass (redirects to /login)
```

**Step 3: Commit**

```bash
git add packages/frontend/e2e/tests/auth-guard.spec.ts
git commit -m "test(e2e): auth guard redirect tests"
```

---

## Task 5: Profiles E2E tests

**Files:**
- Create: `packages/frontend/e2e/tests/profiles.spec.ts`

**Step 1: Write profiles spec**

```typescript
// packages/frontend/e2e/tests/profiles.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Profiles', () => {
  test.describe.configure({ mode: 'serial' });

  test('navigate to profiles page', async ({ page }) => {
    await page.goto('/profiles');
    await expect(page.getByRole('heading', { name: 'Profiles' })).toBeVisible();
    await expect(page.getByText('Manage your customer profiles')).toBeVisible();
    await expect(page.getByRole('button', { name: /Add Profile/i })).toBeVisible();
  });

  test('create profile — validation error on empty address', async ({ page }) => {
    await page.goto('/profiles');
    await page.getByRole('button', { name: /Add Profile/i }).click();
    await expect(page.getByText('Create Profile')).toBeVisible();
    await page.getByRole('button', { name: 'Create' }).click();
    // Create button should be disabled or validation prevents submission
    await expect(page.getByText('Create Profile')).toBeVisible(); // dialog still open
  });

  test('create profile — success', async ({ page }) => {
    await page.goto('/profiles');
    await page.getByRole('button', { name: /Add Profile/i }).click();

    await page.getByPlaceholder('0x...').fill(
      '0xe2e_profile_01_' + '0'.repeat(48)
    );
    await page.getByPlaceholder('name.sui').fill('[E2E] test-user.sui');
    await page.getByPlaceholder('vip, early-adopter, whale').fill('e2e, test');
    await page.getByRole('button', { name: 'Create' }).click();

    // Dialog closes, profile appears in table
    await expect(page.getByText('Create Profile')).not.toBeVisible();
    await expect(page.getByText('[E2E] test-user.sui')).toBeVisible();
  });

  test('search profiles', async ({ page }) => {
    await page.goto('/profiles');
    await page.getByPlaceholder('Search profiles...').fill('[E2E]');
    await expect(page.getByText('[E2E] test-user.sui')).toBeVisible();

    await page.getByPlaceholder('Search profiles...').fill('zzz_no_match');
    await expect(page.getByText('No results found')).toBeVisible();
  });

  test('view profile detail', async ({ page }) => {
    await page.goto('/profiles');
    await page.getByPlaceholder('Search profiles...').fill('[E2E]');
    await page.getByRole('button', { name: 'View' }).first().click();

    await expect(page).toHaveURL(/\/profiles\/.+/);
    await expect(page.getByRole('heading', { name: 'Profile Detail' })).toBeVisible();
  });
});
```

**Step 2: Run and verify**

```bash
cd packages/frontend && pnpm e2e tests/profiles.spec.ts
```

**Step 3: Commit**

```bash
git add packages/frontend/e2e/tests/profiles.spec.ts
git commit -m "test(e2e): profiles CRUD + search + detail"
```

---

## Task 6: Organizations E2E tests

**Files:**
- Create: `packages/frontend/e2e/tests/organizations.spec.ts`

**Step 1: Write organizations spec**

```typescript
// packages/frontend/e2e/tests/organizations.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Organizations', () => {
  test.describe.configure({ mode: 'serial' });

  test('navigate to organizations page', async ({ page }) => {
    await page.goto('/organizations');
    await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible();
    await expect(page.getByText('Manage company and organization profiles')).toBeVisible();
  });

  test('create organization', async ({ page }) => {
    await page.goto('/organizations');
    await page.getByRole('button', { name: /New Organization/i }).click();

    await page.getByPlaceholder('Acme Corp').fill('[E2E] Test Corp');
    await page.getByPlaceholder('acme.com').fill('e2e-test.com');
    await page.getByPlaceholder('enterprise, partner, prospect').fill('e2e, test');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('[E2E] Test Corp')).toBeVisible();
  });

  test('search organizations', async ({ page }) => {
    await page.goto('/organizations');
    await page.getByPlaceholder('Search organizations...').fill('[E2E]');
    await expect(page.getByText('[E2E] Test Corp')).toBeVisible();
  });

  test('view organization detail', async ({ page }) => {
    await page.goto('/organizations');
    await page.getByPlaceholder('Search organizations...').fill('[E2E]');
    await page.getByRole('button', { name: 'View' }).first().click();

    await expect(page).toHaveURL(/\/organizations\/.+/);
  });
});
```

**Step 2: Run and verify**

```bash
cd packages/frontend && pnpm e2e tests/organizations.spec.ts
```

**Step 3: Commit**

```bash
git add packages/frontend/e2e/tests/organizations.spec.ts
git commit -m "test(e2e): organizations CRUD + search + detail"
```

---

## Task 7: Deals E2E tests

**Files:**
- Create: `packages/frontend/e2e/tests/deals.spec.ts`

**Prerequisite:** Profiles test must have created at least 1 profile (or use beforeAll API setup).

**Step 1: Write deals spec**

```typescript
// packages/frontend/e2e/tests/deals.spec.ts
import { test, expect } from '@playwright/test';
import { ApiHelper } from '../helpers/api.helper';

let profileId: string;

test.describe('Deals', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    // Create a profile via API for deal creation
    const api = new ApiHelper();
    await api.login();
    const profile = await api.createProfile({
      primaryAddress: '0xe2e_deal_profile_' + '0'.repeat(47),
      suinsName: '[E2E] deal-profile.sui',
      tags: ['e2e'],
    });
    profileId = profile.id;
  });

  test('navigate to deals page', async ({ page }) => {
    await page.goto('/deals');
    await expect(page.getByRole('heading', { name: 'Deals Pipeline' })).toBeVisible();
    await expect(page.getByText('Drag and drop deals to update stages')).toBeVisible();
  });

  test('create deal', async ({ page }) => {
    await page.goto('/deals');
    await page.getByRole('button', { name: /New Deal/i }).click();
    await expect(page.getByText('Create Deal')).toBeVisible();

    // Select profile from dropdown
    await page.getByRole('combobox').first().click();
    await page.getByRole('option').first().click();

    await page.getByPlaceholder('Enterprise contract Q2').fill('[E2E] Test Deal');
    await page.getByPlaceholder('10000').fill('25000');

    // Select stage
    // Notes
    await page.getByPlaceholder('Optional notes about this deal...').fill('E2E test deal');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('[E2E] Test Deal')).toBeVisible();
  });

  test('switch to list view and search', async ({ page }) => {
    await page.goto('/deals');
    // Click list view toggle
    await page.locator('button').filter({ has: page.locator('[data-testid="list-view"]') }).or(
      page.getByRole('button', { name: /list/i })
    ).click();

    await expect(page.getByText('Browse and search all deals')).toBeVisible();
    await page.getByPlaceholder('Search deals...').fill('[E2E]');
    await expect(page.getByText('[E2E] Test Deal')).toBeVisible();
  });

  test('view deal detail', async ({ page }) => {
    await page.goto('/deals');
    // Switch to list and click a deal
    await page.locator('button').filter({ has: page.locator('[data-testid="list-view"]') }).or(
      page.getByRole('button', { name: /list/i })
    ).click();
    await page.getByText('[E2E] Test Deal').click();

    await expect(page).toHaveURL(/\/deals\/.+/);
    await expect(page.getByText('Deal details')).toBeVisible();
  });
});
```

**Step 2: Run and verify**

```bash
cd packages/frontend && pnpm e2e tests/deals.spec.ts
```

**Step 3: Commit**

```bash
git add packages/frontend/e2e/tests/deals.spec.ts
git commit -m "test(e2e): deals CRUD + list view + search + detail"
```

---

## Task 8: Tickets E2E tests

**Files:**
- Create: `packages/frontend/e2e/tests/tickets.spec.ts`

**Step 1: Write tickets spec**

```typescript
// packages/frontend/e2e/tests/tickets.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Tickets', () => {
  test.describe.configure({ mode: 'serial' });

  test('navigate to tickets page', async ({ page }) => {
    await page.goto('/tickets');
    await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible();
    await expect(page.getByText('Support ticket management with SLA tracking')).toBeVisible();
  });

  test('create ticket', async ({ page }) => {
    await page.goto('/tickets');
    await page.getByRole('button', { name: /New Ticket/i }).click();
    await expect(page.getByText('Create Ticket')).toBeVisible();

    await page.getByPlaceholder('Describe the issue').fill('[E2E] Test ticket');

    // Set SLA deadline (required) — tomorrow
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
    await page.locator('input[type="datetime-local"]').fill(tomorrow);

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('[E2E] Test ticket')).toBeVisible();
  });

  test('search tickets', async ({ page }) => {
    await page.goto('/tickets');
    await page.getByPlaceholder('Search tickets...').fill('[E2E]');
    await expect(page.getByText('[E2E] Test ticket')).toBeVisible();
  });

  test('view ticket detail and edit', async ({ page }) => {
    await page.goto('/tickets');
    await page.getByRole('button', { name: 'View' }).first().click();

    // Ticket detail dialog opens
    await expect(page.getByText('[E2E] Test ticket')).toBeVisible();
  });
});
```

**Step 2: Run and verify**

```bash
cd packages/frontend && pnpm e2e tests/tickets.spec.ts
```

**Step 3: Commit**

```bash
git add packages/frontend/e2e/tests/tickets.spec.ts
git commit -m "test(e2e): tickets CRUD + search"
```

---

## Task 9: Segments E2E tests

**Files:**
- Create: `packages/frontend/e2e/tests/segments.spec.ts`

**Step 1: Write segments spec**

```typescript
// packages/frontend/e2e/tests/segments.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Segments', () => {
  test.describe.configure({ mode: 'serial' });

  test('navigate to segments page', async ({ page }) => {
    await page.goto('/segments');
    await expect(page.getByRole('heading', { name: 'Segments' })).toBeVisible();
  });

  test('navigate to create segment page', async ({ page }) => {
    await page.goto('/segments');
    await page.getByRole('link', { name: /New Segment|Create Segment/i }).or(
      page.getByRole('button', { name: /New Segment|Create Segment/i })
    ).click();

    await expect(page).toHaveURL(/\/segments\/new/);
  });

  test('view segment detail', async ({ page }) => {
    // Create segment via API first
    const { ApiHelper } = await import('../helpers/api.helper');
    const api = new ApiHelper();
    await api.login();
    const segment = await api.createSegment({
      name: '[E2E] Test Segment',
      description: 'E2E test segment',
      rules: { conditions: [{ field: 'tags', operator: 'contains', value: 'e2e' }] },
    });

    await page.goto(`/segments/${segment.id}`);
    await expect(page.getByText('[E2E] Test Segment')).toBeVisible();
  });
});
```

**Step 2: Run and verify**

```bash
cd packages/frontend && pnpm e2e tests/segments.spec.ts
```

**Step 3: Commit**

```bash
git add packages/frontend/e2e/tests/segments.spec.ts
git commit -m "test(e2e): segments list + create + detail"
```

---

## Task 10: Campaigns E2E tests

**Files:**
- Create: `packages/frontend/e2e/tests/campaigns.spec.ts`

**Step 1: Write campaigns spec**

```typescript
// packages/frontend/e2e/tests/campaigns.spec.ts
import { test, expect } from '@playwright/test';
import { ApiHelper } from '../helpers/api.helper';

let segmentId: string;

test.describe('Campaigns', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const api = new ApiHelper();
    await api.login();
    const segment = await api.createSegment({
      name: '[E2E] Campaign Segment',
      rules: { conditions: [{ field: 'tags', operator: 'contains', value: 'e2e' }] },
    });
    segmentId = segment.id;
  });

  test('navigate to campaigns page', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
  });

  test('create campaign', async ({ page }) => {
    await page.goto('/campaigns');
    await page.getByRole('button', { name: /New Campaign/i }).click();

    // Fill campaign form (exact fields depend on UI)
    await page.getByPlaceholder(/name/i).first().fill('[E2E] Test Campaign');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('[E2E] Test Campaign')).toBeVisible();
  });
});
```

**Step 2: Run and verify**

```bash
cd packages/frontend && pnpm e2e tests/campaigns.spec.ts
```

**Step 3: Commit**

```bash
git add packages/frontend/e2e/tests/campaigns.spec.ts
git commit -m "test(e2e): campaigns list + create"
```

---

## Task 11: Navigation E2E tests

**Files:**
- Create: `packages/frontend/e2e/tests/navigation.spec.ts`

**Step 1: Write navigation spec**

```typescript
// packages/frontend/e2e/tests/navigation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('sidebar links navigate correctly', async ({ page }) => {
    await page.goto('/');
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

  test('topbar shows workspace name', async ({ page }) => {
    await page.goto('/');
    // Workspace selector should be visible in topbar
    await expect(page.locator('[data-testid="workspace-selector"]').or(
      page.getByRole('button').filter({ hasText: /workspace/i })
    ).first()).toBeVisible();
  });

  test('dashboard shows overview cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Total Profiles')).toBeVisible();
    await expect(page.getByText('Active Deals')).toBeVisible();
    await expect(page.getByText('Pipeline Total')).toBeVisible();
  });

  test('ROSMAR branding visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('ROSMAR')).toBeVisible();
  });
});
```

**Step 2: Run and verify**

```bash
cd packages/frontend && pnpm e2e tests/navigation.spec.ts
```

**Step 3: Commit**

```bash
git add packages/frontend/e2e/tests/navigation.spec.ts
git commit -m "test(e2e): navigation sidebar + topbar + dashboard"
```

---

## Task 12: Full suite run & cleanup

**Step 1: Run all E2E tests**

```bash
cd packages/frontend && pnpm e2e
```

**Step 2: Fix any selector mismatches**

Common fixes needed:
- Exact heading text vs. partial match
- Button name casing
- Select/combobox interaction patterns (shadcn vs native)
- Timing — add `waitForLoadState` or `waitForResponse` where needed

**Step 3: Final commit**

```bash
git add -A
git commit -m "test(e2e): full Playwright E2E suite for ROSMAR CRM"
```

---

## Implementation Notes

### Selector Strategy
- Prefer `getByRole()` and `getByText()` — most resilient
- Use `getByPlaceholder()` for form fields (matches UI labels from exploration)
- Avoid CSS selectors unless no semantic alternative exists
- Add `data-testid` attributes to components only when role/text selectors fail

### Shadcn Select/Combobox
- shadcn `<Select>` renders as `<button role="combobox">` + `<div role="listbox">`
- May need `page.getByRole('combobox').click()` then `page.getByRole('option', { name: 'value' }).click()`
- Test in headed mode first: `pnpm e2e:headed`

### Auth Store Sync
- storageState saves cookies + localStorage
- Zustand `auth-storage` must have `isAuthenticated: true` to bypass client-side redirect
- Both are set in global-setup.ts

### Debugging
- `pnpm e2e:headed` — watch tests run in browser
- `pnpm e2e:ui` — Playwright UI mode with step-by-step replay
- `trace: 'on-first-retry'` — generates trace zip on failure
