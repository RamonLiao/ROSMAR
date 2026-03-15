# P2-11: Performance SLA Validation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CI performance gates (bundle size, Lighthouse, API latency), optimize profile page with BFF aggregation endpoint, and add runtime Web Vitals tracking.

**Architecture:** Five independent chunks: (1) Bundle size CI workflow, (2) Lighthouse CI workflow, (3) BFF profile summary aggregation + Redis cache, (4) k6 API latency SLA in CI, (5) Web Vitals runtime tracking. Frontend consumes new `/profiles/:id/summary` endpoint for initial render; tabs remain lazy-fetched.

**Tech Stack:** Next.js 16, NestJS 11, Prisma 7, k6, `@lhci/cli`, `web-vitals`, GitHub Actions, Redis (ioredis via existing `CacheService`)

**Spec:** `docs/superpowers/specs/2026-03-15-p2-11-performance-sla-design.md`

---

## Chunk 1: Bundle Size CI Gate

### Task 1: Bundle Analysis GitHub Action

**Files:**
- Create: `.github/workflows/bundle-analysis.yml`

- [ ] **Step 1: Create bundle-analysis workflow**

```yaml
name: Bundle Analysis

on:
  pull_request:
    branches: [main]
    paths:
      - 'packages/frontend/**'
      - 'pnpm-lock.yaml'

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: latest

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Build frontend
        working-directory: packages/frontend
        run: pnpm build

      - name: Analyze bundle
        uses: hashicorp/nextjs-bundle-analysis@v0.7
        with:
          working-directory: packages/frontend
          build-directory: .next
```

- [ ] **Step 2: Verify YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/bundle-analysis.yml'))"`

Expected: No error

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/bundle-analysis.yml
git commit -m "ci: add Next.js bundle size analysis on PR"
```

---

## Chunk 2: Lighthouse CI

### Task 2: Lighthouse CI Configuration

**Files:**
- Create: `.lighthouserc.js`
- Create: `.github/workflows/lighthouse.yml`

- [ ] **Step 1: Create .lighthouserc.js**

```javascript
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'cd packages/frontend && pnpm start',
      startServerReadyPattern: 'Ready in',
      startServerReadyTimeout: 30000,
      url: ['http://localhost:3000/login'],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.75 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.8 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

- [ ] **Step 2: Create lighthouse workflow**

```yaml
name: Lighthouse CI

on:
  pull_request:
    branches: [main]
    paths:
      - 'packages/frontend/**'
      - 'pnpm-lock.yaml'

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: latest

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Build frontend
        working-directory: packages/frontend
        env:
          NEXT_PUBLIC_API_URL: http://localhost:9999/api
        run: pnpm build

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v12
        with:
          configPath: .lighthouserc.js
          uploadArtifacts: true
```

- [ ] **Step 3: Verify YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/lighthouse.yml'))"`

Expected: No error

- [ ] **Step 4: Commit**

```bash
git add .lighthouserc.js .github/workflows/lighthouse.yml
git commit -m "ci: add Lighthouse CI audit on PR"
```

---

## Chunk 3: BFF Profile Summary Aggregation

### Task 3: ProfileService.getSummary()

**Files:**
- Modify: `packages/bff/src/profile/profile.service.ts`

- [ ] **Step 1: Add getSummary method to ProfileService**

Add at the end of the class (before the closing `}`), after the `setPrimaryDomain` method:

```typescript
  // ── Summary Aggregation ─────────────────────────────────────

  async getSummary(workspaceId: string, profileId: string) {
    const profile = await this.prisma.profile.findFirstOrThrow({
      where: { id: profileId, workspaceId },
    });

    const [
      wallets,
      netWorth,
      recentActivity,
      socialLinks,
      assetCount,
      organizationCount,
      messageCount,
    ] = await Promise.all([
      this.prisma.profileWallet.findMany({
        where: { profileId },
        orderBy: { createdAt: 'desc' },
      }),
      this.balanceAggregator.getNetWorth(profileId),
      this.prisma.walletEvent.findMany({
        where: { profileId },
        orderBy: { time: 'desc' },
        take: 5,
      }),
      this.prisma.socialLink.findMany({
        where: { profileId },
        orderBy: { linkedAt: 'desc' },
      }),
      this.prisma.walletEvent.count({ where: { profileId } }),
      this.prisma.profileOrganization.count({ where: { profileId } }),
      this.prisma.message.count({ where: { profileId } }),
    ]);

    return {
      profile,
      wallets,
      netWorth,
      recentActivity,
      socialLinks,
      stats: { assetCount, organizationCount, messageCount },
    };
  }
```

