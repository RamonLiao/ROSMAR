# ROSMAR CRM — Manual E2E Test Plan

## Prerequisites

### Environment Setup
1. Docker services running: `docker compose up -d` (TimescaleDB + Redis)
2. BFF running: `cd packages/bff && pnpm dev` (port 3001)
3. Frontend running: `cd packages/frontend && pnpm dev` (port 3000)
4. Browser: Chrome with Sui Wallet extension installed (or Suiet/Ethos)
5. Wallet: A funded testnet wallet (need SUI for gas)
6. `.env` configured with `SUI_DRY_RUN=true` (or `false` if testing on-chain)

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
| 04 | [04-profiles.md](./04-profiles.md) | CRUD, tags, detail page, messaging | 10 min |
| 05 | [05-organizations.md](./05-organizations.md) | CRUD, link/unlink profiles | 10 min |
| 06 | [06-segments.md](./06-segments.md) | Create with rules, refresh, member list | 10 min |
| 07 | [07-campaigns.md](./07-campaigns.md) | CRUD, workflow steps, start/pause | 10 min |
| 08 | [08-tickets.md](./08-tickets.md) | CRUD, status/priority, SLA | 10 min |
| 09 | [09-vault.md](./09-vault.md) | Encrypt/store/retrieve notes, file upload | 10 min |
| 10 | [10-navigation-ui.md](./10-navigation-ui.md) | Sidebar, topbar, search, notifications, analytics | 10 min |

**Total estimated time: ~110 min**

## Execution Order

Recommended order (each test may depend on data from previous):
1. Auth flows (01) — must pass first, everything needs login
2. Workspace (02) — workspace context needed for all CRUD
3. Profiles (04) — profiles needed for deals, segments, vault
4. Organizations (05) — can link profiles created in 04
5. Deals (03) — needs profiles from 04
6. Segments (06) — needs profiles from 04
7. Campaigns (07) — needs segments from 06
8. Tickets (08) — independent
9. Vault (09) — needs profiles from 04
10. Navigation/UI (10) — best tested last with data populated
