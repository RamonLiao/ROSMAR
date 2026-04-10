# ROSMAR CRM — Manual E2E Test Plan

## Prerequisites

### Environment Setup
1. Docker services running: `docker compose up -d` (TimescaleDB + Redis)
2. BFF running: `cd packages/bff && pnpm dev` (port 3001)
3. Frontend running: `cd packages/frontend && pnpm dev` (port 3000)
4. Browser: Chrome with Sui Wallet extension installed (or Suiet/Ethos)
5. Wallet: A funded testnet wallet (need SUI for gas)
6. `.env` configured with `SUI_DRY_RUN=true` (or `false` if testing on-chain)
7. (Optional) Rust indexer running: `cd packages/indexer && cargo run` (for tests 16, 18)

### Test Data Conventions
- Use prefix `[TEST]` in names/titles for easy cleanup
- Record IDs created during testing for cross-reference
- Screenshots: save to `test/manual/screenshots/` if needed

### Test Status Legend
- [ ] Not tested
- [x] Passed
- [!] Failed (add notes)
- [-] Skipped (add reason)

## Test Files

| # | File | Scope | Est. Time |
|---|------|-------|-----------|
| 01 | [01-auth-flows.md](./01-auth-flows.md) | Login (wallet/zkLogin/passkey), logout, session refresh | 15 min |
| 02 | [02-workspace-management.md](./02-workspace-management.md) | Create/switch workspace, invite/remove members | 10 min |
| 03 | [03-deals-pipeline.md](./03-deals-pipeline.md) | CRUD, kanban drag-drop, archive, audit trail | 15 min |
| 04 | [04-profiles.md](./04-profiles.md) | CRUD, tags, wallets (multi-chain), net worth, assets, messaging | 15 min |
| 05 | [05-organizations.md](./05-organizations.md) | CRUD, link/unlink profiles | 10 min |
| 06 | [06-segments.md](./06-segments.md) | Create with rules, refresh, member list | 10 min |
| 07 | [07-campaigns.md](./07-campaigns.md) | CRUD, workflow builder (ReactFlow canvas), start/pause | 15 min |
| 08 | [08-tickets.md](./08-tickets.md) | CRUD, status/priority, SLA | 10 min |
| 09 | [09-vault.md](./09-vault.md) | Seal policy selection, encrypt/store/retrieve notes, file upload | 15 min |
| 10 | [10-navigation-ui.md](./10-navigation-ui.md) | Sidebar, topbar, search, notifications, analytics | 10 min |
| 11 | [11-social-linking.md](./11-social-linking.md) | Discord/X/Telegram/Apple OAuth linking & unlinking | 10 min |
| 12 | [12-ai-agents.md](./12-ai-agents.md) | Analyst (NL query), Content (copy gen), Action (airdrop plan), Yield Optimizer (stub) | 15 min |
| 13 | [13-quest-system.md](./13-quest-system.md) | Quest CRUD, steps, claim, badge minting | 10 min |
| 14 | [14-escrow-deals.md](./14-escrow-deals.md) | Escrow (fund/release/dispute), SAFT templates, deal documents | 15 min |
| 15 | [15-broadcasts.md](./15-broadcasts.md) | Create/edit/send/schedule broadcasts, channel picker, analytics | 10 min |
| 16 | [16-whale-alerts.md](./16-whale-alerts.md) | Threshold config, alert list, top whale profiles | 10 min |
| 17 | [17-gas-station.md](./17-gas-station.md) | Gas config settings, sponsored transaction flow | 10 min |
| 18 | [18-indexer-webhook.md](./18-indexer-webhook.md) | Indexer pipeline, webhook HMAC, event fan-out, auto-tag | 15 min |
| 19 | [19-gdpr.md](./19-gdpr.md) | GDPR data export, deletion, cancellation, rate limiting | 10 min |
| 20 | [20-engagement-weights.md](./20-engagement-weights.md) | Engagement score weight sliders, reset defaults, score impact | 10 min |

**Total estimated time: ~230 min**

## Execution Order

Recommended order (each test may depend on data from previous):
1. Auth flows (01) — must pass first, everything needs login
2. Workspace (02) — workspace context needed for all CRUD
3. Profiles (04) — profiles needed for deals, segments, vault
4. Organizations (05) — can link profiles created in 04
5. Social linking (11) — uses profiles from 04
6. Deals (03) — needs profiles from 04
7. Escrow & documents (14) — needs deals from 03
8. Segments (06) — needs profiles from 04
9. Campaigns (07) — needs segments from 06
10. Broadcasts (15) — independent, but richer with segments from 06
11. AI agents (12) — needs data from 03, 04, 06 for meaningful queries
12. Quests (13) — needs profiles from 04
13. Tickets (08) — independent
14. Vault (09) — needs profiles from 04, tests Seal policy creation
15. Whale alerts (16) — needs workspace from 02, richer with indexer data
16. Gas station (17) — needs workspace from 02
17. Engagement weights (20) — needs workspace from 02, profiles from 04
18. GDPR (19) — needs a profile to delete (create a throwaway in 04)
19. Indexer & webhook (18) — needs indexer binary + BFF running
20. Navigation/UI (10) — best tested last with data populated

## Not Yet Testable (Pending Implementation)

| Feature | Status |
|---------|--------|
| SuiNS (`.sui`) resolution | Stub — returns `null` |
| HD wallet auto-merge | Not implemented |
| SUI USD price oracle | Hardcoded `$0` |
| NFT gallery images/metadata | Count only, no thumbnails |
| Segment rule evaluation (gRPC) | Stub returns `{}` |
| BullMQ job scheduling (score recalc, SLA checker, Discord role sync) | Jobs exist but may not be fully wired |
| Journey delay steps | Field exists, not honored |
| Lookalike audiences UI | Components exist, not wired to page |
| Deal room access gate (Seal) | No wallet check before view |
| Deal Won → escrow release | No event listener |
| On-chain time-lock | Server-side only (job not scheduled) |
