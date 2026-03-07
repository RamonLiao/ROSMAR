# Wave 1: Data Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the data pipeline from indexed on-chain events to auto-tags, engagement scores, whale alerts, and 360 asset views.

**Architecture:** Rust Indexer (P2-1, done) writes `wallet_events` to TimescaleDB and fires webhooks to BFF. BFF webhook listeners classify events into auto-tags (P2-5), a batch job calculates engagement scores (P2-2), whale threshold alerts create notifications (P2-3), and profile endpoints serve asset/timeline data (P2-4). All features read from the shared `wallet_events` table.

**Tech Stack:** Prisma 7 (migration), NestJS 11 (BFF services/jobs), React + TanStack Query (frontend), TimescaleDB (wallet_events hypertable)

**Dependency chain:** Task 0 (migration) -> P2-5 (auto-tag) -> P2-2 (engagement) -> P2-3 (whale alert) -> P2-4 (360 view)

---

## Task 0: Prisma Migration — wallet_events + engagement_snapshots

**Files:**
- Modify: `packages/bff/prisma/schema.prisma`
- Create: migration via `npx prisma migrate dev`

**Context:** The Rust indexer writes to `wallet_events` but the table doesn't exist in Prisma schema. We also need `engagement_snapshots` for P2-2 batch recalc history.

**Step 1: Add WalletEvent and EngagementSnapshot models to schema.prisma**

Add after the `AuditLog` model:

```prisma
model WalletEvent {
  id              String   @id @default(uuid())
  time            DateTime
  address         String
  eventType       String   @map("event_type")
  collection      String?
  token           String?
  amount          Decimal? @db.Decimal(36, 18)
  txDigest        String   @map("tx_digest")
  contractAddress String?  @map("contract_address")
  rawData         Json?    @map("raw_data")
  profileId       String?  @map("profile_id")
  workspaceId     String?  @map("workspace_id")
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([address, time])
  @@index([profileId, eventType])
  @@index([workspaceId, time])
  @@index([txDigest])
  @@map("wallet_events")
}

model EngagementSnapshot {
  id          String   @id @default(uuid())
  profileId   String   @map("profile_id")
  workspaceId String   @map("workspace_id")
  score       Int
  breakdown   Json
  calculatedAt DateTime @map("calculated_at")

  @@index([profileId, calculatedAt])
  @@index([workspaceId, calculatedAt])
  @@map("engagement_snapshots")
}
```

**Step 2: Generate and run migration**

```bash
cd packages/bff
npx prisma migrate dev --name add_wallet_events_and_snapshots
npx prisma generate
```

Expected: Migration created, PrismaClient regenerated.

**Step 3: Verify with tsc**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add packages/bff/prisma/
git commit -m "feat(schema): add WalletEvent + EngagementSnapshot models"
```

---

## Task 1 (P2-5): Auto-Tag Classifier Service

**Files:**
- Create: `packages/bff/src/auto-tag/auto-tag.service.ts`
- Create: `packages/bff/src/auto-tag/auto-tag.module.ts`
- Create: `packages/bff/src/auto-tag/auto-tag.constants.ts`
- Test: `packages/bff/src/auto-tag/auto-tag.service.spec.ts`

**Context:** Auto-tags are computed from wallet_events aggregation. Each classifier checks a threshold and returns a tag string. Tags are prefixed with `auto:` to distinguish from manual tags.

**Step 1: Write auto-tag constants**

```typescript
// auto-tag.constants.ts
export const AUTO_TAG_PREFIX = 'auto:';

export const TAG_RULES = [
  {
    tag: 'NFT_Collector',
    eventTypes: ['MintNFTEvent', 'TransferObject'],
    minCount: 5,
    period: 'all', // all-time
  },
  {
    tag: 'DeFi_Power_User',
    eventTypes: ['SwapEvent', 'AddLiquidityEvent', 'StakeEvent'],
    minCount: 10,
    period: '30d',
  },
  {
    tag: 'DAO_Voter',
    eventTypes: ['VoteEvent', 'DelegateEvent'],
    minCount: 3,
    period: '90d',
  },
  {
    tag: 'Whale',
    eventTypes: ['SwapEvent', 'AddLiquidityEvent'],
    minAmountUsd: 100_000,
    period: '30d',
  },
  {
    tag: 'Diamond_Hands',
    eventTypes: ['StakeEvent'],
    minCount: 1,
    minHoldDays: 180,
    period: 'all',
  },
] as const;

export type TagRule = (typeof TAG_RULES)[number];
```

**Step 2: Write failing tests**

```typescript
// auto-tag.service.spec.ts
import { Test } from '@nestjs/testing';
import { AutoTagService } from './auto-tag.service';
import { PrismaService } from '../prisma/prisma.service';
import { AUTO_TAG_PREFIX } from './auto-tag.constants';

