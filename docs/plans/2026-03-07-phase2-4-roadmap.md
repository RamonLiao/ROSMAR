# ROSMAR CRM — Phase 2-4 Implementation Roadmap

**Date**: 2026-03-07
**Baseline**: Phase 1 MVP complete (21/69 features, 6 partial)
**Goal**: Full spec v1 coverage across Phase 2 → 3 → 4

---

## Dependency Graph (read top-down)

```
Rust Indexer ─────┬─> Engagement Score Calc ──> Auto-tagging
(event pipeline)  ├─> Governance Handler      ──> DAO features
                  ├─> Whale Alert dispatch    ──> Notification center
                  ├─> Asset/Timeline data     ──> 360 Asset View
                  └─> Event Triggers          ──> Journey Builder triggers

Seal SDK ─────────┬─> Vault ACL wiring
                  ├─> Deal Room encrypted docs
                  └─> Time-lock / auto-destroy

Multi-chain RPC ──┬─> EVM/Solana balance
                  ├─> ENS/SNS resolution
                  └─> Cross-chain Net Worth

LLM Integration ──┬─> AI Analyst Agent
                  ├─> Content Agent
                  └─> Action Agent planning
```

---

## Phase 2 — Data Layer & Core Differentiation

> Focus: 讓鏈上資料真正流進 CRM，點亮 360 view + engagement + whale

### P2-1: Rust Indexer 完成 [CRITICAL PATH]
- **Depends on**: TimescaleDB (already in Docker compose)
- **Unlocks**: P2-2, P2-3, P2-4, P2-5, P3-2
- **Scope**:
  - [ ] 完成 `Indexer.start_indexing()` — checkpoint consumer → handler dispatch
  - [ ] Wire `handle_nft_event()` + `handle_defi_event()` 到 DB writes
  - [ ] 新增 `handle_governance_event()` (DAO proposal vote)
  - [ ] Webhook POST to BFF `/webhook/indexer-event` (取代 placeholder)
  - [ ] Integration test: mock checkpoint → DB row 驗證
- **Files**: `packages/indexer/src/`
- **Est. complexity**: High

### P2-2: Engagement Score Calculation
- **Depends on**: P2-1 (events in DB)
- **Scope**:
  - [ ] Rust Core service: `calculate_engagement(profile_id)` — 讀 `wallet_events` 算分
  - [ ] Default weight formula: `hold_time * 0.3 + tx_count * 0.2 + tx_value * 0.2 + vote_count * 0.2 + nft_count * 0.1`
  - [ ] Workspace-level weight config (BFF API: `PUT /settings/engagement-weights`)
  - [ ] 排程: 每小時 batch recalculate → 寫入 `engagement_snapshots`
  - [ ] 前端: Settings 頁新增 weight 設定 UI
- **Files**: `packages/indexer/`, `packages/bff/src/analytics/`

### P2-3: Whale Alert Notification Dispatch
- **Depends on**: P2-1 (webhook delivery)
- **Scope**:
  - [ ] BFF `POST /webhook/whale-alert` handler
  - [ ] 建 `Notification` Prisma model (recipient, type, payload, read)
  - [ ] Notification center UI (header bell icon + dropdown)
  - [ ] Optional: Telegram/Email push (reuse existing messaging services)
  - [ ] 前端: Workspace settings 可自訂 whale threshold
- **Files**: `packages/bff/src/notification/`, frontend notification components

### P2-4: 360 Asset View — Data Pipeline
- **Depends on**: P2-1 (NFT/DeFi events indexed)
- **Scope**:
  - [ ] BFF `GET /profiles/:id/assets` — query indexed NFTs + token balances
  - [ ] BFF `GET /profiles/:id/timeline` — query `wallet_events` by profile
  - [ ] Wire `AssetGallery` + `ProfileTimeline` to real API (replace `[]`)
  - [ ] NFT metadata fetch (Sui `getObject` → display_fields)
- **Files**: `packages/bff/src/profile/`, frontend profile page

