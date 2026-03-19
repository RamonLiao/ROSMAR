# ROSMAR CRM — Roadmap (P3 / P4 / Future)

**Last updated**: 2026-03-15
**Baseline**: P0 + P1 + P2 complete (~64% spec coverage, 41/69 features)

---

## Dependency Graph

```
Rust Indexer ─────┬─> Engagement Score Calc ──> Auto-tagging
(event pipeline)  ├─> Governance Handler      ──> DAO features
                  ├─> Whale Alert dispatch    ──> Notification center
                  └─> Event Triggers          ──> Journey Builder triggers

Seal SDK ─────────┬─> Vault ACL wiring (policy-based multi-user decrypt)
                  ├─> Deal Room encrypted docs
                  └─> GDPR key destruction

Multi-chain RPC ──┬─> EVM/Solana balance
                  ├─> ENS/SNS resolution
                  └─> Cross-chain Net Worth

LLM Integration ──┬─> AI Analyst Agent
                  ├─> Content Agent
                  └─> Action Agent planning
```

---

## Remaining P2 (Foundation — not yet started)

### P2-1: Rust Indexer Completion [CRITICAL PATH]

**Current state**: Components exist but pipeline is disconnected.
- CheckpointConsumer: polls Sui RPC, extracts events (done)
- EventRouter: dispatch logic exists but **not wired** to consumer
- Handlers (NFT, DeFi, Audit): write to DB (done)
- Enricher (address -> profile_id): preloaded but **unused**
- AlertEngine (whale alerts): logic done but **not called**
- GovernanceHandler: **does not exist**
- Webhook to BFF: no general event webhook

**Target**:
```
Sui RPC → CheckpointConsumer → EventRouter → Handlers → Enricher
  → BatchWriter → wallet_events INSERT (TimescaleDB)
  → AlertEngine → webhook (whale-alert)
  → WebhookDispatcher → POST /webhooks/indexer-event (all types)
```

**Webhook payload (unified)**:
```json
{
  "event_id": "uuid",
  "event_type": "nft_transfer | defi_swap | governance_vote | whale_alert | ...",
  "profile_id": "uuid | null",
  "address": "0x...",
  "data": {},
  "tx_digest": "...",
  "timestamp": 1709827200000
}
```

**Governance event schema**: See `docs/specs/governance-event-spec.md`

**BFF receiver**: `POST /webhooks/indexer-event` → validate → persist whale alerts → emit internal event (interface for P3-2)

**Integration tests**: Docker compose test profile, mock checkpoint JSON → handlers → assert DB rows

**Files**: `packages/indexer/src/`
**Unlocks**: P3-2 Journey triggers, engagement score, whale alerts, asset view

### P2-6: Seal SDK Integration [CRITICAL PATH]

**Current state**: Web Crypto AES-GCM working (single-user). Seal SDK not integrated.

**Decision**: Full Seal replacement, no Web Crypto fallback.
- App is online-only (Sui RPC + Walrus + BFF required)
- Seal enables policy-based multi-user decryption
- Session key: sign once at login, reuse for all operations

**Encryption flow**:
```
ENCRYPT:
  1. User picks/creates AccessPolicy (WORKSPACE_MEMBER default)
  2. Seal.encrypt(plaintext, policyObjectId) via session
  3. Upload encrypted blob to Walrus → blobId
  4. POST /vault/secrets { policyId, blobId, metadata }

DECRYPT:
  5. GET /vault/secrets/:profileId/:key → { blobId, policyId }
  6. Download blob from Walrus
  7. Seal.decrypt(blob, policyObjectId) via session → plaintext
```

**Code changes**:

| Component | Change |
|-----------|--------|
| `lib/crypto/vault-crypto.ts` | DELETE (Web Crypto) |
| `lib/crypto/seal-crypto.ts` | NEW — Seal SDK wrapper |
| `useVaultCrypto` hook | Rewrite: policyId param, Seal session |
| `VaultItemForm` | Add policy selector |
| `VaultItemCard` | Decrypt via Seal session |
| BFF `StoreSecretDto` | Add `sealPolicyId` field |
| BFF `VaultService` | Store policyId in metadata |
| Move `crm_vault` | Wire `set_blob()` with real Seal policy ID |

**Config**: `SEAL_PACKAGE_ID`, `SEAL_KEY_SERVER_URL`
**Unlocks**: GDPR key destruction (P4-4)

### E2E Tests (Playwright)

**Architecture**: BFF `TestAuthModule` (NODE_ENV=test only) → real JWT cookies → Playwright storageState