- [ ] **Step 2: Verify tsc**

Run: `cd packages/bff && npx tsc --noEmit`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/bff/src/profile/profile.service.ts
git commit -m "feat(profile): add getSummary aggregation method"
```

---

### Task 4: Summary Endpoint with Redis Cache

**Files:**
- Modify: `packages/bff/src/profile/profile.controller.ts`

Note: `CacheModule` is `@Global()` — no need to import it in `profile.module.ts`. `CacheService` is already available for injection.

- [ ] **Step 1: Add GET :id/summary endpoint to profile.controller.ts**

Add import at the top:

```typescript
import { CacheService } from '../common/cache/cache.service';
```

Add `CacheService` to constructor:

```typescript
constructor(
  private readonly profileService: ProfileService,
  private readonly walletClusterService: WalletClusterService,
  private readonly cacheService: CacheService,
) {}
```

Add the endpoint method (place it after `getProfile`, before `getAssets`):

```typescript
  @Get(':id/summary')
  async getSummary(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    const cacheKey = `profile-summary:${user.workspaceId}:${id}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const summary = await this.profileService.getSummary(user.workspaceId, id);
    await this.cacheService.set(cacheKey, summary, 60);
    return summary;
  }
```

- [ ] **Step 3: Verify tsc**

Run: `cd packages/bff && npx tsc --noEmit`

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/bff/src/profile/profile.controller.ts
git commit -m "feat(profile): add GET /profiles/:id/summary with 60s Redis cache"
```

---

### Task 5: Frontend useProfileSummary Hook

**Files:**
- Create: `packages/frontend/src/lib/hooks/use-profile-summary.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { Profile } from './use-profiles';

interface ProfileSummary {
  profile: Profile;
  wallets: Array<{
    id: string;
    chain: string;
    address: string;
    ensName: string | null;
    snsName: string | null;
    createdAt: string;
  }>;
  netWorth: {
    totalUsd: number;
    chains: Record<string, number>;
  };
  recentActivity: Array<{
    id: string;
    eventType: string;
    collection: string | null;
    amount: number | null;
    time: string;
  }>;
  socialLinks: Array<{
    id: string;
    platform: string;
    platformUserId: string;
    linkedAt: string;
  }>;
  stats: {
    assetCount: number;
    organizationCount: number;
    messageCount: number;
  };
}

export function useProfileSummary(id: string) {
  return useQuery({
    queryKey: ['profile', id, 'summary'],
    queryFn: () => apiClient.get<ProfileSummary>(`/profiles/${id}/summary`),
    enabled: !!id,
    staleTime: 30_000, // 30s — summary is cached server-side for 60s
  });
}
```

- [ ] **Step 2: Verify tsc**

Run: `cd packages/frontend && npx tsc --noEmit`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/lib/hooks/use-profile-summary.ts
git commit -m "feat(frontend): add useProfileSummary hook"
```

---

### Task 6: Refactor Profile Page to Use Summary

**Files:**
- Modify: `packages/frontend/src/app/(dashboard)/profiles/[id]/page.tsx`

- [ ] **Step 1: Replace individual hooks with useProfileSummary for initial render**

Replace the import line:

```typescript
import { useProfile, useUpdateProfileTags, useProfileOrganizations } from "@/lib/hooks/use-profiles";
```

With:

```typescript
import { useUpdateProfileTags, useProfileOrganizations } from "@/lib/hooks/use-profiles";
import { useProfileSummary } from "@/lib/hooks/use-profile-summary";
```

Replace the hook calls at the top of the component:

```typescript
  const { data: profile, isLoading, error } = useProfile(id);
  const { mutateAsync: updateTags, isPending: isUpdating } =
    useUpdateProfileTags();
  const { data: relatedOrgs, isLoading: orgsLoading } = useProfileOrganizations(id);

  const { data: messageHistory } = useMessageHistory(id);
  const sendMessage = useSendMessage();
```

With:

```typescript
  const { data: summary, isLoading, error } = useProfileSummary(id);
  const profile = summary?.profile;
  const { mutateAsync: updateTags, isPending: isUpdating } =
    useUpdateProfileTags();
  const { data: relatedOrgs, isLoading: orgsLoading } = useProfileOrganizations(id);

  const { data: messageHistory } = useMessageHistory(id);
  const sendMessage = useSendMessage();
```

Remove the `useProfile` import from `use-profiles` (it was the only one removed; `useProfileOrganizations` stays since orgs are not in summary — they remain lazy).

Also remove `useSendMessage, useMessageHistory` from their hook import if they were imported separately — keep them as-is since messages tab is lazy.

- [ ] **Step 2: Verify tsc**

Run: `cd packages/frontend && npx tsc --noEmit`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/app/(dashboard)/profiles/[id]/page.tsx
git commit -m "feat(frontend): use profile summary for initial render, lazy tabs unchanged"
```

---

## Chunk 4: k6 API Latency SLA

### Task 7: k6 Seed Script

**Files:**
- Create: `packages/bff/k6/seed.ts`

- [ ] **Step 1: Create seed script**

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create test workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: 'perf-test-workspace' },
    update: {},
    create: {
      id: 'perf-test-workspace',
      name: 'Perf Test Workspace',
      ownerAddress: '0x0000000000000000000000000000000000000000000000000000000000000001',
    },
  });

  // Create test profile
  const profile = await prisma.profile.upsert({
    where: { id: 'perf-test-profile' },
    update: {},
    create: {
      id: 'perf-test-profile',
      workspaceId: workspace.id,
      primaryAddress: '0x0000000000000000000000000000000000000000000000000000000000000002',
      suinsName: 'perftest.sui',
      tags: ['vip', 'whale', 'defi'],
      tier: 3,
      engagementScore: 85,
      version: 1,
    },
  });

  // Add wallets
  await prisma.profileWallet.upsert({
    where: { id: 'perf-wallet-sui' },
    update: {},
    create: {
      id: 'perf-wallet-sui',
      profileId: profile.id,
      chain: 'sui',
      address: '0x0000000000000000000000000000000000000000000000000000000000000002',
    },
  });

  await prisma.profileWallet.upsert({
    where: { id: 'perf-wallet-evm' },
    update: {},
    create: {
      id: 'perf-wallet-evm',
      profileId: profile.id,
      chain: 'evm',
      address: '0x0000000000000000000000000000000000000000',
      ensName: 'perftest.eth',
    },
  });

  // Add timeline events
  const events = Array.from({ length: 50 }, (_, i) => ({
    profileId: profile.id,
    eventType: i % 3 === 0 ? 'TransferObject' : i % 3 === 1 ? 'SwapEvent' : 'StakeEvent',
    collection: i % 2 === 0 ? 'SuiFrens' : null,
    amount: Math.random() * 1000,
    txDigest: `perftest-tx-${i}`,
    time: new Date(Date.now() - i * 3600_000),
  }));

  for (const e of events) {
    await prisma.walletEvent.create({ data: e });
  }

  // Add social links
  await prisma.socialLink.upsert({
    where: { id: 'perf-social-discord' },
    update: {},
    create: {
      id: 'perf-social-discord',
      profileId: profile.id,
      platform: 'discord',
      platformUserId: '123456789',
    },
  });

  console.log('Perf seed complete: workspace=%s profile=%s', workspace.id, profile.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Verify tsc**

Run: `cd packages/bff && npx tsc --noEmit --esModuleInterop k6/seed.ts`

Expected: No errors (or minor — this is a standalone script)

- [ ] **Step 3: Commit**

```bash
git add packages/bff/k6/seed.ts
git commit -m "feat(k6): add perf test seed script"
```

---

### Task 8: k6 SLA Test Script

**Files:**
- Create: `packages/bff/k6/profile-sla.js`

- [ ] **Step 1: Create k6 test script**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api';
const PROFILE_ID = 'perf-test-profile';

export const options = {
  scenarios: {
    sla_smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 20,
      maxDuration: '60s',
    },
  },
  thresholds: {
    'http_req_duration{endpoint:summary}': ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{endpoint:profile}': ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{endpoint:wallets}': ['p(95)<500'],
    'http_req_duration{endpoint:assets}': ['p(95)<800'],
    'http_req_duration{endpoint:timeline}': ['p(95)<300'],
  },
};

// Authenticate via test-login endpoint (NODE_ENV=test enables TestAuthModule)
// Returns session cookies to use in all subsequent requests
export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/auth/test-login`,
    JSON.stringify({
      address: '0x0000000000000000000000000000000000000000000000000000000000000001',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  check(loginRes, { 'login 200': (r) => r.status === 200 });

  // Extract Set-Cookie headers for session
  const jar = http.cookieJar();
  const cookies = jar.cookiesForURL(BASE_URL);
  return { cookies: loginRes.headers['Set-Cookie'] || '' };
}

export default function (data) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      Cookie: data.cookies,
    },
  };

  // GET /profiles/:id/summary
  const summary = http.get(
    `${BASE_URL}/profiles/${PROFILE_ID}/summary`,
    Object.assign({}, params, { tags: { endpoint: 'summary' } }),
  );
  check(summary, {
    'summary 200': (r) => r.status === 200,
    'summary has profile': (r) => JSON.parse(r.body).profile !== undefined,
  });

  // GET /profiles/:id
  const profile = http.get(
    `${BASE_URL}/profiles/${PROFILE_ID}`,
    Object.assign({}, params, { tags: { endpoint: 'profile' } }),
  );
  check(profile, { 'profile 200': (r) => r.status === 200 });

  // GET /profiles/:id/wallets
  const wallets = http.get(
    `${BASE_URL}/profiles/${PROFILE_ID}/wallets`,
    Object.assign({}, params, { tags: { endpoint: 'wallets' } }),
  );
  check(wallets, { 'wallets 200': (r) => r.status === 200 });

  // GET /profiles/:id/assets
  const assets = http.get(
    `${BASE_URL}/profiles/${PROFILE_ID}/assets`,
    Object.assign({}, params, { tags: { endpoint: 'assets' } }),
  );
  check(assets, { 'assets 200': (r) => r.status === 200 });

  // GET /profiles/:id/timeline
  const timeline = http.get(
    `${BASE_URL}/profiles/${PROFILE_ID}/timeline?limit=20`,
    Object.assign({}, params, { tags: { endpoint: 'timeline' } }),
  );
  check(timeline, { 'timeline 200': (r) => r.status === 200 });

  sleep(0.5);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/bff/k6/profile-sla.js