### P2-5: Auto-tagging Pipeline
- **Depends on**: P2-2 (engagement scores), P2-1 (event types)
- **Scope**:
  - [ ] Rule-based classifier: NFT Collector (>5 NFTs), DeFi Power User (>10 swaps/month), DAO Voter (>3 votes)
  - [ ] Batch job: recalculate tags alongside engagement scores
  - [ ] BFF: auto-update `profile.tags` on recalc
  - [ ] 前端: tag 顯示已有，只需確保 auto-tags 有 visual distinction
- **Files**: `packages/bff/src/profile/`, indexer batch job

### P2-6: Seal SDK Integration [CRITICAL PATH]
- **Depends on**: None (parallel with P2-1)
- **Unlocks**: P2-7, P2-8, P3-5
- **Scope**:
  - [ ] 整合 `@aspect-build/seal-sdk` (or Seal WASM client)
  - [ ] Replace Web Crypto AES-GCM with Seal encrypt/decrypt flow
  - [ ] TEE key-server config (Seal allowlist endpoint)
  - [ ] Wire `crm_vault::policy` (已有 Move module) 到 Seal policy verification
  - [ ] 更新 `useVaultCrypto` hook 改用 Seal
- **Files**: `packages/frontend/src/lib/crypto/`, `packages/bff/src/vault/`

### P2-7: Vault Granular ACL + Time-lock
- **Depends on**: P2-6 (Seal)
- **Scope**:
  - [ ] Wire existing Move `acl` + `policy` modules → BFF vault access checks
  - [ ] `vault.seal_policy_id` population on create
  - [ ] Per-item ACL UI: choose WORKSPACE_MEMBER / SPECIFIC_ADDRESS / ROLE_BASED
  - [ ] Time-lock: add `expires_at` to VaultSecret, cron job to archive expired
  - [ ] Vault audit log: `vault_access_log` table + `GET /vault/:id/audit`
- **Files**: Move `crm_vault/`, BFF vault service, frontend vault components

### P2-8: Deal Room (Encrypted Docs)
- **Depends on**: P2-6 (Seal), existing Deal CRUD
- **Scope**:
  - [ ] `DealDocument` Prisma model (deal_id, walrus_blob_id, seal_policy_id, uploaded_by)
  - [ ] BFF: `POST /deals/:id/documents`, `GET /deals/:id/documents`
  - [ ] Seal policy: only deal creator + assigned profile wallets can decrypt
  - [ ] Frontend: Deal detail → Documents tab with upload/decrypt/download
  - [ ] Access-gated: 403 if wallet not in deal's ACL
- **Files**: `packages/bff/src/deal/`, frontend deal detail page

---

## Phase 3 — AI, Automation & Ecosystem

> Focus: AI agents, event-driven workflows, 多鏈 + social linking

### P3-1: LLM Integration Foundation
- **Depends on**: None
- **Unlocks**: P3-3, P3-4
- **Scope**:
  - [ ] Install `@anthropic-ai/sdk` (or `@ai-sdk/openai`)
  - [ ] BFF `AgentModule` with shared LLM client service
  - [ ] Prompt templates + response parsing utilities
  - [ ] Rate limiting + cost tracking middleware
- **Files**: `packages/bff/src/agent/`

### P3-2: Journey Builder — Event Triggers
- **Depends on**: P2-1 (indexer webhook to BFF)
- **Scope**:
  - [ ] Trigger system: `wallet_connected`, `nft_minted(collection)`, `token_transferred`, `time_elapsed`
  - [ ] `segment_entered` / `segment_exited` triggers (on refreshSegment membership diff)
  - [ ] BFF event bus: indexer webhook → match active campaign triggers → start workflow
  - [ ] Conditional nodes in workflow engine (`if engagement_score > X then ...`)
  - [ ] Frontend: trigger node type in workflow canvas + condition node
- **Files**: `packages/bff/src/campaign/`, workflow engine, frontend canvas