12 tasks:
1. Install Playwright & scaffold config
2. BFF TestAuthModule (conditional `POST /auth/test-login`)
3. Global setup (auth fixture + API helper)
4. Auth guard redirect tests
5. Profiles CRUD + search + detail
6. Organizations CRUD + search + detail
7. Deals CRUD + list view + search + detail
8. Tickets CRUD + search
9. Segments list + create + detail
10. Campaigns list + create
11. Navigation sidebar + topbar + dashboard
12. Full suite run & selector fixup

**Selector strategy**: `getByRole()` > `getByText()` > `getByPlaceholder()` > `data-testid`
**Auth sync**: storageState saves cookies + Zustand `auth-storage` localStorage

---

## Phase 3 — AI, Automation & Ecosystem

**Goal**: AI agents, event-driven automation, multi-chain identity, social linking, broadcast

### Architecture

```
Indexer Webhook → WebhookService → EventEmitter2 → TriggerMatcher
                                                        |
                          +-----------------------------+
                          v                             v
                    WorkflowEngine              GasSponsorListener
                    (existing + new actions)     (balance check → Enoki)
                          |
          +---------------+---------------+
          v               v               v
    send_telegram   grant_discord_role  airdrop_token
    send_discord    issue_poap          ai_generate_content
          |
          +---> OAuth tokens from SocialLinkService (encrypted in vault)

AgentModule (LLM) → Vercel AI SDK → Claude / GPT (per workspace)
    +- AnalystAgent    +- onFinish → UsageLog (token count + cost)
    +- ContentAgent    +- API key: platform / BYOK
    +- ActionAgent     +- Rate limiter (Redis, per workspace)

BroadcastModule → ChannelAdapterRegistry → Telegram / Discord / X adapters
    +- Segment-aware template variable substitution
    +- Cron-based delayed send
```

### P3-1: LLM Integration Foundation

- `AgentModule`: LlmClientService, UsageTrackingService, RateLimitGuard, PromptTemplateService
- API key resolution: workspace BYOK (Seal-encrypted) → platform key fallback
- Prisma: `LlmUsageLog`, `WorkspaceAiConfig`
- **Files**: `packages/bff/src/agent/`

### P3-2: Journey Builder — Event Triggers

- **Depends on**: P2-1 (indexer webhook)
- Trigger types: `wallet_connected`, `nft_minted(collection)`, `token_transferred`, `defi_action(type)`, `time_elapsed`, `segment_entered/exited`
- `TriggerMatcherService`, `SegmentDiffJob`, `TimeTriggerJob`
- Condition nodes: `if engagement_score > X`, `if has_tag('whale')`, `if balance > Y`
- Prisma: `CampaignTrigger`
- Future: swap EventEmitter for BullMQ for retry + dead letter queue

### P3-3: AI Analyst Agent

- **Depends on**: P3-1, P2-2
- `POST /agents/analyst/query` → NL → Prisma query DSL (read-only) → chart config JSON
- Intent classification: segment_query | report | trend_analysis
- Frontend: chat-style query UI in Analytics page

### P3-4: Content Agent + Action Agent

- **Depends on**: P3-1
- Content: `POST /agents/content/generate` → segment + channel + tone → marketing copy
- Action: `POST /agents/action/plan` → NL → structured plan; `POST /agents/action/execute` → human review → execute
- Frontend: "AI Suggest Copy" button, Action planning wizard

### P3-5: Multi-chain Identity & Net Worth

- `EvmResolverService` (ethers.js v6, ENS), `SolanaResolverService` (@bonfida SNS)
- `BalanceAggregatorService` (Moralis/Ankr API)
- Prisma: `ProfileWallet { profileId, chain, address, ensName, snsName, verified }`
- Frontend: Profile → Wallets tab + Net Worth card

### P3-6: Social Linking

| Platform | Auth | Token Storage | Actions |
|----------|------|---------------|---------|
| Discord | OAuth2 | Seal-encrypted | grant_role, send_dm, post |
| Telegram | Bot Login Widget | Seal-encrypted | send_message |
| X | OAuth2 | Seal-encrypted | post tweet, send_dm |
| Apple | ZkLogin via Enoki | N/A | N/A |

- Prisma: `SocialLink { profileId, platform, platformUserId, oauthTokenEncrypted, verified }`

### P3-7: Workflow Actions + Playbook Templates

- **Depends on**: P3-2
- New actions: `grant_discord_role`, `issue_poap`, `ai_generate_content`
- Playbook templates: NFT Welcome, DeFi Activation, DAO Voting, Membership Tier
- `GET /templates/playbooks` + `GET /campaigns/:id/stats`

