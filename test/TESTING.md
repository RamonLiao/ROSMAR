# ROSMAR CRM — Testing Guide

## Quick Reference

```bash
# Run everything
pnpm test                          # All packages (BFF + Frontend)

# Move contracts (from packages/move/<package>/)
sui move test                      # All tests in current package
sui move test -v                   # Verbose output

# BFF (from packages/bff/ or root with -F)
pnpm -F bff test                   # Unit tests (*.spec.ts)
pnpm -F bff test:e2e               # E2E tests (*.e2e-spec.ts)
pnpm -F bff test:cov               # Coverage report

# Frontend (from packages/frontend/ or root with -F)
pnpm -F frontend test:run          # Single run (CI)
pnpm -F frontend test              # Watch mode
pnpm -F frontend test:ui           # Vitest UI
```

---

## 1. Move Smart Contracts (68 tests)

### Stack
- Sui Move 2024.beta edition
- Built-in `sui::test_scenario` framework
- `sui move test` CLI

### Package Structure

| Package | Tests | Coverage |
|---------|-------|----------|
| `crm_core` | 30 | Capabilities, ACL, Workspace, Profile, Organization, Relation |
| `crm_data` | 18 | Segment, Campaign, Deal, Ticket |
| `crm_vault` | 11 | Vault, Policy |
| `crm_action` | 9 | Airdrop, Reward |

### File Convention
```
packages/move/<package>/tests/<package>_tests.move
```

### Writing a New Test

```move
#[test_only]
module crm_core::crm_core_tests {
    use sui::test_scenario::{Self as ts};
    use sui::test_utils;
    use crm_core::capabilities;
    use crm_core::workspace;

    const ADMIN: address = @0xAD;

    #[test]
    fun test_example() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);

        // 1. Setup — use test_create_* helpers
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(
            &config, string::utf8(b"Test"), ctx
        );

        // 2. Assert
        assert!(workspace::owner(&workspace) == ADMIN);

        // 3. Cleanup — destroy all owned objects
        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        ts::end(scenario);
    }
}
```

### Expected Failure Pattern

```move
#[test]
#[expected_failure(abort_code = deal::EInvalidTransition)]
fun test_won_deal_cannot_go_back() {
    // ... setup ...
    deal::advance_stage(&config, &ws, &cap, &mut d, 0, deal::stage_won(), ctx);
    deal::advance_stage(&config, &ws, &cap, &mut d, 1, deal::stage_qualified(), ctx);
    // ^ aborts here, test passes
    // cleanup still needed (compiler requires it)
}
```

### Test Helpers

Source modules expose `#[test_only]` constructors:
```move
capabilities::test_create_config(ctx)       // GlobalConfig
capabilities::test_create_pause_cap(ctx)    // EmergencyPauseCap
```

### Run

```bash
cd packages/move/crm_core && sui move test
cd packages/move/crm_data && sui move test
cd packages/move/crm_vault && sui move test
cd packages/move/crm_action && sui move test
```

---

## 2. BFF — Backend for Frontend (25 E2E tests)

### Stack
- Jest 30 + ts-jest
- NestJS `@nestjs/testing`
- Supertest for HTTP assertions
- Custom mocks for `@mysten/sui` and `@mysten/enoki`

### File Convention
```
packages/bff/src/**/*.spec.ts          # Unit tests
packages/bff/test/**/*.e2e-spec.ts     # E2E tests
packages/bff/test/__mocks__/           # Module mocks
```

### Mock Architecture

E2E tests mock the entire Sui layer via `jest-e2e.json` moduleNameMapper:

```
@mysten/sui/jsonRpc       → test/__mocks__/@mysten/sui/jsonRpc.ts
@mysten/sui/transactions  → test/__mocks__/@mysten/sui/transactions.ts
@mysten/sui/verify        → test/__mocks__/@mysten/sui/verify.ts
@mysten/sui/keypairs/*    → test/__mocks__/@mysten/sui/keypairs/*.ts
@mysten/sui/utils         → test/__mocks__/@mysten/sui/utils.ts
@mysten/enoki             → test/__mocks__/@mysten/enoki.ts
```

### E2E Test Pattern