git commit -m "feat(k6): add profile SLA smoke test script"
```

---

### Task 9: CI Perf Job

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add perf job to ci.yml**

Add a new job after `docker-build`:

```yaml
  perf-sla:
    runs-on: ubuntu-latest
    needs: lint-and-test
    services:
      postgres:
        image: timescale/timescaledb:latest-pg16
        env:
          POSTGRES_DB: crm
          POSTGRES_USER: crm
          POSTGRES_PASSWORD: crm_ci_password
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U crm"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: latest

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        working-directory: packages/bff
        run: npx prisma generate

      - name: Run migrations
        working-directory: packages/bff
        env:
          DATABASE_URL: postgresql://crm:crm_ci_password@localhost:5432/crm
        run: npx prisma migrate deploy

      - name: Seed perf data
        working-directory: packages/bff
        env:
          DATABASE_URL: postgresql://crm:crm_ci_password@localhost:5432/crm
        run: npx ts-node k6/seed.ts

      - name: Build BFF
        working-directory: packages/bff
        run: pnpm build

      - name: Start BFF server
        working-directory: packages/bff
        env:
          DATABASE_URL: postgresql://crm:crm_ci_password@localhost:5432/crm
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          SUI_DRY_RUN: "true"
          NODE_ENV: test
          PORT: 3001
        run: node dist/main &

      - name: Wait for BFF health
        run: |
          for i in $(seq 1 30); do
            if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
              echo "BFF is ready"
              exit 0
            fi
            sleep 2
          done
          echo "BFF failed to start"
          exit 1

      - name: Install k6
        uses: grafana/k6-action@v0.3.1
        with:
          filename: packages/bff/k6/profile-sla.js
          flags: --env BASE_URL=http://localhost:3001/api
