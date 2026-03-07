# P4 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement P4 features — full escrow suite, quest-to-qualify with SBT, lookalike audiences, GDPR compliance, and production hardening.

**Architecture:** 4 waves, 2 parallel agents per wave. Wave 1 lays Move contracts + Prisma foundation. Waves 2-4 build BFF services + frontend on top. Each agent owns distinct file paths to avoid merge conflicts (proven in P3).

**Tech Stack:** SUI Move (crm_escrow, crm_action), NestJS 11, Prisma 7, Next.js, React, ioredis, @nestjs/throttler, nestjs-pino, @sentry/nestjs

**Design doc:** `docs/plans/2026-03-07-p4-design.md`

---

## Wave 1: Foundation (Move + Prisma)

### Agent 1A: Move Contracts

**File ownership:** `packages/move/crm_escrow/` (new), `packages/move/crm_action/sources/quest_badge.move` (new)
**DO NOT modify:** `packages/bff/`, `packages/frontend/`, `packages/move/crm_core/`, `packages/move/crm_data/`

---

#### Task T1: Scaffold crm_escrow package

**Files:**
- Create: `packages/move/crm_escrow/Move.toml`
- Create: `packages/move/crm_escrow/sources/escrow.move`

**Step 1: Create Move.toml**

```toml
[package]
name = "crm_escrow"
edition = "2024"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }
crm_core = { local = "../crm_core" }
crm_data = { local = "../crm_data" }

[addresses]
crm_escrow = "0x0"
crm_core = "0x0"
crm_data = "0x0"
```

**Step 2: Create escrow.move with structs + constants**

Implement in `escrow.move`:
- State constants: `STATE_CREATED=0`, `STATE_FUNDED=1`, `STATE_PARTIALLY_RELEASED=2`, `STATE_COMPLETED=3`, `STATE_REFUNDED=4`, `STATE_DISPUTED=5`
- Error codes: `ENotPayer=1500`, `ENotPayee=1501`, `ENotArbitrator=1502`, `EInvalidStateTransition=1503`, `EOverRelease=1504`, `EVestingAlreadySet=1505`, `EMilestonePercentageMismatch=1506`, `EInvalidThreshold=1507`, `EAlreadyVoted=1508`, `EEscrowExpired=1510`, `EArbitratorIsPayer=1511`, `EArbitratorIsPayee=1512`, `EMinLockDuration=1513`
- `MIN_LOCK_DURATION_MS: u64 = 3_600_000` (1 hour, flash loan prevention)
- Structs: `Escrow has key` (workspace_id, deal_id, payer, payee, balance: Balance<SUI>, released_amount, refunded_amount, state, has_vesting, arbitrators, arbiter_threshold, expiry_ms, created_at, funded_at, version)
- `VestingSchedule has store` (vesting_type, cliff_ms, total_duration_ms, milestones, start_time)
- `Milestone has store, copy, drop` (description: String, percentage: u64, is_completed: bool, completed_at: u64)
- `ArbitrationState has store` (votes_release, votes_refund, resolved, resolution)
- Events: `EscrowCreated`, `EscrowFunded`, `EscrowReleased`, `EscrowRefunded`, `MilestoneCompleted`, `DisputeRaised`, `DisputeVoteCast`, `DisputeResolved` — all include workspace_id, escrow_id, actor, timestamp

**Step 3: Verify build**

Run: `cd packages/move && sui move build --path crm_escrow`
Expected: Build Successful

**Step 4: Commit**

```bash
git add packages/move/crm_escrow/
git commit -m "feat(move): scaffold crm_escrow package with structs and constants"
```

---

#### Task T2: Escrow entry functions — create, fund, release, refund

**Files:**
- Modify: `packages/move/crm_escrow/sources/escrow.move`

**Step 1: Implement helper functions**

```move
fun assert_state(escrow: &Escrow, expected: u8) {
    assert!(escrow.state == expected, EInvalidStateTransition);
}
fun assert_state_one_of(escrow: &Escrow, s1: u8, s2: u8) {
    assert!(escrow.state == s1 || escrow.state == s2, EInvalidStateTransition);
}
fun assert_is_payer(escrow: &Escrow, ctx: &TxContext) {
    assert!(ctx.sender() == escrow.payer, ENotPayer);
}
fun assert_is_payer_or_payee(escrow: &Escrow, ctx: &TxContext) {
    assert!(ctx.sender() == escrow.payer || ctx.sender() == escrow.payee, ENotPayer);
}
```

**Step 2: Implement create_escrow**

- Takes: `config: &GlobalConfig`, `workspace: &Workspace`, `cap: &WorkspaceAdminCap`, `deal_id: ID`, `payee: address`, `arbitrators: vector<address>`, `arbiter_threshold: u64`, `expiry_ms: Option<u64>`, `clock: &Clock`, `ctx: &mut TxContext`
- Guards: `assert_not_paused(config)`, `assert_cap_matches(cap, workspace_id)`, validate threshold (1..=len), validate arbitrators not payer/payee
- Creates Escrow with empty balance (`balance::zero<SUI>()`), state=CREATED
- `transfer::share_object(escrow)` — shared for arbitration access
- Emit `EscrowCreated` + `AuditEventV1`

**Step 3: Implement fund_escrow**

- Takes: `escrow: &mut Escrow`, `coin: Coin<SUI>`, `clock: &Clock`, `ctx: &TxContext`
- Guards: `assert_state(CREATED)`, `assert_is_payer`, coin value > 0
- `balance::join(&mut escrow.balance, coin::into_balance(coin))`
- Set state=FUNDED, funded_at=clock timestamp
- Emit `EscrowFunded`

**Step 4: Implement release**

- Takes: `escrow: &mut Escrow`, `amount: u64`, `clock: &Clock`, `ctx: &TxContext`
- Guards: `assert_state_one_of(FUNDED, PARTIALLY_RELEASED)`, `assert_is_payer`, `clock - funded_at >= MIN_LOCK_DURATION_MS`, `amount <= balance.value()`
- If has_vesting: assert amount <= calc_releasable (see T3)
- Split balance, transfer coin to payee
- Update released_amount, state (PARTIALLY_RELEASED or COMPLETED if balance == 0)
- Emit `EscrowReleased`

**Step 5: Implement refund**

- Takes: `escrow: &mut Escrow`, `clock: &Clock`, `ctx: &TxContext`
- Guards: `assert_is_payer`, state must be CREATED or FUNDED (non-disputed), or expired
- If expired (`expiry_ms.is_some() && clock >= expiry_ms`): allow refund from any funded state
- Transfer full remaining balance to payer
- Set state=REFUNDED, update refunded_amount
- Emit `EscrowRefunded`

**Step 6: Verify build**

Run: `cd packages/move && sui move build --path crm_escrow`
Expected: Build Successful

**Step 7: Commit**

```bash
git add packages/move/crm_escrow/
git commit -m "feat(move): escrow create, fund, release, refund entry functions"
```

---

#### Task T3: Vesting module — linear + milestone

**Files:**
- Create: `packages/move/crm_escrow/sources/vesting.move`
- Modify: `packages/move/crm_escrow/sources/escrow.move` (add_vesting, release_vested, complete_milestone)

**Step 1: Create vesting.move with pure calculation functions**