### P3-3: AI Analyst Agent
- **Depends on**: P3-1, P2-2 (engagement data)
- **Scope**:
  - [ ] `POST /agents/analyst/query` — NL → SQL/DSL → results
  - [ ] Intent classification: segment query / report / trend analysis
  - [ ] Auto-generate chart config (score distribution, funnel, heatmap)
  - [ ] Frontend: chat-style query UI in Analytics page
- **Files**: `packages/bff/src/agent/analyst/`

### P3-4: Content Agent + Action Agent Planning
- **Depends on**: P3-1
- **Scope**:
  - [ ] `POST /agents/content/generate` — segment + channel + tone → marketing copy
  - [ ] `POST /agents/action/plan` — NL → target segment + action plan + cost estimate
  - [ ] `POST /agents/action/execute` — execute planned action after human review
  - [ ] Frontend: Campaign create → "AI suggest copy" button
  - [ ] Frontend: Action planning wizard
- **Files**: `packages/bff/src/agent/content/`, `packages/bff/src/agent/action/`

### P3-5: Multi-chain Identity & Net Worth
- **Depends on**: P2-6 (Seal for cross-chain proof, optional)
- **Scope**:
  - [ ] BFF wallet binding API: `POST /profiles/:id/wallets`, `GET /profiles/:id/wallets`
  - [ ] Frontend: Profile detail → Wallets tab (add/remove EVM/Solana addresses)
  - [ ] ENS resolution service (ethers.js `provider.lookupAddress`)
  - [ ] SNS resolution service (Solana `@bonfida/spl-name-service`)
  - [ ] Cross-chain balance aggregation: Sui RPC + EVM RPC + Solana RPC
  - [ ] Price oracle (CoinGecko/DeFiLlama API) → Net Worth card
  - [ ] HD wallet auto-detect: compare derivation paths (nice-to-have)
- **Files**: `packages/bff/src/profile/`, `packages/bff/src/blockchain/`

### P3-6: Social Linking
- **Depends on**: None
- **Scope**:
  - [ ] Profile update API: add `telegramChatId`, `discordWebhookUrl`, `twitterHandle` fields
  - [ ] Frontend: Profile detail → Social tab with link/unlink UI
  - [ ] ZkLogin Apple provider (Enoki config)
  - [ ] OAuth callback → auto-create/link Profile option
- **Files**: `packages/bff/src/profile/`, `packages/bff/src/auth/`, frontend profile page

### P3-7: Workflow Actions + Playbook Templates
- **Depends on**: P3-2 (trigger system)
- **Scope**:
  - [ ] New actions: `grant_discord_role`, `issue_poap`
  - [ ] Playbook templates: NFT Welcome, DeFi Activation, DAO Voting, Membership Tier
  - [ ] `GET /templates/playbooks` + template picker UI
  - [ ] Flow monitoring: `GET /campaigns/:id/stats` (entry count, conversion, per-node metrics)
- **Files**: `packages/bff/src/campaign/workflow/actions/`, `packages/bff/src/campaign/template/`

### P3-8: Gas Station (Auto-sponsor)
- **Depends on**: P2-1 (detect low-balance users)
- **Scope**:
  - [ ] Background job: scan new profiles with balance < threshold
  - [ ] Auto-sponsor via Enoki (existing sponsor service)
  - [ ] Config: enable/disable per workspace, threshold amount
  - [ ] Notification: "Gas sponsored for {profile}" log
- **Files**: `packages/bff/src/blockchain/sponsor*`

---

## Phase 4 — Advanced Features & Production

> Focus: Escrow, Quest, Lookalike, 合規, 生產部署

### P4-1: Escrow Smart Contract
- **Depends on**: Deal CRUD (done)
- **Scope**:
  - [ ] Move `crm_escrow` module: `create_escrow`, `fund_escrow`, `release_on_won`, `refund_on_lost`
  - [ ] BFF: wire deal stage transition → escrow state machine
  - [ ] Frontend: Deal detail → Escrow tab (fund, status, release)
  - [ ] Token Vesting terms struct in Move (cliff, duration, amount)
  - [ ] SAFT template CRUD (BFF + UI)