```

- [ ] **Step 2: Verify YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`

Expected: No error

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add k6 perf SLA job with profile endpoint thresholds"
```

---

## Chunk 5: Web Vitals Runtime Tracking

### Task 10: Web Vitals Reporter (Frontend)

**Files:**
- Create: `packages/frontend/src/lib/web-vitals.ts`
- Create: `packages/frontend/src/components/web-vitals-reporter.tsx`
- Modify: `packages/frontend/src/app/layout.tsx`

- [ ] **Step 1: Install web-vitals**

Run: `cd packages/frontend && pnpm add web-vitals`

- [ ] **Step 2: Create web-vitals.ts reporter**

```typescript
import type { Metric } from 'web-vitals';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export function reportWebVitals(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    timestamp: Date.now(),
  });

  const url = `${API_URL}/analytics/vitals`;

  // Use sendBeacon for reliability (survives page unload)
  // Must use Blob to set Content-Type — sendBeacon with string sends text/plain
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
  } else {
    fetch(url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {});
  }
}
```

- [ ] **Step 3: Create web-vitals-reporter.tsx client component**

```tsx
'use client';

import { useEffect } from 'react';
import { reportWebVitals } from '@/lib/web-vitals';

export function WebVitalsReporter() {
  useEffect(() => {
    // Dynamic import web-vitals (heavy lib) — only in browser
    import('web-vitals').then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      onLCP(reportWebVitals);
      onINP(reportWebVitals);
      onCLS(reportWebVitals);
      onFCP(reportWebVitals);
      onTTFB(reportWebVitals);
    });
  }, []);

  return null;
}
```

- [ ] **Step 4: Mount in layout.tsx**

In `packages/frontend/src/app/layout.tsx`, add import:

```typescript
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
```

Add `<WebVitalsReporter />` inside the `<body>` tag, right before `<ThemeProvider>`:

```tsx
<body ...>
  <WebVitalsReporter />
  <ThemeProvider>