```move
module crm_escrow::vesting {
    use std::string::String;

    // Re-export types (defined in escrow.move, or define here)
    const LINEAR: u8 = 0;
    const MILESTONE: u8 = 1;

    /// Calculate linear vested amount using u128 intermediate
    public fun calc_linear_vested(total: u64, elapsed_ms: u64, duration_ms: u64): u64 {
        if (elapsed_ms >= duration_ms) return total;
        let vested = (total as u128) * (elapsed_ms as u128) / (duration_ms as u128);
        (vested as u64)
    }

    /// Calculate milestone vested amount (sum of completed milestone percentages)
    public fun calc_milestone_vested(total: u64, milestones: &vector<Milestone>): u64 {
        let mut completed_bps = 0u64;
        let mut i = 0;
        while (i < milestones.length()) {
            if (milestones[i].is_completed) {
                completed_bps = completed_bps + milestones[i].percentage;
            };
            i = i + 1;
        };
        let vested = (total as u128) * (completed_bps as u128) / (10000u128);
        (vested as u64)
    }

    /// Validate milestones sum to exactly 10000 basis points
    public fun assert_milestones_valid(milestones: &vector<Milestone>) {
        let mut sum = 0u64;
        let mut i = 0;
        while (i < milestones.length()) {
            sum = sum + milestones[i].percentage;
            i = i + 1;
        };
        assert!(sum == 10000, EMilestonePercentageMismatch);
    }
}
```

**Step 2: Add `add_vesting` to escrow.move**

- Takes: `escrow: &mut Escrow`, vesting params, `clock: &Clock`, `ctx: &TxContext`
- Guards: `assert_state(FUNDED)`, `assert_is_payer`, `!escrow.has_vesting`
- If MILESTONE type: `assert_milestones_valid(milestones)`
- Create VestingSchedule, embed via `dynamic_field::add(&mut escrow.id, b"vesting", schedule)`
- Set `escrow.has_vesting = true`

**Step 3: Add `release_vested` to escrow.move**

- Takes: `escrow: &mut Escrow`, `clock: &Clock`, `ctx: &TxContext`
- Guards: `assert_state_one_of(FUNDED, PARTIALLY_RELEASED)`, `assert_is_payer`
- Read VestingSchedule from dynamic field
- If cliff not passed: releasable = 0
- If LINEAR: `calc_linear_vested(initial_balance, elapsed, duration) - released_amount`
- If MILESTONE: `calc_milestone_vested(initial_balance, milestones) - released_amount`
- Release computed amount to payee (same logic as `release`)

**Step 4: Add `complete_milestone` to escrow.move**

- Takes: `escrow: &mut Escrow`, `milestone_idx: u64`, `clock: &Clock`, `ctx: &TxContext`
- Guards: `assert_state_one_of(FUNDED, PARTIALLY_RELEASED)`, `assert_is_payer`
- Borrow mut VestingSchedule from dynamic field
- Assert milestone_idx in bounds, not already completed
- Set `milestones[idx].is_completed = true`, `completed_at = clock.timestamp_ms()`
- Emit `MilestoneCompleted` with milestone_idx

**Step 5: Verify build**

Run: `cd packages/move && sui move build --path crm_escrow`

**Step 6: Commit**

```bash
git add packages/move/crm_escrow/
git commit -m "feat(move): vesting module — linear, milestone, and calculation functions"
```

---

#### Task T4: Arbitration module — on-chain voting

**Files:**
- Create: `packages/move/crm_escrow/sources/arbitration.move`
- Modify: `packages/move/crm_escrow/sources/escrow.move` (raise_dispute, vote_on_dispute)

**Step 1: Create arbitration.move helpers**

```move
module crm_escrow::arbitration {
    const DECISION_RELEASE: u8 = 0;
    const DECISION_REFUND: u8 = 1;

    public fun has_voted(state: &ArbitrationState, voter: address): bool {
        state.votes_release.contains(&voter) || state.votes_refund.contains(&voter)
    }

    public fun threshold_reached(state: &ArbitrationState, threshold: u64): Option<u8> {
        if (state.votes_release.length() as u64 >= threshold) {
            option::some(DECISION_RELEASE)
        } else if (state.votes_refund.length() as u64 >= threshold) {
            option::some(DECISION_REFUND)
        } else {
            option::none()
        }
    }
}
```

**Step 2: Add `raise_dispute` to escrow.move**

- Takes: `escrow: &mut Escrow`, `clock: &Clock`, `ctx: &TxContext`
- Guards: `assert_state_one_of(FUNDED, PARTIALLY_RELEASED)`, `assert_is_payer_or_payee`
- Create ArbitrationState (empty votes), embed via `dynamic_field::add(&mut escrow.id, b"arbitration", state)`
- Set state=DISPUTED
- Emit `DisputeRaised`

**Step 3: Add `vote_on_dispute` to escrow.move**

- Takes: `escrow: &mut Escrow`, `decision: u8`, `clock: &Clock`, `ctx: &TxContext`
- Guards: `assert_state(DISPUTED)`, sender must be in `escrow.arbitrators`, not already voted
- Record vote in ArbitrationState
- Emit `DisputeVoteCast`
- Check `threshold_reached`: if yes, auto-execute:
  - DECISION_RELEASE → transfer remaining balance to payee, state=COMPLETED
  - DECISION_REFUND → transfer remaining balance to payer, state=REFUNDED
  - Mark resolved=true, emit `DisputeResolved`

**Step 4: Verify build**

Run: `cd packages/move && sui move build --path crm_escrow`

**Step 5: Commit**

```bash
git add packages/move/crm_escrow/
git commit -m "feat(move): arbitration module — on-chain dispute voting with auto-execute"
```

---

#### Task T5: Escrow Move tests

**Files:**
- Create: `packages/move/crm_escrow/tests/escrow_tests.move`

**Step 1: Write tests**

Test scenarios:
1. `test_create_and_fund_escrow` — happy path create → fund → verify balance
2. `test_release_partial` — fund → release partial → verify PARTIALLY_RELEASED
3. `test_release_full` — fund → release full → verify COMPLETED
4. `test_refund_unfunded` — create → refund → verify REFUNDED
5. `test_refund_funded` — fund → refund → verify REFUNDED
6. `test_refund_expired` — fund → advance clock past expiry → refund succeeds
7. `test_release_before_min_lock` — fund → immediate release → expect abort EMinLockDuration
8. `test_linear_vesting` — fund → add linear vesting → advance clock 50% → release_vested → verify ~50% released
9. `test_milestone_vesting` — fund → add milestones → complete 1 of 2 → release_vested → verify correct %
10. `test_milestone_invalid_sum` — milestones sum != 10000 → expect abort
11. `test_dispute_and_resolve_release` — fund → raise dispute → 2-of-3 vote release → auto-execute
12. `test_dispute_and_resolve_refund` — fund → raise dispute → 2-of-3 vote refund → auto-execute
13. `test_cannot_release_during_dispute` — DISPUTED state → release → expect abort
14. `test_unauthorized_release` — non-payer calls release → expect abort
15. `test_double_vote` — arbitrator votes twice → expect abort

**Step 2: Run tests**

Run: `cd packages/move && sui move test --path crm_escrow`
Expected: All 15 tests pass

**Step 3: Commit**

```bash
git add packages/move/crm_escrow/
git commit -m "test(move): 15 escrow tests — lifecycle, vesting, arbitration, access control"
```

---

#### Task T6: Quest Badge SBT

**Files:**
- Create: `packages/move/crm_action/sources/quest_badge.move`
- Create: `packages/move/crm_action/tests/quest_badge_tests.move`

**Step 1: Implement quest_badge.move**

Full implementation as per design doc:
- OTW: `QUEST_BADGE has drop`
- `QuestBadge has key` (no store = SBT): workspace_id, quest_id (vector<u8>), quest_name (String), completed_steps, total_steps, completed_at, tier, issuer
- `QuestRegistry has key` with `minted: Table<vector<u8>, ID>` (shared, dedup)
- `init()`: claim publisher, create `Display<QuestBadge>`, share `QuestRegistry`
- `mint_badge()`: requires WorkspaceAdminCap, GlobalConfig pause check, dedup via registry, transfer to recipient
- Public accessors: `quest_id()`, `workspace_id()`, `tier()`, `is_complete()`, `completed_at()`
- Events: `QuestBadgeMinted`, `AuditEventV1`
- Helper: `make_dedup_key(quest_id, recipient)` using BCS