### P3-8: Gas Station (Auto-sponsor)

- **Depends on**: P2-1
- Listen `wallet_connected` / `profile_created` → check balance → Enoki sponsored mode
- Workspace config: `gasSponsorEnabled`, `gasSponsorThreshold`, `gasSponsorDailyLimit`

### P3-9: Broadcast & Social Publishing

- `BroadcastModule`: CRUD + schedule + execute
- `ChannelAdapterRegistry` → Telegram / Discord / X adapters
- Prisma: `Broadcast`, `BroadcastDelivery`
- Template variables: `{{profile.name}}`, `{{profile.walletAddress}}`, `{{profile.ensName}}`
- Frontend: `/broadcasts` — rich text editor, channel picker, segment selector, schedule, analytics
- Integration with P3-4: "AI Generate" button calls Content Agent

### P3 Wave Structure

| Wave | Items | Theme |
|------|-------|-------|
| 1 | P3-1 + P3-2 + P3-8 | Automation foundation |
| 2 | P3-3 + P3-4 | AI Agents |
| 3 | P3-5 + P3-6 | Multi-chain + Social Identity |
| 4 | P3-7 + P3-9 | Workflows + Broadcasting |

### P3 New Dependencies

| Package | Purpose |
|---------|---------|
| `ai` + `@ai-sdk/anthropic` + `@ai-sdk/openai` | Vercel AI SDK |
| `ethers` (v6) | EVM RPC + ENS |
| `@bonfida/spl-name-service` + `@solana/web3.js` | Solana SNS |
| `moralis` or `@ankr.js/core` | Multi-chain balance aggregation |

---

## Phase 4 — Advanced Features & Production

**Goal**: Escrow, Quest-to-Qualify, Lookalike audiences, GDPR, production hardening

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Escrow token | `Balance<SUI>` only v1; multi-token deferred P5 | Matches codebase pattern |
| Quest badge | SBT (no revocation v1) | SUI owned object model makes revocation impractical |
| Lookalike | K-NN cosine similarity, internal candidates | Good enough without graph data |
| GDPR | PII nullify + Seal key destroy + 30d grace | Industry standard Web3 CRM |
| Production | Cache + rate limit + observability | Minimum viable production |

### P5 Backlog

- Multi-token escrow: `Escrow<phantom T>` with `Balance<T>`
- Lookalike: Graph-based similarity + on-chain wallet discovery
- Security audit prep: SlowMist/CertiK checklist, OWASP top 10, pentest
- Quest badge revocation: receiving pattern or shared object registry

### P4-1: Escrow Smart Contract

**Move** (`packages/move/crm_escrow/`):
- `escrow.move` — Escrow shared object, state machine (CREATED→FUNDED→PARTIALLY_RELEASED→COMPLETED/REFUNDED/DISPUTED)
- `vesting.move` — VestingSchedule (LINEAR / MILESTONE), cliff, u128 intermediate math
- `arbitration.move` — ArbitrationState, per-arbitrator voting, threshold auto-execute

Entry functions: `create_escrow`, `fund_escrow`, `add_vesting`, `release`, `release_vested`, `complete_milestone`, `refund`, `raise_dispute`, `vote_on_dispute`

Guards: `assert_not_paused`, state checks, MIN_LOCK_DURATION, immutable arbitrators after FUNDED, dedup votes

Events: `EscrowCreated`, `EscrowFunded`, `EscrowReleased`, `EscrowRefunded`, `MilestoneCompleted`, `DisputeRaised`, `DisputeVoteCast`, `DisputeResolved`

**BFF**: Deal stage state machine (LEAD→QUALIFIED→PROPOSAL→NEGOTIATION→WON/LOST→CLOSED, ↔DISPUTED)

**Prisma**: `Escrow`, `VestingSchedule`, `EscrowArbitrator`, `SaftTemplate`

**Frontend**: Deal detail → Escrow tab (fund status bar, vesting timeline, actions, SAFT section)

### P4-2: Quest-to-Qualify

- **Depends on**: P2-1 (verify on-chain actions), P3-2 (trigger system)
- Move: `QuestBadge` SBT (no store = non-transferable), `QuestRegistry` dedup, Display init
- BFF: `QuestModule` — CRUD + progress tracking + hybrid verification engine (IndexerVerifier / RpcVerifier / ManualVerifier)
- Prisma: `Quest`, `QuestStep`, `QuestCompletion`, `QuestStepCompletion`
- API: `POST /quests`, `GET /quests`, `POST /quests/:id/steps/:stepId/claim`, `POST /quests/:id/complete` (mint SBT)
- Frontend: Quest Builder (admin), Quest Board (user), progress card
- Workflow integration: `assign_quest` action, `quest_completed` trigger

