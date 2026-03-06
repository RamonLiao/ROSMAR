# ROSMAR CRM — Progress

## Current Task
zkLogin auth gap fix — challenge-sign flow implemented, e2e tests passing. Next: real Google OAuth + Enoki integration test.

## Recently Completed (2026-02-15)
- **Phase 1–13**: Full-stack scaffold (Move, BFF, Frontend, all wiring)
- **Phase 14**: BFF e2e tests — 25 tests, all passing
- **Phase 15**: Docker multi-stage builds (BFF + Frontend), docker-compose, GitHub Actions CI/CD
- **Enoki zkLogin + sponsored TX**: Frontend Google OAuth flow, BFF sponsor endpoints, EnokiClient
- **Dashboard analytics**: DB-side aggregation endpoints (score-distribution, activity-heatmap)
- **Code review fixes** (8 issues)
- **Git**: Initial commit `eba7c80`, pushed to git@github.com:RamonLiao/ROSMAR.git (main)

## Recently Completed (2026-02-16)
- **Frontend component tests**: 65 tests across 11 files with vitest + @testing-library/react
- **Dashboard pipeline chart**: Server-side aggregation via GET /api/analytics/pipeline-summary
- **Production deployment configs**: docker-compose.prod.yml, .env.production.example, deploy/nginx.conf
- **Docker config fixes**: 5 issues (Prisma copy, pnpm pin, health checks, depends_on conditions)
- **BFF /health endpoint**: GET /api/health for docker health checks
- **Enoki API keys**: Configured in .env.local and .env
- **Auth gap fix — challenge-sign flow**:
  - BFF: `GET /auth/challenge` endpoint (nonce with 5min TTL)
  - BFF: `verifyWalletSignature` rewritten → uses `verifySignature` from `@mysten/sui/verify` (supports Ed25519, Secp256k1, zkLogin)
  - Frontend: new `useAuthSession` hook (challenge → signPersonalMessage → POST /auth/login → httpOnly cookie)
  - Frontend: `login/page.tsx` uses `useAuthSession` instead of plain zustand `login()`
  - Jest mock: `test/__mocks__/@mysten/sui/verify.ts` added, `jest-e2e.json` updated
  - **25/25 e2e tests passing**

## TODO
- [ ] Test zkLogin flow end-to-end (need real Google Client ID + Enoki keys configured)
- [ ] Manual QA: start full stack with `docker-compose up`, verify all flows
- [ ] Fix pre-existing TS errors in `use-sponsored-tx.ts` (`.data` property access)

## Blockers
- Google OAuth Client ID must be a real `*.apps.googleusercontent.com` value (not placeholder)
- Enoki portal must have Google auth provider configured with matching Client ID

## Notes
- GitHub repo: https://github.com/RamonLiao/ROSMAR (branch: main)
- BFF: port 3001, global /api prefix, ValidationPipe enabled
- **Auth flow**: unified challenge-sign for all wallet types (zkLogin, Ed25519, Secp256k1)
- **verifySignature** from `@mysten/sui/verify` auto-detects key type from signature — no need to know wallet type upfront
- `registerEnokiWallets` encapsulates OAuth JWT internally; can't extract jwt/salt directly → that's why we use signPersonalMessage instead of POST /auth/zklogin
- Challenge nonces stored in-memory Map (fine for single instance; need Redis for horizontal scaling)
- Files changed this session:
  - `packages/bff/src/auth/auth.controller.ts` — added GET /auth/challenge
  - `packages/bff/src/auth/auth.service.ts` — challenge gen/verify, verifySignature
  - `packages/frontend/src/hooks/use-auth-session.ts` — new file
  - `packages/frontend/src/app/(auth)/login/page.tsx` — uses useAuthSession
  - `packages/bff/test/__mocks__/@mysten/sui/verify.ts` — new mock
  - `packages/bff/test/jest-e2e.json` — added verify mock mapping