describe('AutoTagService', () => {
  let service: AutoTagService;
  let prisma: { $queryRaw: jest.Mock; profile: { update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
      profile: { update: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        AutoTagService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AutoTagService);
  });

  it('should add NFT_Collector tag when >= 5 NFT events', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        // aggregate query returns counts per event type
        { event_type: 'MintNFTEvent', cnt: 6n },
      ])
      .mockResolvedValueOnce([]); // no other events

    const tags = await service.computeAutoTags('profile-1');
    expect(tags).toContain(`${AUTO_TAG_PREFIX}NFT_Collector`);
  });

  it('should NOT add NFT_Collector when < 5 events', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { event_type: 'MintNFTEvent', cnt: 2n },
    ]);

    const tags = await service.computeAutoTags('profile-1');
    expect(tags).not.toContain(`${AUTO_TAG_PREFIX}NFT_Collector`);
  });

  it('should merge auto tags with existing manual tags', async () => {
    const existing = ['vip', `${AUTO_TAG_PREFIX}old_tag`];
    const autoTags = [`${AUTO_TAG_PREFIX}NFT_Collector`];

    const merged = service.mergeTags(existing, autoTags);
    expect(merged).toContain('vip'); // manual preserved
    expect(merged).toContain(`${AUTO_TAG_PREFIX}NFT_Collector`); // new auto added
    expect(merged).not.toContain(`${AUTO_TAG_PREFIX}old_tag`); // stale auto removed
  });
});
```

**Step 3: Run test to verify it fails**

```bash
cd packages/bff
npx jest auto-tag.service.spec --no-coverage
```

Expected: FAIL — `Cannot find module './auto-tag.service'`

**Step 4: Implement AutoTagService**

```typescript
// auto-tag.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AUTO_TAG_PREFIX, TAG_RULES } from './auto-tag.constants';

@Injectable()
export class AutoTagService {
  private readonly logger = new Logger(AutoTagService.name);

  constructor(private readonly prisma: PrismaService) {}

  async computeAutoTags(profileId: string): Promise<string[]> {
    const tags: string[] = [];

    for (const rule of TAG_RULES) {
      const match = await this.evaluateRule(profileId, rule);
      if (match) {
        tags.push(`${AUTO_TAG_PREFIX}${rule.tag}`);
      }
    }

    return tags;
  }

  private async evaluateRule(
    profileId: string,
    rule: (typeof TAG_RULES)[number],
  ): Promise<boolean> {
    const eventTypes = rule.eventTypes;
    const since = this.periodToDate(rule.period);

    if ('minAmountUsd' in rule && rule.minAmountUsd) {
      // Sum-based rule (whale)
      const rows = await this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(amount), 0)::float AS total
        FROM wallet_events
        WHERE profile_id = ${profileId}
          AND event_type = ANY(${eventTypes}::text[])
          AND (${since}::timestamptz IS NULL OR time >= ${since}::timestamptz)
      `;
      return (rows[0]?.total ?? 0) >= rule.minAmountUsd;
    }

    // Count-based rule
    const rows = await this.prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(*) AS cnt
      FROM wallet_events
      WHERE profile_id = ${profileId}
        AND event_type = ANY(${eventTypes}::text[])
        AND (${since}::timestamptz IS NULL OR time >= ${since}::timestamptz)
    `;
    return Number(rows[0]?.cnt ?? 0) >= (rule.minCount ?? 0);
  }

  private periodToDate(period: string): Date | null {
    if (period === 'all') return null;
    const days = parseInt(period);
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }

  /**
   * Merge: keep manual tags, replace all auto: tags with fresh computed set
   */
  mergeTags(existingTags: string[], autoTags: string[]): string[] {
    const manual = existingTags.filter((t) => !t.startsWith(AUTO_TAG_PREFIX));
    return [...manual, ...autoTags];
  }
}
```

**Step 5: Create module**

```typescript
// auto-tag.module.ts
import { Module } from '@nestjs/common';
import { AutoTagService } from './auto-tag.service';