```typescript
// test/app.e2e-spec.ts
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

// 1. Mock user & guards
const mockUser = { address: '0xabc123', workspaceId: 'ws-001', role: 3, permissions: 31 };
const mockSessionGuard = { canActivate: (ctx) => { ctx.switchToHttp().getRequest().user = mockUser; return true; } };

// 2. Build test module
beforeAll(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(SessionGuard).useValue(mockSessionGuard)
    .overrideGuard(RbacGuard).useValue({ canActivate: () => true })
    .overrideProvider(PrismaService).useValue(buildPrismaMock())
    .compile();
  app = module.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
});

// 3. Test
it('POST /api/deals — create deal', async () => {
  prisma.deal.create.mockResolvedValue(sampleDeal);
  const res = await request(app.getHttpServer())
    .post('/api/deals')
    .send({ profileId: 'p-001', title: 'Big Deal', amountUsd: 10000, stage: 'prospecting' })
    .expect(201);
  expect(res.body).toHaveProperty('txDigest', 'dry-run');
});
```

### Key Mocking Strategies

| What | How |
|------|-----|
| Auth guards | `overrideGuard()` — inject mock user |
| Prisma | `overrideProvider()` — jest.fn() for each model method |
| Sui TX builder | `overrideProvider()` — returns `{ digest: 'dry-run' }` |
| Sui SDK modules | `moduleNameMapper` in jest-e2e.json |

### Adding a New E2E Test

1. Add mock data to `test/app.e2e-spec.ts`
2. Mock Prisma calls: `prisma.model.method.mockResolvedValue(data)`
3. Use `request(app.getHttpServer()).verb('/api/path').send(body).expect(status)`
4. Assert response body

### Run

```bash
pnpm -F bff test:e2e               # All E2E
pnpm -F bff test                   # Unit only
pnpm -F bff test:cov               # With coverage
```

---

## 3. Frontend (65 tests, 11 files)

### Stack
- Vitest 4 + jsdom
- React Testing Library (`@testing-library/react`)
- `@testing-library/jest-dom` matchers
- `@testing-library/user-event` for interactions

### File Convention
```
packages/frontend/src/<path>/__tests__/<name>.test.tsx
```

### Config

```typescript
// vitest.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,                    // no need to import describe/it/expect
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: { alias: { '@': './src' } },
});
```

### Setup (`src/test/setup.ts`)

Global mocks auto-applied to all tests:

| Module | Mock |
|--------|------|
| `next/navigation` | `useRouter()`, `usePathname()`, `useSearchParams()` |
| `@mysten/dapp-kit` | `ConnectButton`, `useCurrentAccount()`, `useWallets()` |
| `@mysten/enoki` | `isEnokiWallet()` |

### Custom Render (`src/test/test-utils.tsx`)

Wraps components with `QueryClientProvider` (retry disabled):

```typescript
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createTestQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

export const customRender = (ui, options?) =>
  render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={createTestQueryClient()}>
        {children}
      </QueryClientProvider>
    ),
    ...options,
  });

export * from '@testing-library/react';  // re-export everything
```

### Component Test Pattern

```typescript
import { render, screen } from '@/test/test-utils';
import { describe, it, expect } from 'vitest';
import { DealCard } from '../deal-card';

describe('DealCard', () => {
  const props = { id: '1', title: 'Enterprise Deal', value: 50000, stage: 'Qualified' };

  it('renders deal title', () => {
    render(<DealCard {...props} />);
    expect(screen.getByText('Enterprise Deal')).toBeInTheDocument();
  });
});
```

### Page Test Pattern (with hook mocking)

```typescript
import { render, screen } from '@/test/test-utils';
import { vi } from 'vitest';
import DashboardPage from '../page';

vi.mock('@/lib/hooks/use-dashboard-stats', () => ({
  useDashboardStats: () => ({
    data: { profileCount: 42, dealCount: 15 },
    isLoading: false,
  }),
}));

it('renders stats', () => {
  render(<DashboardPage />);
  expect(screen.getByText('42')).toBeInTheDocument();
});
```

### Run

```bash
pnpm -F frontend test:run           # CI (single run)
pnpm -F frontend test               # Watch mode
pnpm -F frontend test:ui            # Browser UI
```

---

## 4. CI/CD (GitHub Actions)

### Pipeline: `.github/workflows/ci.yml`

```
Push to main / PR → lint-and-test → docker-build
```

