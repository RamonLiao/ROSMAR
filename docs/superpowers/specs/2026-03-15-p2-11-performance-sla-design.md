# P2-11: Performance SLA Validation

> **Goal:** Add CI performance gates (bundle size, Lighthouse, API latency) + optimize profile page load to < 1s + runtime Web Vitals tracking.

**Tech Stack:** Next.js 16, NestJS 11, Prisma 7, k6, Lighthouse CI, web-vitals, GitHub Actions

---

## 1. Bundle Size Gate (CI)

**Tool:** `hashicorp/nextjs-bundle-analysis` GitHub Action

- Runs on PR — `next build` → analyze `.next/` output → PR comment with size diff vs main
- Budget: First Load JS ≤ **300kB gzipped** (accounts for `@mysten/sui` + wallet SDK overhead; `next build` reports gzipped sizes)
- Initially warning-only; tighten to error after baseline observation

**Files:**
- Create: `.github/workflows/bundle-analysis.yml` (standalone workflow, PR trigger only)

**No changes to existing `ci.yml`.**

---

## 2. Lighthouse CI (GitHub Actions)

**Tool:** `treosh/lighthouse-ci-action` v12+

- PR workflow: `next build` → `next start` → Lighthouse audit
- Audited pages: `/login` (no data deps, clean measurement)
- Profile page (`/profiles/[id]`) deferred — requires DB seed or stub API to be meaningful; with mock API it only measures loading/error state. Will add when CI DB seeding is implemented (see future-enhancements).

**Thresholds (`.lighthouserc.js`):**

| Category | Warn | Error |
|----------|------|-------|
| Performance | ≥ 75 | ≥ 65 |
| Accessibility | — | ≥ 90 |
| Best Practices | — | ≥ 80 |

Performance set low due to Web3 SDK bundle size + mock API fetch failures. Tighten incrementally.

**Files:**
- Create: `.lighthouserc.js`
- Create: `.github/workflows/lighthouse.yml` (standalone workflow)

---

## 3. API Latency SLA (k6)

**Tool:** k6 (Grafana)

- k6 script tests profile read endpoints with SLA thresholds
- Runs in CI after `test` job — reuses existing TimescaleDB + Redis services
- Seed script populates test workspace + profile with wallets/social links
- `SUI_DRY_RUN=true` to mock chain calls

**Endpoints & Thresholds:**

| Endpoint | p(95) | p(99) |
|----------|-------|-------|
| `GET /profiles/:id` | < 500ms | < 1000ms |
| `GET /profiles/:id/wallets` | < 500ms | — |
| `GET /profiles/:id/assets` | < 800ms | — |
| `GET /profiles/:id/timeline` | < 300ms | — |

**Files:**
- Create: `packages/bff/k6/profile-sla.js` — k6 test script
- Create: `packages/bff/k6/seed.ts` — Prisma seed for perf test data
- Modify: `.github/workflows/ci.yml` — add `perf` job after `test`

**k6 installation:** Use `grafana/k6-action` GitHub Action (k6 is a Go binary, not an npm package).

**CI Flow:**
```
test job (existing) → perf job (new)
  ├── install k6 (grafana/k6-action)
  ├── start BFF server (background)
  ├── wait for health check (curl --retry 10 --retry-delay 2 http://localhost:3001/health)
  ├── run seed script
  ├── k6 run profile-sla.js
  └── threshold breach → CI fail
```

---

## 4. Profile Page Optimization — BFF Aggregation

**Goal:** Reduce multiple parallel frontend queries to 1 initial call, achieving < 1s interactive.

**New endpoint:** `GET /profiles/:id/summary`

**Response shape:**
```typescript
interface ProfileSummary {
  profile: Profile;            // basic info + tags
  wallets: Wallet[];           // wallet list
  netWorth: NetWorthSummary;   // aggregated net worth
  recentActivity: Timeline[];  // latest 5 timeline entries
  socialLinks: SocialLink[];   // social connections
  stats: {
    assetCount: number;
    organizationCount: number;
    messageCount: number;
  };
}
```

**BFF:**
- `ProfileService.getSummary(id)` — `Promise.all()` parallel Prisma queries
- No chain calls (pure DB)
- Redis cache with 60s TTL
- Target: < 200ms response time

**Frontend:**
- New `useProfileSummary(id)` hook — single fetch for initial render
- Tabs (Assets detail, Messages, NFT traits) remain lazy-fetched on click
- React Query `placeholderData` — summary wallets/timeline as tab placeholders

**Files:**
- Modify: `packages/bff/src/profile/profile.service.ts` — add `getSummary()`
- Modify: `packages/bff/src/profile/profile.controller.ts` — add `GET :id/summary`
- Create: `packages/frontend/src/lib/hooks/use-profile-summary.ts`
- Modify: `packages/frontend/src/app/(dashboard)/profiles/[id]/page.tsx` — consume summary hook

---

## 5. Web Vitals Runtime Tracking

**Tool:** `web-vitals` library (~1.5kB, Google official)

- Measures LCP, INP, CLS, FCP, TTFB in production (INP replaced FID as Core Web Vital in March 2024)
- Reports to BFF `POST /analytics/vitals` (fire-and-forget)
- BFF logs via pino (structured); can pipe to Grafana/Datadog later

**Payload:**
```typescript
interface VitalsPayload {
  name: 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  pathname: string;
  timestamp: number;
}
```

**Files:**
- Create: `packages/frontend/src/lib/web-vitals.ts` — reporter function
- Create: `packages/frontend/src/components/web-vitals-reporter.tsx` — client component
- Modify: `packages/frontend/src/app/layout.tsx` — mount reporter
- Create: `packages/bff/src/analytics/analytics.controller.ts`
- Create: `packages/bff/src/analytics/analytics.module.ts`
- Modify: `packages/bff/src/app.module.ts` — import AnalyticsModule
