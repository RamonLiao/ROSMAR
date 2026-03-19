# ROSMAR CRM — Progress

## Current Task
None — ready for next phase.

## TODO

### S1: Foundation (next sprint, parallel)
- [ ] P2-1: Rust Indexer pipeline wiring (Consumer→Router→Enricher→AlertEngine→Webhook)
- [ ] P2-6: Seal SDK integration (replace Web Crypto, policy-based encrypt/decrypt)
- [ ] E2E: Playwright test suite (12 tasks, independent of P2-1/P2-6)

### S2: Automation
- [ ] P3-1: LLM Integration Foundation (AgentModule, Vercel AI SDK)
- [ ] P3-2: Journey Builder event triggers
- [ ] P3-8: Gas Station auto-sponsor

### S3–S8: See `docs/plans/roadmap.md`

## Recently Completed
- [2026-03-16] **Docs cleanup**: Deleted 26 old docs, consolidated into single `docs/plans/roadmap.md`
- [2026-03-15] **P2 all code tasks complete** (P2-1 through P2-11, excluding P2-1 indexer & P2-6 Seal)

## Blockers
- P2-1 blocks P3-2 (Journey triggers need indexer webhook)
- P2-6 blocks P4-4 (GDPR needs Seal key destruction)

## Notes
- Pending Prisma migrations (run `cd packages/bff && npx prisma migrate dev`)
- 5 test suites have pre-existing ESM/CJS import failures (social-link, gdpr, deal-document, whale-alert, profile-assets)
- `@mysten/enoki` Apple provider: runtime cast workaround
- Consolidated roadmap: `docs/plans/roadmap.md` (P2 remaining → P3 → P4 → future)
- P2-10 smart contract audit: external engagement, not code