### P4-3: Lookalike Audiences

- Feature vector (6D): engagement_score, tx_frequency, asset_diversity, nft_count, defi_activity, dao_participation
- Flow: seed segment → centroid → cosine similarity → rank top K → optional auto-create segment
- Extensibility: `SimilarityStrategy` + `CandidateSource` interfaces (future graph-based + on-chain discovery)
- Prisma: `LookalikeResult`
- Frontend: "Find Lookalike" button → similarity histogram + radar chart + "Create Segment" CTA

### P4-4: GDPR Compliance

- **Depends on**: P2-6 (Seal key destruction)
- 30-day grace period deletion flow:
  1. `DELETE /profiles/:id/gdpr` → gdprStatus=PENDING_DELETION
  2. Profile hidden immediately
  3. After 30d (GdprCleanupJob): PII nullify, social links delete, wallet unbind, Seal key destroy, deal docs unreadable, agent logs purge, quest anonymize, segment remove
  4. Tombstone remains: `{ id, workspaceId, isDeleted, deletedAt }`
- API: `DELETE /profiles/:id/gdpr`, `GET .../gdpr/status`, `POST .../gdpr/cancel`, `GET .../export`
- Prisma: Profile additions (`gdprStatus`, `gdprScheduledAt`), `GdprDeletionLog`

### P4-5: Production Hardening

**Redis caching**:
| Key | TTL | Invalidation |
|-----|-----|-------------|
| `profile:{id}` | 5min | On update/GDPR |
| `segment:{id}:members` | 10min | On refresh |
| `workspace:{id}:settings` | 30min | On update |
| `deal:{id}` | 5min | On stage transition |

**Rate limiting** (`@nestjs/throttler`):
| Scope | Limit | Window |
|-------|-------|--------|
| Global | 100 req | 1 min |
| Auth | 10 req | 1 min |
| AI agents | 20 req | 1 min |
| GDPR export | 3 req | 10 min |

**Observability**: `nestjs-pino` (structured JSON), `@sentry/nestjs` + `@sentry/nextjs`, indexer lag monitoring
**Health**: `GET /health`, `GET /health/detailed`
**Docker**: `docker-compose.prod.yml` with resource limits, health checks

### P4 Wave Structure

| Wave | Agent A | Agent B |
|------|---------|---------|
| W1 | Move contracts (crm_escrow + quest_badge) | Prisma schema (all P4 models) |
| W2 | BFF escrow service + state machine | Frontend escrow UI |
| W3 | Quest module (BFF + verification + SBT) | Lookalike service + frontend |
| W4 | GDPR flow | Production hardening |

---

## Sprint Order

| Sprint | Items | Theme |
|--------|-------|-------|
| S1 (2w) | P2-1 Indexer + P2-6 Seal (parallel) | Foundation |
| S2 (2w) | P3-1 LLM + P3-2 Triggers + P3-8 Gas Station | Automation |
| S3 (2w) | P3-3 Analyst + P3-4 Content/Action Agent | AI Agents |
| S4 (2w) | P3-5 Multi-chain + P3-6 Social + P3-7 Playbooks | Ecosystem |
| S5 (2w) | P3-9 Broadcast + E2E Tests | Publishing + QA |
| S6 (2w) | P4-1 Escrow + P4-2 Quest | Advanced contracts |
| S7 (1w) | P4-3 Lookalike + P4-4 GDPR | Data science + Compliance |
| S8 (2w) | P4-5 Production | Ship it |

---

## Future Enhancements (deferred from P2-11)

### Bundle Size
- size-limit per-entry budgets, @next/bundle-analyzer visual treemap

### Lighthouse CI
- DB seeding for profile page audit, unlighthouse nightly scan, mobile/desktop split configs

### API Latency
- k6 ramping VU load testing, write endpoint testing, real RPC latency (remove SUI_DRY_RUN)

### Profile Page Optimization
- React Server Components, GraphQL aggregation, SSR prefetch

### Web Vitals
- TimescaleDB persistence, Grafana dashboard, @vercel/speed-insights, CI measurement

---

## Score

- P0 + P1 + P2 (done): ~64% coverage (41/69 features)
- P3 target: +16 features → ~87%
- P4 target: +6 features → ~100%
