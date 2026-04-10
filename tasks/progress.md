# ROSMAR CRM — Progress

## Current Task
None — P2-1 Rust Indexer complete, awaiting next task

## TODO

### S1: Foundation — IN PROGRESS
- [x] P2-6: Seal SDK UI gaps (fast track) ✅ (2026-04-10)
- [x] **P2-1: Rust Indexer** ✅ (2026-04-10) — all 12 tasks executed
- [ ] E2E Tests (Playwright) — 12 tasks, not started

### S2: Automation — COMPLETE ✅

### S3–S8: See `docs/plans/roadmap.md`

## Recently Completed
- [2026-04-10] **P2-1 Rust Indexer** (12 tasks):
  - T1: Config cleanup — removed sui_rpc_url/poll_interval_ms/checkpoint_batch_size/whale_alert_threshold_usd, added checkpoint_store_url/webhook_hmac_secret/enricher_cache_ttl_secs
  - T2: Cache TTL — AddressCache now stores (profile_id, workspace_id) with configurable TTL
  - T3: Enricher — resolve_full() returns (profile_id, workspace_id) tuple
  - T4: AlertEngine — pure logic, no PgPool, receives enrichment from Router
  - T5: BatchWriter — added profile_id/workspace_id to BatchEvent and INSERT
  - T6: Webhook HMAC — HMAC-SHA256 signing with x-webhook-signature header
  - T7: Router — pipeline reorder: Handler→Enrich→Write→Alert→Webhook
  - T8: Consumer — migrated to sui-data-ingestion-core Worker trait (NOT sui-indexer-alt-framework)
  - T9-11: BFF — Redis idempotency in WebhookService, rawBody for HMAC guard, .env.example
  - T12: Verification — cargo check ✅, 16 tests pass, tsc ✅, 359 BFF tests pass
  - **Key discovery**: sui-indexer-alt-framework requires diesel+Handler trait, wrong fit. Used sui-data-ingestion-core (simpler Worker trait + setup_single_workflow)
  - **Key discovery**: SUI repo branch is `main` not `mainline`
- [2026-04-10] **P2-6 Seal SDK gaps (fast track)**: Wired `PolicySelector` + `useCreatePolicy` into `encrypted-note-editor.tsx` and `file-uploader.tsx`. Replaced cosmetic Select with real on-chain policy creation. 0 TS errors.
- [2026-04-10] **P2-1 Design Spec**: `docs/superpowers/specs/2026-04-10-p2-1-rust-indexer-design.md`
  - Consumer: JSON-RPC → `sui-indexer-alt-framework` (Protocol 119, `Processor` trait, `CheckpointEnvelope`, adaptive concurrency)
  - Fix BatchWriter profile_id/workspace_id, Enricher TTL, AlertEngine dedup, dead code cleanup
  - HMAC-SHA256 webhook signing (indexer→BFF)
  - BFF webhook receiver: HMAC guard + Redis idempotency + EventEmitter2
- [2026-04-10] **P2-1 Implementation Plan**: `docs/superpowers/plans/2026-04-10-p2-1-rust-indexer.md`
  - 12 tasks, T2-T6 parallelizable, T9 parallel with T7/T8
  - Reviewed by sui-architect (caught JSON-RPC deprecation) + sui-indexer (corrected crate/API)
- [2026-04-09] **Tech debt cleanup**: Fixed all pre-existing test failures (5 suites/8 tests) and TS errors (5). Commit `7a39de8`.
- [2026-04-09] **P3 Gap Execution**: 13 tasks across 6 waves, 14 commits

## Blockers
None

## Notes
- **Codebase health**: 0 TS errors, 51 suites / 359 tests all passing, 16 Rust tests passing, 14 Prisma migrations synced
- **Corrected discovery**: JSON-RPC deprecated — indexer now uses `sui-data-ingestion-core` `Worker` trait + `setup_single_workflow`. `sui-indexer-alt-framework` requires diesel/Handler/Store — wrong fit for custom sqlx pipeline.
- **API notes**: `Worker` trait (process_checkpoint), `CheckpointData`, git branch `main` (not `mainline`)
- **P2-6 was mostly done**: Seal SDK migration already complete at lib/hook/BFF/Move layers. Only UI wiring gaps remained.
- **BFF `WebhookModule`**: import exists in `app.module.ts` but module files don't exist yet — creating them in P2-1 Task 10 will fix the broken import
- **Future work recorded**: (B) engagement score from indexer events, (C) whale alert push notifications
- 完整部署資訊見 `tasks/notes.md`