```

- [ ] **Step 5: Verify tsc**

Run: `cd packages/frontend && npx tsc --noEmit`

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/lib/web-vitals.ts packages/frontend/src/components/web-vitals-reporter.tsx packages/frontend/src/app/layout.tsx
git commit -m "feat(frontend): add Web Vitals runtime reporting (LCP, INP, CLS, FCP, TTFB)"
```

---

### Task 11: Vitals Endpoint (BFF)

The existing `AnalyticsController` has class-level `@UseGuards(SessionGuard, RbacGuard)`. The vitals endpoint needs to be unauthenticated (fire-and-forget from browser). Create a separate unguarded controller.

**Files:**
- Create: `packages/bff/src/analytics/vitals.controller.ts`
- Modify: `packages/bff/src/analytics/analytics.module.ts`

- [ ] **Step 1: Create vitals.controller.ts**

```typescript
import { Controller, Post, Body, Logger } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller('analytics')
export class VitalsController {
  private readonly logger = new Logger(VitalsController.name);

  @Post('vitals')
  reportVitals(
    @Body() body: { name: string; value: number; rating: string; pathname: string; timestamp: number },
  ) {
    this.logger.log({
      msg: 'web-vital',
      metric: body.name,
      value: body.value,
      rating: body.rating,
      pathname: body.pathname,
      timestamp: body.timestamp,
    });
    return { ok: true };
  }
}
```

- [ ] **Step 2: Register in analytics.module.ts**

In `packages/bff/src/analytics/analytics.module.ts`, add import and register:

```typescript
import { VitalsController } from './vitals.controller';
```

Update `controllers`:

```typescript
controllers: [AnalyticsController, VitalsController],
```

- [ ] **Step 3: Verify tsc**

Run: `cd packages/bff && npx tsc --noEmit`

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/bff/src/analytics/vitals.controller.ts packages/bff/src/analytics/analytics.module.ts
git commit -m "feat(analytics): add POST /analytics/vitals endpoint for Web Vitals reporting"
```

---

## Chunk 6: Integration Verification

### Task 12: Full Type Check + Test

- [ ] **Step 1: BFF type check**

Run: `cd packages/bff && npx tsc --noEmit`

Expected: No errors

- [ ] **Step 2: Frontend type check**

Run: `cd packages/frontend && npx tsc --noEmit`

Expected: No errors

- [ ] **Step 3: BFF tests**

Run: `cd packages/bff && npx jest --no-coverage`

Expected: All existing tests pass (pre-existing failures in social-link, gdpr, deal-document are known)

- [ ] **Step 4: Fix any issues and commit**

```bash
git add -u
git commit -m "fix: resolve type errors from P2-11 integration"
```