**Step 2: Write tests**

Test scenarios:
1. `test_mint_badge` — happy path mint, verify owner = recipient
2. `test_mint_badge_dedup` — mint same quest+recipient twice → expect abort EDuplicateBadge
3. `test_mint_badge_different_recipients` — same quest, two recipients → both succeed
4. `test_mint_requires_admin_cap` — wrong workspace cap → expect abort
5. `test_mint_when_paused` — config paused → expect abort
6. `test_accessors` — verify quest_id(), tier(), is_complete() return correct values
7. `test_badge_not_transferable` — QuestBadge has key only, no store (compile-time check via test attempt)

**Step 3: Build and test**

Run: `cd packages/move && sui move build --path crm_action && sui move test --path crm_action`
Expected: Build successful, all tests pass (existing airdrop/reward tests + 7 new quest tests)

**Step 4: Commit**

```bash
git add packages/move/crm_action/
git commit -m "feat(move): QuestBadge SBT with dedup registry, Display, and 7 tests"
```

---

### Agent 1B: Prisma Schema + Migration

**File ownership:** `packages/bff/prisma/schema.prisma`, `packages/bff/prisma/migrations/`
**DO NOT modify:** `packages/move/`, `packages/frontend/`, any `*.service.ts`, any `*.controller.ts`

---

#### Task T7: Add all P4 Prisma models

**Files:**
- Modify: `packages/bff/prisma/schema.prisma` (append after line ~510, end of file)

**Step 1: Add Escrow models**

Append to schema.prisma:

```prisma
// ── P4: Escrow ──────────────────────────────────

model Escrow {
  id               String    @id @default(uuid())
  workspaceId      String
  dealId           String
  suiObjectId      String?
  payer            String
  payee            String
  tokenType        String    @default("SUI")
  totalAmount      Decimal
  releasedAmount   Decimal   @default(0)
  refundedAmount   Decimal   @default(0)
  state            String    @default("CREATED")
  arbiterThreshold Int       @default(1)
  expiryAt         DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  version          Int       @default(0)

  deal             Deal      @relation(fields: [dealId], references: [id])
  workspace        Workspace @relation("WorkspaceEscrows", fields: [workspaceId], references: [id])
  vestingSchedule  VestingSchedule?
  arbitrators      EscrowArbitrator[]
  saftTemplates    SaftTemplate[]
}

model VestingSchedule {
  id              String    @id @default(uuid())
  escrowId        String    @unique
  vestingType     String
  cliffMs         BigInt    @default(0)
  totalDurationMs BigInt    @default(0)
  startTime       DateTime?
  milestones      Json      @default("[]")

  escrow          Escrow    @relation(fields: [escrowId], references: [id])
}

model EscrowArbitrator {
  id       String @id @default(uuid())
  escrowId String
  address  String

  escrow   Escrow @relation(fields: [escrowId], references: [id])
  @@unique([escrowId, address])
}

model SaftTemplate {
  id           String   @id @default(uuid())
  workspaceId  String
  escrowId     String?
  name         String
  terms        Json
  walrusBlobId String?
  createdAt    DateTime @default(now())

  escrow       Escrow?   @relation(fields: [escrowId], references: [id])
  workspace    Workspace @relation("WorkspaceSaftTemplates", fields: [workspaceId], references: [id])
}
```

**Step 2: Add Quest models**

```prisma
// ── P4: Quest ───────────────────────────────────

model Quest {
  id           String   @id @default(uuid())
  workspaceId  String
  name         String
  description  String?
  isActive     Boolean  @default(true)
  rewardType   String   @default("BADGE")
  rewardConfig Json     @default("{}")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  workspace    Workspace       @relation("WorkspaceQuests", fields: [workspaceId], references: [id])
  steps        QuestStep[]
  completions  QuestCompletion[]
}

model QuestStep {
  id                 String @id @default(uuid())
  questId            String
  orderIndex         Int
  title              String
  description        String?
  actionType         String
  actionConfig       Json    @default("{}")
  verificationMethod String  @default("INDEXER")
  chain              String  @default("SUI")

  quest              Quest   @relation(fields: [questId], references: [id])
  stepCompletions    QuestStepCompletion[]
}

model QuestCompletion {
  id          String   @id @default(uuid())
  questId     String
  profileId   String
  badgeSuiId  String?
  completedAt DateTime @default(now())

  quest       Quest   @relation(fields: [questId], references: [id])
  profile     Profile @relation(fields: [profileId], references: [id])
  @@unique([questId, profileId])
}

model QuestStepCompletion {
  id          String   @id @default(uuid())
  stepId      String
  profileId   String
  txDigest    String?
  verifiedBy  String
  completedAt DateTime @default(now())

  step        QuestStep @relation(fields: [stepId], references: [id])
  @@unique([stepId, profileId])
}
```

**Step 3: Add Lookalike model**

```prisma
// ── P4: Lookalike ───────────────────────────────

model LookalikeResult {
  id              String   @id @default(uuid())
  workspaceId     String
  seedSegmentId   String
  resultSegmentId String?
  topK            Int
  algorithm       String   @default("knn-cosine")
  centroid        Json
  results         Json
  createdAt       DateTime @default(now())

  workspace       Workspace @relation("WorkspaceLookalikes", fields: [workspaceId], references: [id])
  seedSegment     Segment   @relation("LookalikeSeed", fields: [seedSegmentId], references: [id])
  resultSegment   Segment?  @relation("LookalikeResult", fields: [resultSegmentId], references: [id])
}
```

**Step 4: Add GDPR models + Profile fields**

Add fields to existing Profile model (after `engagementScore` field, ~line 72):
```prisma
  gdprStatus      String   @default("NONE")
  gdprScheduledAt DateTime?
  gdprCompletedAt DateTime?
```

Add GDPR deletion log:
```prisma
// ── P4: GDPR ────────────────────────────────────

model GdprDeletionLog {
  id             String    @id @default(uuid())
  workspaceId    String
  profileId      String
  requestedBy    String
  legalBasis     String
  dataCategories Json
  scheduledAt    DateTime
  executedAt     DateTime?
  cancelledAt    DateTime?
  status         String    @default("PENDING")
  createdAt      DateTime  @default(now())

  workspace      Workspace @relation("WorkspaceGdprLogs", fields: [workspaceId], references: [id])
}
```

**Step 5: Add relation back-references**

Add to existing models:
- `Deal` model: add `escrows Escrow[]`
- `Workspace` model: add relation fields for new models
- `Profile` model: add `questCompletions QuestCompletion[]`
- `Segment` model: add `lookalikeSeed LookalikeResult[] @relation("LookalikeSeed")` and `lookalikeResult LookalikeResult[] @relation("LookalikeResult")`

**Step 6: Generate Prisma client**

Run: `cd packages/bff && npx prisma generate`
Expected: Prisma client generated successfully

**Step 7: Verify TypeScript compiles**