**lint-and-test job:**
1. Spin up TimescaleDB (pg16) + Redis 7 services
2. `pnpm install --frozen-lockfile`
3. `pnpm lint` (ESLint)
4. `npx prisma generate` (packages/bff)
5. `pnpm test` (BFF Jest + Frontend Vitest)
6. `pnpm build` (both packages)

**docker-build job** (depends on above):
1. `docker build -f packages/bff/Dockerfile -t rosmar-bff:ci .`
2. `docker build -f packages/frontend/Dockerfile -t rosmar-frontend:ci .`

### CI Environment

```yaml
services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    env:
      POSTGRES_DB: crm
      POSTGRES_USER: crm
      POSTGRES_PASSWORD: crm_ci_password
    ports: ["5432:5432"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

---

## 5. Local Integration Testing

### Full Stack via Docker

```bash
# Dev mode (hot reload not included — use for integration testing)
docker-compose up --build

# Verify services
curl http://localhost:3001/health     # BFF health
curl http://localhost:3000            # Frontend
```

### Manual QA Checklist

- [ ] `docker-compose up` — all services healthy
- [ ] Frontend loads at `localhost:3000`
- [ ] Login page renders wallet connect options
- [ ] Dashboard shows stats after auth
- [ ] CRUD: Create/Read/Update profiles, deals, organizations
- [ ] Campaign lifecycle: draft → active → paused → completed
- [ ] Deal stage transitions in kanban board

### Dry-Run Mode

BFF supports `SUI_DRY_RUN=true` (in `.env`):
- Skips actual Sui chain transactions
- Returns `{ digest: 'dry-run' }` for all write operations
- Database writes still execute (optimistic write path)
- Useful for testing full API flow without testnet SUI

---

## 6. Test Coverage Map

| Layer | Framework | Tests | Files | What's Tested |
|-------|-----------|-------|-------|---------------|
| Move | sui move test | 68 | 4 | On-chain logic, state machines, error paths |
| BFF Unit | Jest | 1 | 1 | AppController |
| BFF E2E | Jest + Supertest | 25 | 1 | All API endpoints, auth, guards, CRUD |
| Frontend | Vitest + RTL | 65 | 11 | Components, pages, hook integration |
| CI | GitHub Actions | — | 1 | Lint → Test → Build → Docker |

### What's NOT Covered Yet

| Gap | Priority | Notes |
|-----|----------|-------|
| zkLogin e2e flow | High | Needs real Google Client ID + Enoki keys |
| BFF unit tests (services) | Medium | Currently only AppController has unit test |
| Frontend hook tests | Medium | `useAuthSession`, `useSponsoredTx` etc. |
| Integration tests (BFF ↔ DB) | Medium | Currently mocked; could add testcontainers |
| Move gas benchmarks | Low | `sui move test` doesn't report gas by default |
| Visual regression | Low | No screenshot testing setup |

---

## 7. Writing New Tests — Cheat Sheet

### Move
```bash
# Create test file
touch packages/move/crm_core/tests/new_tests.move

# Template
#[test_only]
module crm_core::new_tests {
    use sui::test_scenario::{Self as ts};
    use sui::test_utils;

    const ADMIN: address = @0xAD;

    #[test]
    fun test_something() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        // ... test logic ...
        ts::end(scenario);
    }
}
```

### BFF E2E
```bash
# Add test case to existing file
# packages/bff/test/app.e2e-spec.ts

it('GET /api/new-endpoint', async () => {
  prisma.model.findMany.mockResolvedValue([mockData]);
  const res = await request(app.getHttpServer())
    .get('/api/new-endpoint')
    .expect(200);
  expect(res.body).toHaveLength(1);
});
```

### Frontend Component
```bash
# Create test file next to component
mkdir -p packages/frontend/src/components/new/__tests__
touch packages/frontend/src/components/new/__tests__/my-component.test.tsx
```

```typescript
import { render, screen } from '@/test/test-utils';
import { describe, it, expect } from 'vitest';
import { MyComponent } from '../my-component';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Hello" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Frontend Page (with mocked hooks)
```typescript
import { render, screen } from '@/test/test-utils';
import { vi } from 'vitest';

vi.mock('@/lib/hooks/use-my-data', () => ({
  useMyData: () => ({ data: mockData, isLoading: false }),
}));

// ... test
```
