# ROSMAR CRM — Progress

## Current Task
P3 Wave 1 complete (T1-T10 merged). Ready for Wave 2.

## TODO

### P3 — AI, Automation & Ecosystem (35 tasks, 4 waves)

#### Wave 1: Automation Foundation (T1-T11)
- [x] **T1**: Prisma schema — P3 models (LLM, triggers, wallets, social, broadcast)
- [x] **T2**: Install P3 deps (ai sdk, ethers, solana)
- [x] **T3**: P3-1 LlmClientService — API key resolution + provider setup
- [x] **T4**: P3-1 UsageTrackingService
- [x] **T5**: P3-1 Agent settings API + frontend
- [x] **T6**: P3-2 TriggerMatcherService — event listener
- [x] **T7**: P3-2 SegmentDiffJob — segment_entered/exited
- [x] **T8**: P3-2 Campaign trigger CRUD API + frontend
- [x] **T9**: P3-8 GasSponsorListener
- [x] **T10**: P3-8 Gas station workspace settings UI
- [x] **T11**: Wave 1 integration test + tsc check (merge verified)

#### Wave 2: AI Agents (T12-T17)
- [ ] **T12**: P3-3 AnalystAgent — NL to Prisma query
- [ ] **T13**: P3-3 Analyst frontend — chat-style query UI
- [ ] **T14**: P3-4 ContentAgent
- [ ] **T15**: P3-4 ActionAgent — plan + execute
- [ ] **T16**: P3-4 Frontend — AI buttons in campaign + broadcast
- [ ] **T17**: Wave 2 integration test + tsc check

#### Wave 3: Multi-chain + Social Identity (T18-T25)
- [ ] **T18**: P3-5 EvmResolverService — ENS lookup
- [ ] **T19**: P3-5 SolanaResolverService — SNS lookup
- [ ] **T20**: P3-5 BalanceAggregatorService — multi-chain balances
- [ ] **T21**: P3-5 Profile wallets API + frontend
- [ ] **T22**: P3-6 SocialLinkService — Discord OAuth2
- [ ] **T23**: P3-6 Telegram + X + Apple linking
- [ ] **T24**: P3-6 Social tab frontend
- [ ] **T25**: Wave 3 integration test + tsc check

#### Wave 4: Workflows + Broadcasting (T26-T33)
- [ ] **T26**: P3-7 New workflow actions (discord role, POAP, AI content)
- [ ] **T27**: P3-7 Playbook templates API + picker UI
- [ ] **T28**: P3-7 Campaign stats endpoint + UI
- [ ] **T29**: P3-9 BroadcastModule — service + controller
- [ ] **T30**: P3-9 Channel adapters (Telegram, Discord, X)
- [ ] **T31**: P3-9 Broadcast scheduling job
- [ ] **T32**: P3-9 Broadcast frontend — page + editor
- [ ] **T33**: Wave 4 integration test + tsc check

#### Final
- [ ] **T34**: Full test suite + final tsc check
- [ ] **T35**: Update progress + commit

### P4+ Backlog
- [ ] **P4-1**: Escrow smart contract
- [ ] **P4-2**: Quest-to-Qualify (Q3)
- [ ] **P4-3**: Lookalike Audiences
- [ ] **P4-4**: GDPR compliance
- [ ] **P4-5**: Production hardening
- [ ] Prisma migration (run when DB is available)

## Recently Completed (2026-03-07)

### P3 Wave 1: Automation Foundation (11/11 tasks)
- **T1-T2**: Prisma P3 schema (8 new models) + deps (ai sdk, ethers, solana)
- **T3-T5** (P3-1): LlmClientService (BYOK + platform fallback + quota) + UsageTrackingService + AI settings API/UI
- **T6-T8** (P3-2): TriggerMatcherService + SegmentDiffJob + trigger CRUD API/UI
- **T9-T10** (P3-8): GasSponsorListener + gas station settings UI
- **T11**: Merge + integration verify
- BFF: 15 test suites, 46 tests pass | Frontend: 19 suites, 92 tests pass
- Merge: 1 settings page conflict (AI config + gas station) + 1 duplicate schema model resolved

### P2 Wave 1: Data Foundation (10/10 tasks)
- **T0**: Prisma migration — WalletEvent + EngagementSnapshot models
- **T1-T3** (P2-5): Auto-tag classifier + webhook listener + frontend badges
- **T4-T6** (P2-2): Engagement score calculator + batch job + weight settings UI
- **T7-T8** (P2-3): Whale alert webhook handler + notification center
- **T9-T10** (P2-4): Profile assets + timeline endpoints + frontend gallery
- BFF: 6 new test suites, 12 tests | Frontend: 4 new suites, 11 tests

### Wave 2: Security & Collaboration (8/8 tasks)
- **T1** (P2-7): VaultSecret.expiresAt + VaultAccessLog + DealDocument schema
- **T2** (P2-7): Vault policy enforcement (3 rule types) + access logging
- **T3** (P2-7): Vault time-lock + expiry archival cron job
- **T4** (P2-7): Frontend policy selector + time-lock date picker
- **T5** (P2-7): Vault audit log endpoint + UI
- **T6-T7** (P2-8): DealDocumentService with Walrus upload + Seal policy
- **T8** (P2-8): Frontend deal documents tab with encrypted upload
- BFF: 4 new test suites, 18 tests | Frontend: vault components updated

### Merge & Integration
- Resolved 24 merge conflicts across 2 waves
- Fixed 15 TS errors from API mismatches between waves
- Final: BFF tsc clean, Frontend tsc clean, 30 BFF tests pass, 92 frontend tests pass

### Previous S2 Completions
- **P2-1 Rust Indexer** (8/8 tasks): Full pipeline wired
- **P2-6 Seal SDK** (11/11 tasks): Web Crypto → Seal SDK

## Blockers
None

## Notes
- P3 design doc: `docs/plans/2026-03-07-p3-design.md`
- P3 implementation plan: `docs/plans/2026-03-07-p3-implementation.md`
- P3-9 (Broadcast) is new scope added during design (not in original roadmap)
- LLM billing: hybrid model (platform quota + BYOK), Vercel AI SDK
- Event triggers: EventEmitter2 (real-time) + cron (time-based). Future: BullMQ upgrade
- Multi-chain: ENS/SNS via direct RPC, balance via Moralis/Ankr aggregator, Sui via gRPC
- Social OAuth: all 4 platforms (Discord, Telegram, X, Apple), tokens Seal-encrypted
- Worktree merge lesson confirmed: always `pnpm install` after merge
- All P2 features (P2-1 through P2-8) complete

## Phase 1 Status (complete)
Move 36/36 tests | BFF all domains | Frontend 81→92 tests | E2E 39 tests | Auth (wallet/zkLogin/passkey)

## Key References
- Roadmap: `docs/plans/2026-03-07-phase2-4-roadmap.md`
- Spec: `specs/crm_spec_v1.md`
- Wave 1 plan: `docs/plans/2026-03-07-wave1-data-foundation.md`
- Wave 2 plan: `docs/plans/2026-03-07-wave2-security-collaboration.md`