Run: `cd packages/bff && npx tsc --noEmit`
Expected: No errors (existing code doesn't reference new models yet)

**Step 8: Commit**

```bash
git add packages/bff/prisma/
git commit -m "feat(prisma): P4 schema — Escrow, Quest, Lookalike, GDPR models"
```

---

#### Task T8: Wave 1 merge + integration verify

**Files:** None (merge only)

**Step 1: Merge Agent 1A (Move contracts)**

If using worktrees: merge the Move branch into main.

**Step 2: Merge Agent 1B (Prisma schema)**

Merge the Prisma branch into main.

**Step 3: Regenerate Prisma client** (CRITICAL — see lessons.md)

Run: `cd packages/bff && npx prisma generate`

**Step 4: Verify everything compiles**

Run in parallel:
- `cd packages/bff && npx tsc --noEmit`
- `cd packages/frontend && npx tsc --noEmit`
- `cd packages/move && sui move build --path crm_escrow && sui move test --path crm_escrow`
- `cd packages/move && sui move build --path crm_action && sui move test --path crm_action`

Expected: All pass, zero errors

**Step 5: Run existing tests**

Run: `cd packages/bff && pnpm test:run && cd ../frontend && pnpm test:run`
Expected: BFF 28 suites 136 tests pass, Frontend 22 suites 111 tests pass (no regressions)

**Step 6: Commit**

```bash
git add -A && git commit -m "chore: Wave 1 merge — Move contracts + Prisma P4 schema verified"
```

---

## Wave 2: Escrow (BFF + Frontend)

### Agent 2A: BFF Escrow Service

**File ownership:** `packages/bff/src/deal/escrow*`, `packages/bff/src/deal/saft*`, `packages/bff/src/deal/deal.constants.ts`
**DO NOT modify:** `packages/frontend/`, `packages/move/`, `packages/bff/src/deal/deal.service.ts` (except importing EscrowService), `packages/bff/prisma/`

---

#### Task T9: EscrowService — CRUD + state machine

**Files:**
- Create: `packages/bff/src/deal/escrow.service.ts`
- Create: `packages/bff/src/deal/escrow.service.spec.ts`
- Create: `packages/bff/src/deal/dto/create-escrow.dto.ts`
- Create: `packages/bff/src/deal/dto/escrow-action.dto.ts`
- Modify: `packages/bff/src/deal/deal.constants.ts` (add DISPUTED stage)

**Step 1: Write tests for EscrowService**

Test scenarios (mock PrismaService + TxBuilderService):
1. `createEscrow` — creates Escrow + EscrowArbitrators, validates threshold
2. `fundEscrow` — updates state CREATED→FUNDED, builds chain TX (or dry-run)
3. `releasePartial` — validates FUNDED/PARTIALLY_RELEASED, updates amounts
4. `releaseFull` — sets state to COMPLETED
5. `refund` — validates eligible states, returns to REFUNDED
6. `getEscrowByDealId` — returns escrow with relations
7. `createEscrow with invalid threshold` — threshold > arbitrators.length → throws
8. `release in wrong state` — CREATED → throws

Run: `cd packages/bff && pnpm vitest run src/deal/escrow.service.spec.ts`
Expected: 8 tests FAIL (service not implemented)

**Step 2: Implement EscrowService**

```typescript
@Injectable()
export class EscrowService {
  constructor(
    private prisma: PrismaService,
    private txBuilder: TxBuilderService,
  ) {}

  async createEscrow(workspaceId: string, dto: CreateEscrowDto) { ... }
  async fundEscrow(escrowId: string, walletAddress: string) { ... }
  async release(escrowId: string, amount: number) { ... }
  async refund(escrowId: string) { ... }
  async raiseDispute(escrowId: string, raisedBy: string) { ... }
  async voteOnDispute(escrowId: string, voterAddress: string, decision: string) { ... }
  async getEscrowByDealId(dealId: string) { ... }
  async addVesting(escrowId: string, dto: AddVestingDto) { ... }
  async completeMilestone(escrowId: string, milestoneIdx: number) { ... }
}
```

State machine validation in each method. Chain TX via TxBuilderService (dry-run mode returns mock).

**Step 3: Run tests**

Expected: 8 tests PASS

**Step 4: Commit**

```bash
git add packages/bff/src/deal/escrow* packages/bff/src/deal/dto/
git commit -m "feat(bff): EscrowService — CRUD, state machine, vesting, arbitration — 8 tests"
```

---

#### Task T10: EscrowController + SaftTemplateService

**Files:**
- Create: `packages/bff/src/deal/escrow.controller.ts`
- Create: `packages/bff/src/deal/saft-template.service.ts`
- Create: `packages/bff/src/deal/saft-template.controller.ts`
- Modify: `packages/bff/src/deal/deal.module.ts` (add providers + controllers)

**Step 1: Implement EscrowController**

Endpoints:
- `POST /deals/:dealId/escrow` → createEscrow
- `POST /deals/:dealId/escrow/fund` → fundEscrow
- `POST /deals/:dealId/escrow/release` → release (body: { amount })
- `POST /deals/:dealId/escrow/refund` → refund
- `POST /deals/:dealId/escrow/dispute` → raiseDispute
- `POST /deals/:dealId/escrow/dispute/vote` → voteOnDispute (body: { decision })
- `GET /deals/:dealId/escrow` → getEscrowByDealId
- `POST /deals/:dealId/escrow/vesting` → addVesting
- `POST /deals/:dealId/escrow/milestone/:idx/complete` → completeMilestone

**Step 2: Implement SaftTemplateService**

- `create(workspaceId, dto)` — store template terms as JSON
- `list(workspaceId)` — list all templates
- `attachToEscrow(templateId, escrowId)` — link template to escrow
- `uploadSigned(templateId, walrusBlobId)` — store signed SAFT PDF blob reference

**Step 3: SaftTemplateController**

- `POST /saft-templates` → create
- `GET /saft-templates` → list
- `PUT /saft-templates/:id/attach` → attachToEscrow
- `PUT /saft-templates/:id/upload` → uploadSigned

**Step 4: Wire into DealModule**

Add EscrowService, EscrowController, SaftTemplateService, SaftTemplateController to deal.module.ts providers/controllers.

**Step 5: Verify**

Run: `cd packages/bff && npx tsc --noEmit && pnpm test:run`
Expected: tsc clean, all existing + new tests pass

**Step 6: Commit**

```bash
git add packages/bff/src/deal/
git commit -m "feat(bff): EscrowController + SaftTemplateService — REST endpoints for escrow lifecycle"
```

---

#### Task T11: Deal stage state machine (BFF-side)

**Files:**
- Modify: `packages/bff/src/deal/deal.constants.ts`
- Modify: `packages/bff/src/deal/deal.service.ts` (add state machine guard to updateStage)
- Create: `packages/bff/src/deal/deal-stage.spec.ts`

**Step 1: Write tests for stage transitions**

Test valid transitions:
- LEAD→QUALIFIED, QUALIFIED→PROPOSAL, PROPOSAL→NEGOTIATION
- NEGOTIATION→WON, NEGOTIATION→LOST, WON→CLOSED, LOST→CLOSED
- FUNDED escrow + WON → triggers escrow release hint
- DISPUTED escrow → deal.stage = DISPUTED

Test invalid transitions:
- LEAD→WON → throws
- CLOSED→anything → throws
- WON→LOST → throws

**Step 2: Implement stage transition map**

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  LEAD: ['QUALIFIED'],
  QUALIFIED: ['PROPOSAL'],
  PROPOSAL: ['NEGOTIATION'],
  NEGOTIATION: ['WON', 'LOST', 'DISPUTED'],
  WON: ['CLOSED'],
  LOST: ['CLOSED'],
  DISPUTED: ['NEGOTIATION', 'WON', 'LOST'],  // after dispute resolved
  CLOSED: [],
};
```

Add guard in `deal.service.ts` `updateStage()` method.

**Step 3: Run tests**

Expected: All pass

**Step 4: Commit**

```bash
git add packages/bff/src/deal/
git commit -m "feat(bff): deal stage state machine with BFF-side validation — 6 tests"
```

---

### Agent 2B: Frontend Escrow UI

**File ownership:** `packages/frontend/src/components/deal/escrow*`, `packages/frontend/src/components/deal/saft*`, `packages/frontend/src/app/(dashboard)/deals/[id]/*`
**DO NOT modify:** `packages/bff/`, `packages/move/`, existing deal components (deal-card.tsx, deal-kanban.tsx, etc.)

---

#### Task T12: Escrow Tab component

**Files:**
- Create: `packages/frontend/src/components/deal/escrow-panel.tsx`
- Create: `packages/frontend/src/components/deal/escrow-actions.tsx`
- Create: `packages/frontend/src/components/deal/vesting-timeline.tsx`
- Create: `packages/frontend/src/components/deal/__tests__/escrow-panel.test.tsx`

**Step 1: Write tests**

Test scenarios:
1. Renders escrow state badge (CREATED, FUNDED, etc.)
2. Shows fund status bar (released/total as progress bar)
3. Shows payer/payee addresses (truncated)
4. Fund button visible only when state=CREATED and user is payer
5. Release button visible when FUNDED/PARTIALLY_RELEASED
6. Dispute button visible when FUNDED/PARTIALLY_RELEASED
7. Vesting timeline renders milestones with completion status

**Step 2: Implement EscrowPanel**

- Props: `escrow: EscrowData, currentUserAddress: string`
- State badge using shadcn Badge
- Progress bar (releasedAmount / totalAmount)
- Conditional action buttons based on state + role

**Step 3: Implement VestingTimeline**

- Props: `vesting: VestingScheduleData`
- Visual timeline: cliff period → linear gradient or milestone checkpoints
- Each milestone: title, percentage, completed/pending badge

**Step 4: Implement EscrowActions**

- Fund dialog (amount input + confirm)
- Release dialog (partial amount or full)
- Dispute confirmation dialog
- Vote dialog (release/refund radio + confirm)

**Step 5: Run tests**

Run: `cd packages/frontend && pnpm vitest run src/components/deal/__tests__/escrow-panel.test.tsx`
Expected: 7 tests pass

**Step 6: Commit**

```bash
git add packages/frontend/src/components/deal/
git commit -m "feat(frontend): EscrowPanel + VestingTimeline + EscrowActions — 7 tests"
```

---

#### Task T13: SAFT Template UI

**Files:**
- Create: `packages/frontend/src/components/deal/saft-template-picker.tsx`
- Create: `packages/frontend/src/components/deal/saft-terms-form.tsx`
- Create: `packages/frontend/src/components/deal/__tests__/saft-template.test.tsx`

**Step 1: Write tests**

1. Template picker renders list of templates
2. Selecting template populates terms form
3. Terms form validates required fields (tokenSymbol, totalTokens, cliff, vestingMonths)
4. Submit calls API to create/attach template

**Step 2: Implement SaftTemplatePicker**

- Fetches `GET /saft-templates` on mount
- List with radio selection
- "Create New" option

**Step 3: Implement SaftTermsForm**

- Fields: tokenSymbol, totalTokens, pricePerToken, cliffMonths, vestingMonths, jurisdiction
- react-hook-form + zod validation
- Upload signed PDF button (triggers Walrus upload flow)

**Step 4: Run tests**

Expected: 4 tests pass

**Step 5: Commit**

```bash
git add packages/frontend/src/components/deal/
git commit -m "feat(frontend): SAFT template picker + terms form — 4 tests"
```

---

#### Task T14: Deal detail page — Escrow tab integration

**Files:**
- Modify: `packages/frontend/src/app/(dashboard)/deals/[id]/page.tsx` (add Escrow tab)
- Create: `packages/frontend/src/app/(dashboard)/deals/[id]/__tests__/escrow-tab.test.tsx`

**Step 1: Write tests**

1. Escrow tab appears in deal detail tabs
2. When no escrow exists, shows "Create Escrow" CTA
3. When escrow exists, shows EscrowPanel
4. SAFT section appears below escrow panel

**Step 2: Integrate EscrowPanel into deal detail**

- Add "Escrow" tab alongside existing tabs
- Fetch escrow data via `GET /deals/:id/escrow`
- If no escrow: show create form (payee address, arbitrators, threshold)
- If escrow exists: render EscrowPanel + SaftTemplatePicker

**Step 3: Run tests**

Expected: 4 tests pass

**Step 4: Commit**

```bash
git add packages/frontend/src/app/(dashboard)/deals/ packages/frontend/src/components/deal/
git commit -m "feat(frontend): deal detail escrow tab integration — 4 tests"
```

---

#### Task T15: Wave 2 merge + verify

**Step 1: Merge Agent 2A (BFF escrow) then Agent 2B (frontend escrow)**

**Step 2: Verify**

Run:
- `cd packages/bff && npx tsc --noEmit && pnpm test:run`
- `cd packages/frontend && npx tsc --noEmit && pnpm test:run`

Expected: BFF ~30+ suites pass, Frontend ~25+ suites pass, zero TS errors

**Step 3: Commit**

```bash
git commit -m "chore: Wave 2 merge — Escrow BFF + frontend verified"
```

---

## Wave 3: Quest + Lookalike

### Agent 3A: Quest Module (BFF)

**File ownership:** `packages/bff/src/quest/` (new), `packages/bff/src/campaign/workflow/actions/assign-quest.action.ts` (new), `packages/bff/src/campaign/trigger/` (add quest_completed trigger)
**DO NOT modify:** `packages/frontend/`, `packages/move/`, `packages/bff/src/segment/`

---

#### Task T16: QuestService — CRUD + progress tracking

**Files:**
- Create: `packages/bff/src/quest/quest.module.ts`
- Create: `packages/bff/src/quest/quest.service.ts`
- Create: `packages/bff/src/quest/quest.service.spec.ts`
- Create: `packages/bff/src/quest/dto/create-quest.dto.ts`
- Create: `packages/bff/src/quest/dto/quest-step.dto.ts`
- Create: `packages/bff/src/quest/dto/claim-step.dto.ts`

**Step 1: Write tests**

1. `createQuest` — creates quest + steps in transaction
2. `listQuests` — returns active quests for workspace
3. `getQuest` — returns quest with steps and completion counts
4. `updateQuest` — updates name, description, isActive
5. `getProgress` — returns step completion status for a profile
6. `completeQuest` — marks quest done, returns badgeSuiId placeholder

Run: Expected FAIL

**Step 2: Implement QuestService**

Standard NestJS service with PrismaService. `createQuest` uses `prisma.$transaction` to create Quest + QuestSteps atomically.

**Step 3: Run tests**

Expected: 6 tests PASS

**Step 4: Commit**

```bash
git add packages/bff/src/quest/
git commit -m "feat(bff): QuestService CRUD + progress tracking — 6 tests"
```

---

#### Task T17: QuestVerificationService — hybrid engine

**Files:**
- Create: `packages/bff/src/quest/quest-verification.service.ts`
- Create: `packages/bff/src/quest/quest-verification.service.spec.ts`
- Create: `packages/bff/src/quest/verifiers/indexer.verifier.ts`
- Create: `packages/bff/src/quest/verifiers/rpc.verifier.ts`
- Create: `packages/bff/src/quest/verifiers/manual.verifier.ts`

**Step 1: Write tests**

1. `claimStep (INDEXER)` — finds matching wallet_event → creates QuestStepCompletion
2. `claimStep (RPC)` — queries SUI RPC for TX → creates completion with txDigest
3. `claimStep (MANUAL)` — returns pending, admin must approve
4. `claimStep already completed` — returns existing completion, no duplicate
5. `claimStep all steps done` — auto-triggers quest completion + SBT mint (dry-run)
6. `claimStep invalid quest` — throws NotFoundException

**Step 2: Implement verification service**

- `StepVerifier` interface: `verify(profileId, step): Promise<{ verified: boolean, txDigest?: string }>`
- `IndexerVerifier`: query `WalletEvent` table matching actionType + chain
- `RpcVerifier`: use SuiClient.getTransactionBlock or Moralis for EVM/Solana
- `ManualVerifier`: always returns `{ verified: false }` (admin approves via separate endpoint)
- Router: `getVerifier(method: string): StepVerifier`

**Step 3: Run tests**

Expected: 6 tests PASS

**Step 4: Commit**

```bash
git add packages/bff/src/quest/
git commit -m "feat(bff): QuestVerificationService — hybrid engine (indexer/RPC/manual) — 6 tests"
```

---

#### Task T18: QuestController + workflow integration

**Files:**
- Create: `packages/bff/src/quest/quest.controller.ts`
- Create: `packages/bff/src/campaign/workflow/actions/assign-quest.action.ts`
- Modify: `packages/bff/src/campaign/trigger/trigger-matcher.service.ts` (add quest_completed trigger type)
- Modify: `packages/bff/src/campaign/workflow/workflow.engine.ts` (register assign_quest action)
- Modify: `packages/bff/src/app.module.ts` (add QuestModule)

**Step 1: Implement QuestController**

- `POST /quests` → createQuest
- `GET /quests` → listQuests
- `GET /quests/:id` → getQuest
- `PUT /quests/:id` → updateQuest
- `POST /quests/:id/steps/:stepId/claim` → claimStep
- `GET /quests/:id/progress/:profileId` → getProgress

**Step 2: Implement assign_quest action**

```typescript
export class AssignQuestAction implements WorkflowAction {
  type = 'assign_quest';
  async execute(context: ActionContext): Promise<void> {
    // context.params.questId → assign to context.profileId
  }
}
```

**Step 3: Add quest_completed trigger**

In trigger-matcher.service.ts, add case for `quest_completed` event type — matches when a quest completion record is created.

**Step 4: Wire QuestModule into AppModule**

**Step 5: Verify**

Run: `cd packages/bff && npx tsc --noEmit && pnpm test:run`
Expected: tsc clean, all tests pass

**Step 6: Commit**

```bash
git add packages/bff/src/quest/ packages/bff/src/campaign/ packages/bff/src/app.module.ts
git commit -m "feat(bff): QuestController + assign_quest action + quest_completed trigger"
```

---

### Agent 3B: Lookalike Service + Frontend

**File ownership:** `packages/bff/src/segment/lookalike/` (new), `packages/frontend/src/components/segment/lookalike*` (new)
**DO NOT modify:** `packages/bff/src/quest/`, `packages/bff/src/deal/`, `packages/move/`, existing segment service/controller (only extend with new endpoints)

---

#### Task T19: Feature extraction + K-NN cosine similarity

**Files:**
- Create: `packages/bff/src/segment/lookalike/lookalike.service.ts`
- Create: `packages/bff/src/segment/lookalike/feature-extraction.service.ts`
- Create: `packages/bff/src/segment/lookalike/strategies/knn-cosine.strategy.ts`
- Create: `packages/bff/src/segment/lookalike/sources/internal.source.ts`
- Create: `packages/bff/src/segment/lookalike/lookalike.service.spec.ts`

**Step 1: Write tests**

1. `extractFeatures` — given profile with known data → returns 6-dim vector, normalized [0,1]
2. `cosineSimilarity` — unit test: [1,0,0] vs [1,0,0] = 1.0, [1,0,0] vs [0,1,0] = 0.0
3. `findSimilar` — 5 profiles, seed segment of 2, top 2 → returns 2 most similar non-seed profiles
4. `findSimilar with minSimilarity` — filters out profiles below threshold
5. `getCandidates (internal)` — returns all workspace profiles excluding seed IDs

**Step 2: Implement feature extraction**

```typescript
interface ProfileFeatureVector {
  profileId: string;
  vector: number[]; // 6 dimensions
}

@Injectable()
export class FeatureExtractionService {
  constructor(private prisma: PrismaService) {}

  async extractFeatures(profileIds: string[]): Promise<ProfileFeatureVector[]> {
    // Query profiles, wallet_events, engagement scores
    // Normalize each dimension to [0,1]
    // Return feature vectors
  }
}
```

**Step 3: Implement K-NN cosine strategy**

```typescript
export class KnnCosineStrategy implements SimilarityStrategy {
  name = 'knn-cosine';

  async findSimilar(seeds, candidates, topK): Promise<ScoredProfile[]> {
    const centroid = this.computeCentroid(seeds);
    return candidates
      .map(c => ({ profileId: c.profileId, similarity: cosineSimilarity(centroid, c.vector) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}
```

**Step 4: Implement LookalikeService orchestrator**

```typescript
@Injectable()
export class LookalikeService {
  async findLookalike(workspaceId, segmentId, opts: { topK, minSimilarity, algorithm })
  async createSegmentFromResults(workspaceId, seedSegmentId, resultProfileIds)
}
```

**Step 5: Run tests**

Expected: 5 tests PASS

**Step 6: Commit**

```bash
git add packages/bff/src/segment/lookalike/
git commit -m "feat(bff): Lookalike — feature extraction + K-NN cosine similarity — 5 tests"
```

---

#### Task T20: Lookalike controller + frontend

**Files:**
- Create: `packages/bff/src/segment/lookalike/lookalike.controller.ts`
- Modify: `packages/bff/src/segment/segment.module.ts` (add LookalikeService, controller)
- Create: `packages/frontend/src/components/segment/lookalike-dialog.tsx`
- Create: `packages/frontend/src/components/segment/lookalike-results.tsx`
- Create: `packages/frontend/src/components/segment/feature-radar-chart.tsx`
- Create: `packages/frontend/src/components/segment/__tests__/lookalike-dialog.test.tsx`

**Step 1: Implement LookalikeController**

- `POST /segments/:id/lookalike` → findLookalike (body: { topK?, minSimilarity? })
- `POST /segments/:id/lookalike/create-segment` → createSegmentFromResults

**Step 2: Wire into SegmentModule**

**Step 3: Write frontend tests**

1. "Find Lookalike" button appears on segment detail
2. Dialog shows loading → results list
3. Results show similarity score per profile
4. "Create Segment" button triggers API call
5. Radar chart renders 6 axes

**Step 4: Implement LookalikeDialog**

- Trigger: button on segment detail page
- Form: topK slider (10-100), minSimilarity slider (0.5-0.95)
- Submit → POST /segments/:id/lookalike

**Step 5: Implement LookalikeResults**

- Similarity histogram (recharts BarChart)
- Ranked profile list with similarity badge
- Feature radar chart (recharts RadarChart, 6 axes)

**Step 6: Run tests**

Expected: 5 tests PASS

**Step 7: Commit**

```bash
git add packages/bff/src/segment/ packages/frontend/src/components/segment/
git commit -m "feat: Lookalike controller + frontend (dialog, results, radar chart) — 5 tests"
```

---

#### Task T21: Quest frontend

**Files:**
- Create: `packages/frontend/src/app/(dashboard)/quests/page.tsx`
- Create: `packages/frontend/src/app/(dashboard)/quests/new/page.tsx`
- Create: `packages/frontend/src/components/quest/quest-list.tsx`
- Create: `packages/frontend/src/components/quest/quest-builder.tsx`
- Create: `packages/frontend/src/components/quest/quest-step-editor.tsx`
- Create: `packages/frontend/src/components/quest/quest-progress-card.tsx`
- Create: `packages/frontend/src/components/quest/__tests__/quest-builder.test.tsx`

**Step 1: Write tests**

1. Quest list renders quests with active/inactive badges
2. Quest builder renders step editor for each step
3. Step editor allows setting actionType, verificationMethod, chain
4. Adding step increases step count
5. Removing step decreases step count
6. Submit calls POST /quests with correct payload
7. Quest progress card shows step checklist with completion status

**Step 2: Implement QuestList**

- Fetches GET /quests
- Card per quest: name, description, step count, completion count, active toggle

**Step 3: Implement QuestBuilder**

- Form: quest name, description, reward type
- Dynamic step list with QuestStepEditor per step
- Add/remove step buttons

**Step 4: Implement QuestStepEditor**

- Fields: title, actionType (select), verificationMethod (select), chain (select), actionConfig (JSON editor)

**Step 5: Implement QuestProgressCard**

- For profile detail page: shows quest steps as checklist
- Each step: title, status (completed/pending), txDigest link

**Step 6: Run tests**

Expected: 7 tests PASS

**Step 7: Commit**

```bash
git add packages/frontend/src/app/(dashboard)/quests/ packages/frontend/src/components/quest/
git commit -m "feat(frontend): Quest list, builder, step editor, progress card — 7 tests"
```

---

#### Task T22: Wave 3 merge + verify

**Step 1: Merge Agent 3A (Quest BFF) then Agent 3B (Lookalike + Quest frontend)**

**Step 2: Verify**

Run:
- `cd packages/bff && npx tsc --noEmit && pnpm test:run`
- `cd packages/frontend && npx tsc --noEmit && pnpm test:run`

Expected: BFF ~34+ suites, Frontend ~29+ suites, zero errors

**Step 3: Commit**

```bash
git commit -m "chore: Wave 3 merge — Quest + Lookalike BFF + frontend verified"
```

---

## Wave 4: GDPR + Production Hardening

### Agent 4A: GDPR Module

**File ownership:** `packages/bff/src/gdpr/` (new)
**DO NOT modify:** `packages/frontend/`, `packages/move/`, `packages/bff/src/common/cache/`, any existing services

---

#### Task T23: GdprService — deletion flow + export

**Files:**
- Create: `packages/bff/src/gdpr/gdpr.module.ts`
- Create: `packages/bff/src/gdpr/gdpr.service.ts`
- Create: `packages/bff/src/gdpr/gdpr-executor.service.ts`
- Create: `packages/bff/src/gdpr/gdpr-export.service.ts`
- Create: `packages/bff/src/gdpr/gdpr.service.spec.ts`

**Step 1: Write tests**

1. `initiateDeletion` — sets profile gdprStatus=PENDING_DELETION, creates GdprDeletionLog
2. `cancelDeletion` — within grace period → resets gdprStatus=NONE, log status=CANCELLED
3. `cancelDeletion after grace period` — throws (too late)
4. `getStatus` — returns NONE, PENDING_DELETION, or COMPLETED
5. `executeDeletion` — nullifies PII fields, deletes social links, removes segment memberships
6. `executeDeletion` — destroys vault keys (mock Seal client)
7. `exportProfile` — returns complete JSON dump with all related data
8. `exportProfile after deletion` — throws (PII already gone)
9. `GdprCleanupJob` — finds eligible profiles → runs executeDeletion

Run: Expected FAIL

**Step 2: Implement GdprService**

```typescript
@Injectable()
export class GdprService {
  async initiateDeletion(workspaceId, profileId, requestedBy, legalBasis)
  async cancelDeletion(profileId)
  async getStatus(profileId)
}
```

**Step 3: Implement GdprExecutorService**

```typescript
@Injectable()
export class GdprExecutorService {
  async execute(profileId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // 1. Nullify PII
      await tx.profile.update({ where: { id: profileId }, data: { name: null, notes: null, gdprStatus: 'COMPLETED', gdprCompletedAt: new Date() } });
      // 2. Delete social links
      await tx.socialLink.deleteMany({ where: { profileId } });
      // 3. Unbind wallets
      await tx.profileWallet.updateMany({ where: { profileId }, data: { profileId: null } });
      // 4. Remove segment memberships
      await tx.segmentMembership.deleteMany({ where: { profileId } });
      // 5. Anonymize quest completions
      await tx.questCompletion.updateMany({ where: { profileId }, data: { profileId: null } });
      // 6. Update deletion log
      await tx.gdprDeletionLog.updateMany({ where: { profileId, status: 'PENDING' }, data: { status: 'EXECUTED', executedAt: new Date() } });
    });
    // 7. Destroy Seal keys (outside transaction — external service)
    await this.destroySealKeys(profileId);
  }
}
```

**Step 4: Implement GdprExportService**

```typescript
@Injectable()
export class GdprExportService {
  async export(profileId: string): Promise<GdprExportData> {
    // Query all related data, return structured JSON
  }
}
```

**Step 5: Run tests**

Expected: 9 tests PASS

**Step 6: Commit**

```bash
git add packages/bff/src/gdpr/
git commit -m "feat(bff): GdprService — deletion flow, executor, export — 9 tests"
```

---

#### Task T24: GdprController + cleanup job

**Files:**
- Create: `packages/bff/src/gdpr/gdpr.controller.ts`
- Create: `packages/bff/src/gdpr/gdpr-cleanup.job.ts`
- Modify: `packages/bff/src/app.module.ts` (add GdprModule)

**Step 1: Implement GdprController**

- `DELETE /profiles/:id/gdpr` → initiateDeletion (body: { legalBasis })
- `GET /profiles/:id/gdpr/status` → getStatus
- `POST /profiles/:id/gdpr/cancel` → cancelDeletion
- `GET /profiles/:id/export` → export

**Step 2: Implement GdprCleanupJob**

```typescript
@Injectable()
export class GdprCleanupJob {
  private interval: NodeJS.Timeout;

  onModuleInit() {
    // Run daily (86400000ms)
    this.interval = setInterval(() => this.run(), 86_400_000);
  }

  async run() {
    const eligible = await this.prisma.profile.findMany({
      where: { gdprStatus: 'PENDING_DELETION', gdprScheduledAt: { lte: new Date() } },
    });
    for (const profile of eligible) {
      await this.executor.execute(profile.id);
    }
  }
}
```

**Step 3: Wire GdprModule into AppModule**

**Step 4: Verify**

Run: `cd packages/bff && npx tsc --noEmit && pnpm test:run`

**Step 5: Commit**

```bash
git add packages/bff/src/gdpr/ packages/bff/src/app.module.ts
git commit -m "feat(bff): GdprController + daily cleanup job"
```

---

### Agent 4B: Production Hardening

**File ownership:** `packages/bff/src/common/cache/` (new), `packages/bff/src/common/health/` (new), `packages/bff/src/common/throttle/` (new), `docker-compose.prod.yml`, `scripts/`
**DO NOT modify:** `packages/bff/src/gdpr/`, `packages/move/`, `packages/frontend/src/` (except Sentry init)

---

#### Task T25: Redis caching layer

**Files:**
- Create: `packages/bff/src/common/cache/cache.module.ts`
- Create: `packages/bff/src/common/cache/cache.service.ts`
- Create: `packages/bff/src/common/cache/cacheable.decorator.ts`
- Create: `packages/bff/src/common/cache/cache.service.spec.ts`

**Step 1: Write tests**

1. `get/set` — set key with TTL, get returns value
2. `get expired` — returns null after TTL
3. `evict` — removes key
4. `@Cacheable decorator` — first call hits service, second call returns cached
5. `@Cacheable with eviction` — after evict, next call hits service again

**Step 2: Implement CacheService**

```typescript
@Injectable()
export class CacheService {
  constructor(@Inject('REDIS_CLIENT') private redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async evict(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
```

**Step 3: Implement @Cacheable decorator**

Method decorator that checks cache before executing, stores result on cache miss.

**Step 4: CacheModule**

Provides REDIS_CLIENT (from existing ioredis config) + CacheService. `@Global()` so all modules can use it.

**Step 5: Run tests** (mock Redis)

Expected: 5 tests PASS

**Step 6: Commit**

```bash
git add packages/bff/src/common/cache/
git commit -m "feat(bff): Redis caching layer — CacheService + @Cacheable decorator — 5 tests"
```

---

#### Task T26: Rate limiting

**Files:**
- Modify: `packages/bff/package.json` (add @nestjs/throttler)
- Create: `packages/bff/src/common/throttle/throttle.config.ts`
- Modify: `packages/bff/src/app.module.ts` (add ThrottlerModule)

**Step 1: Install dependency**

Run: `cd packages/bff && pnpm add @nestjs/throttler`

**Step 2: Configure ThrottlerModule**

```typescript
ThrottlerModule.forRoot([
  { name: 'global', ttl: 60000, limit: 100 },
  { name: 'auth', ttl: 60000, limit: 10 },
  { name: 'ai', ttl: 60000, limit: 20 },
  { name: 'gdpr', ttl: 600000, limit: 3 },
]),
```

**Step 3: Apply decorators to controllers**

- AuthController: `@Throttle({ auth: { ttl: 60000, limit: 10 } })`
- AgentController(s): `@Throttle({ ai: { ttl: 60000, limit: 20 } })`
- GdprController (export): `@Throttle({ gdpr: { ttl: 600000, limit: 3 } })`

**Step 4: Verify build**

Run: `cd packages/bff && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add packages/bff/
git commit -m "feat(bff): rate limiting — global 100/min, auth 10/min, AI 20/min, GDPR 3/10min"
```

---

#### Task T27: Health checks

**Files:**
- Create: `packages/bff/src/common/health/health.controller.ts`
- Create: `packages/bff/src/common/health/health.service.ts`

**Step 1: Implement HealthService**

```typescript
@Injectable()
export class HealthService {
  async check(): Promise<{ status: string; uptime: number; version: string }> { ... }
  async checkDetailed(): Promise<{ db, redis, sui }> {
    // db: prisma.$queryRaw`SELECT 1`
    // redis: redis.ping()
    // sui: suiClient.getLatestCheckpointSequenceNumber()
  }
}
```

**Step 2: Implement HealthController**

- `GET /health` → basic check
- `GET /health/detailed` → full check (db, redis, sui)

**Step 3: Verify**

Run: `cd packages/bff && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add packages/bff/src/common/health/
git commit -m "feat(bff): health check endpoints — basic + detailed (db, redis, sui)"
```

---

#### Task T28: Structured logging + Sentry

**Files:**
- Modify: `packages/bff/package.json` (add nestjs-pino, pino-pretty, @sentry/nestjs)
- Modify: `packages/frontend/package.json` (add @sentry/nextjs)
- Modify: `packages/bff/src/main.ts` (add pino logger, Sentry init)
- Create: `packages/frontend/sentry.client.config.ts`
- Create: `packages/frontend/sentry.server.config.ts`

**Step 1: Install deps**

Run:
- `cd packages/bff && pnpm add nestjs-pino pino-http pino-pretty @sentry/nestjs @sentry/profiling-node`
- `cd packages/frontend && pnpm add @sentry/nextjs`

**Step 2: Configure pino in BFF main.ts**

```typescript
import { LoggerModule } from 'nestjs-pino';

// In AppModule imports:
LoggerModule.forRoot({
  pinoHttp: {
    transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
  },
}),
```

**Step 3: Sentry BFF init**

```typescript
import * as Sentry from '@sentry/nestjs';
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
}
```

**Step 4: Sentry frontend config**

Create `sentry.client.config.ts` and `sentry.server.config.ts` with `@sentry/nextjs` init.

**Step 5: Verify build**

Run:
- `cd packages/bff && npx tsc --noEmit`
- `cd packages/frontend && npx tsc --noEmit`

**Step 6: Commit**

```bash
git add packages/bff/ packages/frontend/
git commit -m "feat: structured logging (pino) + Sentry error tracking (BFF + frontend)"
```

---

#### Task T29: Docker compose prod + migration script

**Files:**
- Modify: `docker-compose.prod.yml`
- Create: `scripts/migrate-production.sh`

**Step 1: Finalize docker-compose.prod.yml**

Add resource limits, health checks, environment references:
```yaml
services:
  bff:
    deploy:
      resources:
        limits: { cpus: '2', memory: 2G }
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
  db:
    deploy:
      resources:
        limits: { cpus: '1', memory: 1G }
    volumes:
      - timescaledb_data:/var/lib/postgresql/data
  redis:
    deploy:
      resources:
        limits: { cpus: '0.5', memory: 512M }
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
```

**Step 2: Create migration script**

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "==> Backing up database..."
pg_dump "$DATABASE_URL" > "backup_$(date +%Y%m%d_%H%M%S).sql"
echo "==> Running Prisma migrations..."
cd packages/bff && npx prisma migrate deploy
echo "==> Regenerating Prisma client..."
npx prisma generate
echo "==> Verifying schema..."
npx prisma db pull --force
echo "==> Migration complete."
```

**Step 3: Commit**

```bash
git add docker-compose.prod.yml scripts/
git commit -m "feat: Docker compose prod finalized + production migration script"
```

---

#### Task T30: Wave 4 merge + final verify

**Step 1: Merge Agent 4A (GDPR) then Agent 4B (Production hardening)**

**Step 2: Regenerate Prisma** (lessons.md: always after schema changes in worktrees)

Run: `cd packages/bff && npx prisma generate`

**Step 3: Full verification**

Run all in sequence:
```bash
cd packages/bff && npx tsc --noEmit && pnpm test:run
cd ../frontend && npx tsc --noEmit && pnpm test:run
cd ../move && sui move test --path crm_escrow && sui move test --path crm_action
```

Expected:
- BFF: ~36+ test suites, ~170+ tests pass
- Frontend: ~32+ test suites, ~140+ tests pass
- Move: 15 escrow tests + 7 quest badge tests + existing tests = all pass
- Zero TS errors on both sides

**Step 4: Final commit**

```bash
git commit -m "chore: Wave 4 merge — GDPR + Production hardening — P4 complete"
```

---

## Summary

| Wave | Tasks | New Tests (est.) | Key Outputs |
|------|-------|-----------------|-------------|
| W1: Foundation | T1-T8 | 22 Move tests | crm_escrow (3 modules), QuestBadge SBT, Prisma P4 schema |
| W2: Escrow | T9-T15 | ~25 tests | EscrowService, EscrowController, SAFT, Deal stage SM, Escrow UI |
| W3: Quest+Lookalike | T16-T22 | ~34 tests | QuestModule, verification engine, LookalikeService, Quest UI |
| W4: GDPR+Production | T23-T30 | ~19 tests | GdprModule, CacheService, rate limiting, health, logging, Sentry |
| **Total** | **30 tasks** | **~100 tests** | Full P4 feature set |

### P5 Backlog (from design decisions)

- [ ] Multi-token escrow: `Escrow<phantom T>` with `Balance<T>`
- [ ] Lookalike: Graph-based similarity (C) + on-chain wallet discovery
- [ ] Security audit prep: SlowMist/CertiK checklist, OWASP top 10 scan
- [ ] Quest badge revocation: Receiving pattern or shared registry
