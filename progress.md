# ROSMAR CRM — Progress

## Current Task
All TODO items completed. Project ready for manual QA and deployment.

## Recently Completed (2026-02-15)
- **Phase 1–13**: Full-stack scaffold complete (Move, Rust indexer/gRPC, NestJS BFF, Next.js frontend + Nordic Glacier theme)
- **Move contract tests**: 68 tests across 4 packages — all passing
- **Fix `@ts-nocheck` in auth.service.ts**: Proper JWT typing
- **Fix `client: any` in sui.client.ts**: `SuiJsonRpcClient` with `network` param
- **Logo dark mode**: `ThemeLogo` component
- **BFF Prisma DB wiring** (10 tasks): All services refactored, 0 TS errors
- **Frontend → BFF API wiring** (13 tasks): All mock data replaced with React Query hooks
- **Phase 14: BFF e2e tests**: 25 tests (auth, deals, profiles, orgs, segments, campaigns, guards) — all passing
- **Phase 15: Docker deployment**: Multi-stage Dockerfiles (BFF + frontend), docker-compose updated, GitHub Actions CI/CD
- **Enoki zkLogin + sponsored TX**: Frontend Google OAuth zkLogin flow, BFF sponsor endpoints, EnokiClient integration
- **Dashboard analytics endpoints**: score-distribution + activity-heatmap API, frontend hooks wired to real data

## TODO
_(none — all phases complete)_

## Blockers
None

## Notes
- Enoki env vars needed: `ENOKI_API_KEY`, `ENOKI_SECRET_KEY`, `NEXT_PUBLIC_ENOKI_API_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- Docker: `docker-compose up` now starts full stack (TimescaleDB + Redis + BFF + Frontend)
- e2e tests: `cd packages/bff && pnpm test:e2e` (25 tests, mocked Prisma/Sui services)
- pnpm workspaces (no turbo), @mysten/sui v2.4.0, NestJS 11 + Prisma 7