@Module({
  providers: [AutoTagService],
  exports: [AutoTagService],
})
export class AutoTagModule {}
```

**Step 6: Run tests**

```bash
npx jest auto-tag.service.spec --no-coverage
```

Expected: PASS

**Step 7: Commit**

```bash
git add packages/bff/src/auto-tag/
git commit -m "feat(auto-tag): add AutoTagService with classifier rules"
```

---

## Task 2 (P2-5): Wire Auto-Tag to Webhook Listener + Batch Job

**Files:**
- Create: `packages/bff/src/auto-tag/auto-tag.listener.ts`
- Modify: `packages/bff/src/auto-tag/auto-tag.module.ts`
- Modify: `packages/bff/src/jobs/score-recalc.job.ts` (add auto-tag batch)
- Modify: `packages/bff/src/jobs/jobs.service.ts` (register ScoreRecalcJob)
- Modify: `packages/bff/src/app.module.ts` (import AutoTagModule)
- Test: `packages/bff/src/auto-tag/auto-tag.listener.spec.ts`

**Context:** Two triggers for auto-tagging:
1. **Real-time**: EventEmitter2 listener on `indexer.event.*` — re-compute for the affected profile
2. **Batch**: ScoreRecalcJob runs hourly, iterates all active profiles

**Step 1: Write failing test for listener**

```typescript
// auto-tag.listener.spec.ts
import { Test } from '@nestjs/testing';
import { AutoTagListener } from './auto-tag.listener';
import { AutoTagService } from './auto-tag.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AutoTagListener', () => {
  let listener: AutoTagListener;
  let autoTagService: { computeAutoTags: jest.Mock; mergeTags: jest.Mock };
  let prisma: { profile: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    autoTagService = {
      computeAutoTags: jest.fn(),
      mergeTags: jest.fn(),
    };
    prisma = {
      profile: { findUnique: jest.fn(), update: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        AutoTagListener,
        { provide: AutoTagService, useValue: autoTagService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    listener = module.get(AutoTagListener);
  });

  it('should skip event without profile_id', async () => {
    await listener.handleIndexerEvent({
      event_id: '1',
      event_type: 'MintNFTEvent',
      address: '0xabc',
      data: {},
      tx_digest: '0x123',
      timestamp: Date.now(),
    });

    expect(autoTagService.computeAutoTags).not.toHaveBeenCalled();
  });

  it('should compute and update tags when profile_id present', async () => {
    const profile = { id: 'p1', tags: ['vip'], version: 2 };
    prisma.profile.findUnique.mockResolvedValue(profile);
    autoTagService.computeAutoTags.mockResolvedValue(['auto:NFT_Collector']);
    autoTagService.mergeTags.mockReturnValue(['vip', 'auto:NFT_Collector']);

    await listener.handleIndexerEvent({
      event_id: '1',
      event_type: 'MintNFTEvent',
      profile_id: 'p1',
      address: '0xabc',
      data: {},
      tx_digest: '0x123',
      timestamp: Date.now(),
    });

    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { tags: ['vip', 'auto:NFT_Collector'] },
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx jest auto-tag.listener.spec --no-coverage
```

Expected: FAIL

**Step 3: Implement listener**

```typescript
// auto-tag.listener.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AutoTagService } from './auto-tag.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AutoTagListener {
  private readonly logger = new Logger(AutoTagListener.name);

  constructor(
    private readonly autoTagService: AutoTagService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('indexer.event.*')
  async handleIndexerEvent(event: {
    event_id: string;
    event_type: string;
    profile_id?: string;
    address: string;
    data: Record<string, unknown>;
    tx_digest: string;
    timestamp: number;
  }) {
    if (!event.profile_id) return;

    try {
      const profile = await this.prisma.profile.findUnique({
        where: { id: event.profile_id },
        select: { id: true, tags: true },
      });
      if (!profile) return;

      const autoTags = await this.autoTagService.computeAutoTags(profile.id);
      const merged = this.autoTagService.mergeTags(profile.tags, autoTags);

      // Only update if tags actually changed
      if (JSON.stringify(merged.sort()) !== JSON.stringify(profile.tags.sort())) {
        await this.prisma.profile.update({
          where: { id: profile.id },
          data: { tags: merged },
        });
        this.logger.log(`Updated auto-tags for profile ${profile.id}: ${autoTags.join(', ')}`);
      }
    } catch (err) {
      this.logger.error(`Auto-tag failed for profile ${event.profile_id}`, err);
    }
  }
}
```

**Step 4: Update auto-tag.module.ts**

```typescript
// auto-tag.module.ts
import { Module } from '@nestjs/common';
import { AutoTagService } from './auto-tag.service';
import { AutoTagListener } from './auto-tag.listener';

@Module({
  providers: [AutoTagService, AutoTagListener],
  exports: [AutoTagService],
})
export class AutoTagModule {}
```

**Step 5: Wire ScoreRecalcJob to also run auto-tags in batch**

```typescript
// score-recalc.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutoTagService } from '../auto-tag/auto-tag.service';

@Injectable()
export class ScoreRecalcJob {
  private readonly logger = new Logger(ScoreRecalcJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly autoTagService: AutoTagService,
  ) {}

  async recalculateScores() {
    this.logger.log('Running score recalculation + auto-tag job...');

    const profiles = await this.prisma.profile.findMany({
      where: { isArchived: false },
      select: { id: true, tags: true, workspaceId: true },
    });

    for (const profile of profiles) {
      try {
        // Auto-tag
        const autoTags = await this.autoTagService.computeAutoTags(profile.id);
        const merged = this.autoTagService.mergeTags(profile.tags, autoTags);

        await this.prisma.profile.update({
          where: { id: profile.id },
          data: { tags: merged },
        });

        // TODO: Engagement score calc (Task 4)
      } catch (err) {
        this.logger.error(`Recalc failed for ${profile.id}`, err);
      }
    }

    this.logger.log(`Recalculated ${profiles.length} profiles`);
  }
}
```

**Step 6: Update JobsService to inject ScoreRecalcJob (add AutoTagModule import)**

In `app.module.ts`, add `AutoTagModule` to imports array.

In `jobs.service.ts`, add `ScoreRecalcJob` to constructor if not already injected. The job module needs to import `AutoTagModule`.

**Step 7: Run tests**

```bash
npx jest auto-tag --no-coverage
```

Expected: PASS

**Step 8: tsc check**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 9: Commit**

```bash
git add packages/bff/src/auto-tag/ packages/bff/src/jobs/ packages/bff/src/app.module.ts
git commit -m "feat(auto-tag): wire listener + batch job for auto-tagging pipeline"
```

---

## Task 3 (P2-5): Frontend — Auto-Tag Visual Distinction

**Files:**
- Modify: `packages/frontend/src/components/profile/profile-card.tsx` (or wherever tags are rendered)
- Create: `packages/frontend/src/components/shared/auto-tag-badge.tsx`
- Test: `packages/frontend/src/components/shared/__tests__/auto-tag-badge.test.tsx`

**Context:** Auto-tags (prefixed `auto:`) should look visually distinct from manual tags — different color + icon. Manual tags stay as-is.

**Step 1: Write failing test**

```tsx
// auto-tag-badge.test.tsx
import { render, screen } from '@testing-library/react';
import { AutoTagBadge, isAutoTag, displayTagName } from '../auto-tag-badge';

describe('AutoTagBadge', () => {
  it('identifies auto tags', () => {
    expect(isAutoTag('auto:NFT_Collector')).toBe(true);
    expect(isAutoTag('vip')).toBe(false);
  });

  it('strips prefix for display', () => {
    expect(displayTagName('auto:NFT_Collector')).toBe('NFT Collector');
    expect(displayTagName('vip')).toBe('vip');
  });

  it('renders auto tag with bot icon styling', () => {
    render(<AutoTagBadge tag="auto:NFT_Collector" />);
    const badge = screen.getByText('NFT Collector');
    expect(badge).toBeInTheDocument();
  });

  it('renders manual tag without bot icon', () => {
    render(<AutoTagBadge tag="vip" />);
    const badge = screen.getByText('vip');
    expect(badge).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/frontend
pnpm test:run -- auto-tag-badge
```

Expected: FAIL

**Step 3: Implement AutoTagBadge**

```tsx
// auto-tag-badge.tsx
import { Badge } from '@/components/ui/badge';
import { Bot } from 'lucide-react';

const AUTO_PREFIX = 'auto:';

export function isAutoTag(tag: string): boolean {
  return tag.startsWith(AUTO_PREFIX);
}

export function displayTagName(tag: string): string {
  if (!isAutoTag(tag)) return tag;
  return tag.slice(AUTO_PREFIX.length).replace(/_/g, ' ');
}

export function AutoTagBadge({ tag }: { tag: string }) {
  const auto = isAutoTag(tag);

  return (
    <Badge
      variant={auto ? 'outline' : 'secondary'}
      className={auto ? 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300' : ''}
    >
      {auto && <Bot className="mr-1 h-3 w-3" />}
      {displayTagName(tag)}
    </Badge>
  );
}
```

**Step 4: Replace Badge with AutoTagBadge where tags are rendered**

In profile-card.tsx and any tag display, replace:
```tsx
// Before
<Badge>{tag}</Badge>

// After
<AutoTagBadge tag={tag} />
```

**Step 5: Run tests**

```bash
pnpm test:run
```

Expected: All tests pass (81+ tests)

**Step 6: Commit**

```bash
git add packages/frontend/src/components/
git commit -m "feat(frontend): auto-tag visual distinction with Bot icon"
```

---

## Task 4 (P2-2): Engagement Score Calculator

**Files:**
- Create: `packages/bff/src/engagement/engagement.service.ts`
- Create: `packages/bff/src/engagement/engagement.module.ts`
- Create: `packages/bff/src/engagement/engagement.constants.ts`
- Test: `packages/bff/src/engagement/engagement.service.spec.ts`

**Context:** Score formula: `hold_time * 0.3 + tx_count * 0.2 + tx_value * 0.2 + vote_count * 0.2 + nft_count * 0.1`, normalized to 0-100. Each factor is a sub-query against wallet_events.

**Step 1: Write constants**

```typescript
// engagement.constants.ts
export const DEFAULT_WEIGHTS = {
  holdTime: 0.3,
  txCount: 0.2,
  txValue: 0.2,
  voteCount: 0.2,
  nftCount: 0.1,
} as const;

export type EngagementWeights = typeof DEFAULT_WEIGHTS;

// Max raw values for normalization (tunable per workspace)
export const DEFAULT_CAPS = {
  holdTimeDays: 365,
  txCount: 100,
  txValueUsd: 500_000,
  voteCount: 50,
  nftCount: 50,
} as const;
```

**Step 2: Write failing tests**

```typescript
// engagement.service.spec.ts
import { Test } from '@nestjs/testing';
import { EngagementService } from './engagement.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_WEIGHTS } from './engagement.constants';

describe('EngagementService', () => {
  let service: EngagementService;
  let prisma: { $queryRaw: jest.Mock; profile: { update: jest.Mock }; engagementSnapshot: { create: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
      profile: { update: jest.fn() },
      engagementSnapshot: { create: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        EngagementService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(EngagementService);
  });

  it('should return 0 for profile with no events', async () => {
    prisma.$queryRaw.mockResolvedValue([{ hold_days: 0, tx_count: 0n, tx_value: 0, vote_count: 0n, nft_count: 0n }]);

    const result = await service.calculateScore('profile-1', DEFAULT_WEIGHTS);
    expect(result.score).toBe(0);
  });

  it('should return 100 for maxed-out profile', async () => {
    prisma.$queryRaw.mockResolvedValue([{
      hold_days: 400,
      tx_count: 200n,
      tx_value: 600000,
      vote_count: 100n,
      nft_count: 100n,
    }]);

    const result = await service.calculateScore('profile-1', DEFAULT_WEIGHTS);
    expect(result.score).toBe(100);
  });

  it('should compute partial score correctly', async () => {
    prisma.$queryRaw.mockResolvedValue([{
      hold_days: 182, // ~50% of 365
      tx_count: 50n,  // 50% of 100
      tx_value: 250000, // 50% of 500k
      vote_count: 25n, // 50% of 50
      nft_count: 25n,  // 50% of 50
    }]);

    const result = await service.calculateScore('profile-1', DEFAULT_WEIGHTS);
    // ~50% across all factors = 50
    expect(result.score).toBeGreaterThanOrEqual(49);
    expect(result.score).toBeLessThanOrEqual(51);
  });
});
```

**Step 3: Run test to verify it fails**

```bash
npx jest engagement.service.spec --no-coverage
```

**Step 4: Implement EngagementService**

```typescript
// engagement.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_CAPS, DEFAULT_WEIGHTS, EngagementWeights } from './engagement.constants';

export interface ScoreResult {
  score: number; // 0-100
  breakdown: {
    holdTime: number;
    txCount: number;
    txValue: number;
    voteCount: number;
    nftCount: number;
  };
}

@Injectable()
export class EngagementService {
  private readonly logger = new Logger(EngagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  async calculateScore(
    profileId: string,
    weights: EngagementWeights = DEFAULT_WEIGHTS,
  ): Promise<ScoreResult> {
    const rows = await this.prisma.$queryRaw<
      {
        hold_days: number;
        tx_count: bigint;
        tx_value: number;
        vote_count: bigint;
        nft_count: bigint;
      }[]
    >`
      SELECT
        COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(we.time))) / 86400, 0)::float AS hold_days,
        COUNT(*) FILTER (WHERE we.event_type IN ('SwapEvent', 'AddLiquidityEvent', 'StakeEvent', 'UnstakeEvent')) AS tx_count,
        COALESCE(SUM(we.amount) FILTER (WHERE we.event_type IN ('SwapEvent', 'AddLiquidityEvent')), 0)::float AS tx_value,
        COUNT(*) FILTER (WHERE we.event_type IN ('VoteEvent', 'DelegateEvent')) AS vote_count,
        COUNT(*) FILTER (WHERE we.event_type IN ('MintNFTEvent', 'TransferObject')) AS nft_count
      FROM wallet_events we
      WHERE we.profile_id = ${profileId}
    `;

    const raw = rows[0] ?? { hold_days: 0, tx_count: 0n, tx_value: 0, vote_count: 0n, nft_count: 0n };

    const factors = {
      holdTime: Math.min(Number(raw.hold_days) / DEFAULT_CAPS.holdTimeDays, 1),
      txCount: Math.min(Number(raw.tx_count) / DEFAULT_CAPS.txCount, 1),
      txValue: Math.min(Number(raw.tx_value) / DEFAULT_CAPS.txValueUsd, 1),
      voteCount: Math.min(Number(raw.vote_count) / DEFAULT_CAPS.voteCount, 1),
      nftCount: Math.min(Number(raw.nft_count) / DEFAULT_CAPS.nftCount, 1),
    };

    const score = Math.round(
      (factors.holdTime * weights.holdTime +
        factors.txCount * weights.txCount +
        factors.txValue * weights.txValue +
        factors.voteCount * weights.voteCount +
        factors.nftCount * weights.nftCount) *
        100,
    );

    return {
      score: Math.min(score, 100),
      breakdown: {
        holdTime: Math.round(factors.holdTime * 100),
        txCount: Math.round(factors.txCount * 100),
        txValue: Math.round(factors.txValue * 100),
        voteCount: Math.round(factors.voteCount * 100),
        nftCount: Math.round(factors.nftCount * 100),
      },
    };
  }

  async recalculateAndPersist(profileId: string, workspaceId: string): Promise<number> {
    const result = await this.calculateScore(profileId);

    await this.prisma.profile.update({
      where: { id: profileId },
      data: { engagementScore: result.score },
    });

    await this.prisma.engagementSnapshot.create({
      data: {
        profileId,
        workspaceId,
        score: result.score,
        breakdown: result.breakdown,
        calculatedAt: new Date(),
      },
    });

    return result.score;
  }
}
```

**Step 5: Create module**

```typescript
// engagement.module.ts
import { Module } from '@nestjs/common';
import { EngagementService } from './engagement.service';

@Module({
  providers: [EngagementService],
  exports: [EngagementService],
})
export class EngagementModule {}
```

**Step 6: Run tests**

```bash
npx jest engagement.service.spec --no-coverage
```

Expected: PASS

**Step 7: Commit**

```bash
git add packages/bff/src/engagement/
git commit -m "feat(engagement): add EngagementService with weighted score formula"
```

---

## Task 5 (P2-2): Wire Engagement to Batch Job + Score Endpoint

**Files:**
- Modify: `packages/bff/src/jobs/score-recalc.job.ts`
- Modify: `packages/bff/src/analytics/analytics.controller.ts`
- Modify: `packages/bff/src/analytics/analytics.service.ts`
- Modify: `packages/bff/src/app.module.ts`

**Step 1: Update ScoreRecalcJob to call EngagementService**

Add to the existing `recalculateScores()` method (after auto-tag block):

```typescript
// In score-recalc.job.ts, add EngagementService injection
constructor(
  private readonly prisma: PrismaService,
  private readonly autoTagService: AutoTagService,
  private readonly engagementService: EngagementService,
) {}

// Inside the loop:
const score = await this.engagementService.recalculateAndPersist(
  profile.id,
  profile.workspaceId,
);
```

**Step 2: Add score breakdown endpoint to AnalyticsService**

```typescript
// Add to analytics.service.ts
async getScoreBreakdown(profileId: string): Promise<ScoreResult> {
  return this.engagementService.calculateScore(profileId);
}
```

**Step 3: Add controller endpoint**

```typescript
// Add to analytics.controller.ts
@Get('profiles/:id/score')
async getScoreBreakdown(@Param('id') profileId: string) {
  return this.analyticsService.getScoreBreakdown(profileId);
}
```

**Step 4: Import EngagementModule in app.module.ts**

**Step 5: tsc check + commit**

```bash
npx tsc --noEmit
git add packages/bff/src/
git commit -m "feat(engagement): wire batch job + score breakdown endpoint"
```

---

## Task 6 (P2-2): Frontend — Engagement Weight Settings

**Files:**
- Create: `packages/frontend/src/components/settings/engagement-weights.tsx`
- Create: `packages/frontend/src/lib/hooks/use-engagement-settings.ts`
- Test: `packages/frontend/src/components/settings/__tests__/engagement-weights.test.tsx`

**Context:** Settings page where workspace admins can tune the 5 weight sliders. For now, weights are stored client-side (localStorage) and sent with each score request. Phase 3 will persist to BFF.

**Step 1: Write failing test**

```tsx
// engagement-weights.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { EngagementWeights } from '../engagement-weights';

describe('EngagementWeights', () => {
  it('renders 5 weight sliders', () => {
    render(<EngagementWeights />);
    expect(screen.getByText('Hold Time')).toBeInTheDocument();
    expect(screen.getByText('TX Count')).toBeInTheDocument();
    expect(screen.getByText('TX Value')).toBeInTheDocument();
    expect(screen.getByText('Vote Count')).toBeInTheDocument();
    expect(screen.getByText('NFT Count')).toBeInTheDocument();
  });

  it('shows weights summing to 1.0', () => {
    render(<EngagementWeights />);
    expect(screen.getByText('Total: 1.0')).toBeInTheDocument();
  });
});
```

**Step 2: Implement component + hook**

Weight sliders (0.0 - 1.0 in 0.05 steps) with auto-normalize to ensure sum = 1.0.

**Step 3: Run tests, commit**

```bash
pnpm test:run
git add packages/frontend/src/components/settings/ packages/frontend/src/lib/hooks/
git commit -m "feat(frontend): engagement weight settings UI"
```

---

## Task 7 (P2-3): Whale Alert Webhook Handler + Notification

**Files:**
- Create: `packages/bff/src/webhook/whale-alert.listener.ts`
- Test: `packages/bff/src/webhook/whale-alert.listener.spec.ts`
- Modify: `packages/bff/src/webhook/webhook.module.ts`

**Context:** The Rust indexer's AlertEngine fires `WhaleAlert` events via webhook. BFF receives these as `indexer.event.WhaleAlert` EventEmitter2 events. We create a Notification record + optionally push via messaging service.

**Step 1: Write failing test**

```typescript
// whale-alert.listener.spec.ts
import { Test } from '@nestjs/testing';
import { WhaleAlertListener } from './whale-alert.listener';
import { NotificationService } from '../notification/notification.service';

describe('WhaleAlertListener', () => {
  let listener: WhaleAlertListener;
  let notificationService: { create: jest.Mock };

  beforeEach(async () => {
    notificationService = { create: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        WhaleAlertListener,
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    listener = module.get(WhaleAlertListener);
  });

  it('should create notification for whale alert', async () => {
    await listener.handleWhaleAlert({
      event_id: '1',
      event_type: 'WhaleAlert',
      profile_id: 'p1',
      address: '0xwhale',
      data: {
        amount: 500000,
        token: 'SUI',
        tx_type: 'SwapEvent',
      },
      tx_digest: '0xabc',
      timestamp: Date.now(),
    });

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'whale_alert',
        title: expect.stringContaining('Whale'),
      }),
    );
  });
});
```

**Step 2: Implement**

```typescript
// whale-alert.listener.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../notification/notification.service';
import { IndexerEventDto } from './indexer-event.dto';

@Injectable()
export class WhaleAlertListener {
  private readonly logger = new Logger(WhaleAlertListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent('indexer.event.WhaleAlert')
  async handleWhaleAlert(event: IndexerEventDto) {
    const { amount, token, tx_type } = event.data as {
      amount: number;
      token: string;
      tx_type: string;
    };

    this.logger.warn(
      `Whale alert: ${event.address} — ${amount} ${token} (${tx_type})`,
    );

    // Create notification for all workspace members (broadcast)
    // The webhook doesn't carry workspaceId, so we use the enriched profile_id
    // to look up workspace. For now, store with profile_id as userId.
    await this.notificationService.create({
      workspaceId: '', // TODO: resolve from profile_id
      userId: event.profile_id ?? event.address,
      type: 'whale_alert',
      title: `Whale Alert: ${this.formatAmount(amount)} ${token}`,
      body: `Address ${this.truncateAddress(event.address)} executed a ${tx_type} of ${this.formatAmount(amount)} ${token}`,
      metadata: {
        address: event.address,
        amount,
        token,
        txType: tx_type,
        txDigest: event.tx_digest,
        profileId: event.profile_id,
      },
    });
  }

  private formatAmount(n: number): string {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(n);
  }

  private truncateAddress(addr: string): string {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }
}
```

**Step 3: Register in webhook.module.ts, add NotificationModule to imports**

**Step 4: Run tests, tsc, commit**

```bash
npx jest whale-alert --no-coverage
npx tsc --noEmit
git add packages/bff/src/webhook/ packages/bff/src/notification/
git commit -m "feat(whale-alert): create notification on indexer WhaleAlert event"
```

---

## Task 8 (P2-3): Frontend — Notification Center

**Files:**
- Create: `packages/frontend/src/components/layout/notification-center.tsx`
- Create: `packages/frontend/src/lib/hooks/use-notifications.ts` (or modify existing)
- Modify: `packages/frontend/src/components/layout/header.tsx` (add bell icon)
- Test: `packages/frontend/src/components/layout/__tests__/notification-center.test.tsx`

**Context:** Bell icon in header with unread count badge. Click opens dropdown with notification list. Whale alerts highlighted with special styling.

**Step 1: Write failing test**

```tsx
// notification-center.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationCenter } from '../notification-center';

// Mock the hook
jest.mock('@/lib/hooks/use-notifications', () => ({
  useNotifications: () => ({
    notifications: [
      {
        id: '1',
        type: 'whale_alert',
        title: 'Whale Alert: 500,000 SUI',
        body: 'Address 0xwhal...e001 executed a swap',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ],
    unreadCount: 1,
    markRead: jest.fn(),
    markAllRead: jest.fn(),
  }),
}));

describe('NotificationCenter', () => {
  it('shows unread count badge', () => {
    render(<NotificationCenter />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows notifications on click', async () => {
    render(<NotificationCenter />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Whale Alert: 500,000 SUI')).toBeInTheDocument();
  });
});
```

**Step 2: Implement NotificationCenter component**

Popover with Bell icon, unread badge, scrollable notification list. Whale alerts get amber/orange left border.

**Step 3: Wire into header**

**Step 4: Run tests, commit**

```bash
pnpm test:run
git add packages/frontend/src/components/layout/ packages/frontend/src/lib/hooks/
git commit -m "feat(frontend): notification center with whale alert support"
```

---

## Task 9 (P2-4): BFF — Profile Assets + Timeline Endpoints

**Files:**
- Modify: `packages/bff/src/profile/profile.service.ts`
- Modify: `packages/bff/src/profile/profile.controller.ts`
- Test: `packages/bff/src/profile/profile-assets.spec.ts`

**Context:** Two new endpoints:
- `GET /profiles/:id/assets` — aggregated NFT + token balances from wallet_events
- `GET /profiles/:id/timeline` — paginated wallet_events by profile

**Step 1: Write failing test**

```typescript
// profile-assets.spec.ts
import { Test } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProfileService - Assets & Timeline', () => {
  let service: ProfileService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
      walletEvent: { findMany: jest.fn(), count: jest.fn() },
      profile: { findUniqueOrThrow: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      profileOrganization: { findMany: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: prisma },
        { provide: 'SuiClientService', useValue: {} },
        { provide: 'TxBuilderService', useValue: {} },
        { provide: 'ConfigService', useValue: { get: () => '' } },
      ],
    }).compile();

    service = module.get(ProfileService);
  });

  it('getAssets returns NFT and token aggregations', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { collection: 'SuiFrens', event_type: 'MintNFTEvent', cnt: 3n, total_amount: null },
      { collection: null, event_type: 'StakeEvent', cnt: 5n, total_amount: 10000 },
    ]);

    const assets = await service.getAssets('profile-1');
    expect(assets.nfts).toHaveLength(1);
    expect(assets.nfts[0].collection).toBe('SuiFrens');
    expect(assets.defi).toHaveLength(1);
  });

  it('getTimeline returns paginated events', async () => {
    prisma.walletEvent.findMany.mockResolvedValue([
      { id: '1', eventType: 'SwapEvent', time: new Date(), amount: 100 },
    ]);
    prisma.walletEvent.count.mockResolvedValue(1);

    const result = await service.getTimeline('profile-1', 20, 0);
    expect(result.events).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
```

**Step 2: Implement**

Add to `profile.service.ts`:

```typescript
async getAssets(profileId: string) {
  const rows = await this.prisma.$queryRaw<
    { collection: string | null; event_type: string; cnt: bigint; total_amount: number | null }[]
  >`
    SELECT
      collection,
      event_type,
      COUNT(*) AS cnt,
      SUM(amount)::float AS total_amount
    FROM wallet_events
    WHERE profile_id = ${profileId}
    GROUP BY collection, event_type
    ORDER BY cnt DESC
  `;

  const nftTypes = ['MintNFTEvent', 'TransferObject'];
  const defiTypes = ['SwapEvent', 'AddLiquidityEvent', 'StakeEvent', 'UnstakeEvent'];

  return {
    nfts: rows
      .filter((r) => nftTypes.includes(r.event_type))
      .map((r) => ({
        collection: r.collection ?? 'Unknown',
        count: Number(r.cnt),
        eventType: r.event_type,
      })),
    defi: rows
      .filter((r) => defiTypes.includes(r.event_type))
      .map((r) => ({
        type: r.event_type,
        count: Number(r.cnt),
        totalAmount: r.total_amount ?? 0,
      })),
    governance: rows
      .filter((r) => ['VoteEvent', 'DelegateEvent'].includes(r.event_type))
      .map((r) => ({
        type: r.event_type,
        count: Number(r.cnt),
      })),
  };
}

async getTimeline(profileId: string, limit = 20, offset = 0) {
  const [events, total] = await Promise.all([
    this.prisma.walletEvent.findMany({
      where: { profileId },
      orderBy: { time: 'desc' },
      take: limit,
      skip: offset,
    }),
    this.prisma.walletEvent.count({ where: { profileId } }),
  ]);

  return { events, total };
}
```

Add controller endpoints:

```typescript
@Get(':id/assets')
async getAssets(@Param('id') id: string) {
  return this.profileService.getAssets(id);
}

@Get(':id/timeline')
async getTimeline(
  @Param('id') id: string,
  @Query('limit') limit = 20,
  @Query('offset') offset = 0,
) {
  return this.profileService.getTimeline(id, +limit, +offset);
}
```

**Step 3: Run tests, tsc, commit**

```bash
npx jest profile-assets --no-coverage
npx tsc --noEmit
git add packages/bff/src/profile/
git commit -m "feat(profile): add assets + timeline endpoints from wallet_events"
```

---

## Task 10 (P2-4): Frontend — Wire Asset Gallery + Timeline

**Files:**
- Modify: `packages/frontend/src/components/profile/asset-gallery.tsx`
- Modify: `packages/frontend/src/components/profile/profile-timeline.tsx`
- Create: `packages/frontend/src/lib/hooks/use-profile-assets.ts`
- Test: `packages/frontend/src/components/profile/__tests__/asset-gallery.test.tsx`

**Context:** Replace empty arrays with real API calls. AssetGallery shows NFT collections + DeFi positions. ProfileTimeline shows paginated event feed.

**Step 1: Create hook**

```typescript
// use-profile-assets.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useProfileAssets(profileId: string) {
  return useQuery({
    queryKey: ['profile-assets', profileId],
    queryFn: () => api.get(`/profiles/${profileId}/assets`).then((r) => r.data),
    enabled: !!profileId,
  });
}

export function useProfileTimeline(profileId: string, limit = 20, offset = 0) {
  return useQuery({
    queryKey: ['profile-timeline', profileId, limit, offset],
    queryFn: () =>
      api.get(`/profiles/${profileId}/timeline`, { params: { limit, offset } }).then((r) => r.data),
    enabled: !!profileId,
  });
}
```

**Step 2: Wire AssetGallery**

Replace static data with `useProfileAssets(profileId)`. Show:
- NFT section: collection cards with count
- DeFi section: position summary (type, total amount)
- Governance section: vote/delegate counts

**Step 3: Wire ProfileTimeline**

Replace static data with `useProfileTimeline(profileId)`. Show:
- Event cards with icon per type (swap, mint, vote, etc.)
- Pagination (load more button)
- Relative timestamps

**Step 4: Write test, run all tests, commit**

```bash
pnpm test:run
git add packages/frontend/src/
git commit -m "feat(frontend): wire asset gallery + timeline to real APIs"
```

---

## Final: tsc + full test suite

```bash
cd packages/bff && npx tsc --noEmit
cd packages/frontend && pnpm test:run
```

Expected: All green.

```bash
git add -A
git commit -m "feat: complete Wave 1 — auto-tag, engagement, whale alert, 360 view"
```