- **Files**: `packages/move/crm_escrow/`, `packages/bff/src/deal/`

### P4-2: Quest-to-Qualify (Q3)
- **Depends on**: P2-1 (verify on-chain actions), P3-2 (trigger system)
- **Scope**:
  - [ ] Prisma: `Quest`, `QuestStep`, `QuestCompletion` models
  - [ ] BFF: `QuestModule` — CRUD + progress tracking + verification
  - [ ] Move: optional on-chain quest completion proof (SBT/badge)
  - [ ] Frontend: Quest builder (admin) + Quest board (user-facing)
  - [ ] Verification: indexer events confirm Swap/Stake/Vote completed
- **Files**: `packages/bff/src/quest/`, frontend quest pages

### P4-3: Lookalike Audiences
- **Depends on**: P2-2 (engagement), P2-5 (tags), P2-1 (behavioral data)
- **Scope**:
  - [ ] Feature vector: engagement score + tag set + tx frequency + asset categories
  - [ ] Similarity algorithm (cosine similarity or k-NN on feature vectors)
  - [ ] BFF: `POST /segments/:id/lookalike` → generate similar wallet list
  - [ ] Frontend: Segment detail → "Find Lookalike" button
- **Files**: `packages/bff/src/segment/`

### P4-4: GDPR Compliance
- **Depends on**: P2-6 (Seal)
- **Scope**:
  - [ ] "Right to be Forgotten": destroy Seal decryption key → data unrecoverable
  - [ ] BFF: `DELETE /profiles/:id/gdpr` — archive profile + destroy keys
  - [ ] Audit trail: log deletion request + execution
  - [ ] Data export: `GET /profiles/:id/export` (GDPR data portability)
- **Files**: `packages/bff/src/profile/`, Seal key management

### P4-5: Production Hardening
- **Depends on**: All above
- **Scope**:
  - [ ] Docker compose production setup (existing TODO)
  - [ ] Prisma migration execution
  - [ ] Smart contract audit prep (SlowMist/CertiK checklist)
  - [ ] Performance: profile page < 1s with cache layer (Redis)
  - [ ] Monitoring: error tracking, uptime, indexer lag dashboard
  - [ ] Rate limiting on all public endpoints
- **Files**: `docker-compose.prod.yml`, `packages/bff/src/common/`

---

## Implementation Priority Matrix

```
          High Impact
              |
   P2-1      |  P2-6       P3-2
  Indexer     | Seal     Triggers
              |
Low ──────────┼────────────── High Effort
              |
   P2-3      |  P3-5        P4-1
  Whale      | Multi-chain  Escrow
  Notify     |
              |
          Low Impact
```

## Recommended Sprint Order

| Sprint | Items | Theme |
|--------|-------|-------|
| S1 (2w) | P2-1 Indexer + P2-6 Seal (parallel) | Foundation |
| S2 (2w) | P2-2 Engagement + P2-3 Whale + P2-4 Assets | Data flows live |
| S3 (1w) | P2-5 Auto-tag + P2-7 Vault ACL | Intelligence layer |
| S4 (2w) | P2-8 Deal Room + P3-6 Social Linking | Identity + Deals |
| S5 (2w) | P3-1 LLM + P3-2 Triggers + P3-8 Gas Station | Automation |
| S6 (2w) | P3-3 Analyst + P3-4 Content/Action Agent | AI Agents |
| S7 (2w) | P3-5 Multi-chain + P3-7 Playbooks | Ecosystem |
| S8 (2w) | P4-1 Escrow + P4-2 Quest | Advanced contracts |
| S9 (1w) | P4-3 Lookalike + P4-4 GDPR | Data science + Compliance |
| S10 (2w) | P4-5 Production | Ship it |

---

## Score: 69 Features Total

- Phase 1 (done): 21 complete + 6 partial = **~35% coverage**
- Phase 2 target: +20 features → **~64%**
- Phase 3 target: +16 features → **~87%**
- Phase 4 target: +6 features → **~100%**
