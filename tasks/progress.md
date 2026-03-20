# ROSMAR CRM — Progress

## Current Task
S1 Foundation Sprint — P2-1 Tasks 1-8 and P2-6 Tasks 1-3.6 complete. Remaining: P2-1 Task 9 (integration tests), P2-6 Tasks 4-6 (interactive deploy).

## TODO

### S1: Foundation (in progress)
- [x] P2-1: Rust Indexer pipeline wiring — Tasks 1-8 complete (9 commits + 1 review fix)
  - [ ] P2-1 Task 9: Integration tests (needs DATABASE_URL)
- [x] P2-6: Seal SDK integration — Tasks 1-3.6 complete (6 commits + 1 review fix)
  - [ ] P2-6 Tasks 4-6: Interactive deploy (devnet → testnet, needs user confirmation)
  - [ ] P2-6 Task 5: Deal room auto-policy (VERIFY only)
- [x] E2E: Playwright test suite — all 12 tasks implemented, validation only (run + fix flakiness)

### S2: Automation
- [ ] P3-1: LLM Integration Foundation (AgentModule, Vercel AI SDK)
- [ ] P3-2: Journey Builder event triggers
- [ ] P3-8: Gas Station auto-sponsor

### S3–S8: See `docs/plans/roadmap.md`

## Recently Completed
- [2026-03-20] **P2-1 Tasks 1-8 merged to main**: Dead-letter migration + CRUD, RetryManager, handlers return WalletEvent, BatchWriter multi-row INSERT, WebhookDispatcher retry + dead-letter, AlertEngine returns WhaleAlert, Router queues to BatchWriter, CLI with clap (run/replay). Code review: fixed whale_alert profile_id, batch_tx error propagation, audit log warning, removed dead dispatch(). 12 tests pass.
- [2026-03-20] **P2-6 Tasks 1-3.6 merged to main**: Deleted vault-crypto.ts, PolicySelector two-layer UI + TTL, VaultItemCard 30s auto-clear, expiresAtMs wiring, buildSealApproveTx workspace+clock fix. Code review: fixed workspaceId (DB UUID → suiObjectId), fixed encryptedObjectIds (parse from EncryptedObject). tsc --noEmit zero errors.
- [2026-03-20] **S1 brainstorming + spec + plans**: Design spec reviewed (2 review iterations), 2 implementation plans written and reviewed.
- [2026-03-20] **PR #1 merged to main**: P2-11 performance SLA + S0 feature bundle.

## Blockers
- P2-1 Task 9 blocks full P2-1 completion (integration tests need Postgres)
- P2-6 Tasks 4-6 block P4-4 (GDPR needs Seal key destruction, needs devnet/testnet deploy)

## Notes
- Prisma migration created but not applied (run `cd packages/bff && npx prisma migrate dev`)
- 5 test suites have pre-existing ESM/CJS import failures (social-link, gdpr, deal-document, whale-alert, profile-assets)
- `@mysten/enoki` Apple provider: runtime cast workaround
- Consolidated roadmap: `docs/plans/roadmap.md` (P2 remaining → P3 → P4 → future)
- P2-10 smart contract audit: external engagement, not code
- E2E Playwright: 8 spec files ready, run with `cd packages/frontend && NODE_ENV=test pnpm e2e`
- Deal room auto-policy (Task 5) already implemented in `deal-document.service.ts` — VERIFY only
- P2-6 review note: `suiObjectId` is nullable — dry-run workspaces will fail Seal ops (expected)
- P2-6 review note: `verifyKeyServers: false` must be `true` for mainnet
- P2-1 review note: backoff 無 jitter (single instance OK, scale 前要加)
- P2-1 review note: `whale_alert_threshold_usd` config 已宣告但未實作
