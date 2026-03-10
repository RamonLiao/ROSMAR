# P5 Security Audit — Fix Changelog

**Date:** 2026-03-10
**Auditor:** Internal security review
**Scope:** 5 Move packages (crm_core, crm_escrow, crm_data, crm_action, crm_vault) + BFF (NestJS)

---

## Wave 1 — Critical Fixes

### M1: Cap check on `profile::add_wallet`

**Severity:** Critical
**Commit:** `f1fcfc2`
**Files changed:** `packages/move/crm_core/sources/profile.move`

**Before:**
`add_wallet` accepted only `(profile, wallet_address, chain, ctx)` with no capability or workspace verification. Any caller could attach arbitrary wallet bindings to any profile object they could reference.

**After:**
Signature expanded to `(config: &GlobalConfig, workspace: &Workspace, cap: &WorkspaceAdminCap, profile, wallet_address, chain, ctx)`. Function now calls `capabilities::assert_not_paused(config)`, `capabilities::assert_cap_matches(cap, workspace::id(workspace))`, and asserts `profile.workspace_id == workspace::id(workspace)`.

**Impact:** An attacker could bind malicious wallet addresses to victim profiles, corrupting identity mappings and potentially hijacking on-chain asset attribution.

**Test Coverage:** `crm_core_tests::test_profile_add_wallet` (happy path), `crm_core_tests::test_add_wallet_wrong_cap_fails` (cap mismatch), `red_team_tests::red_team_cross_workspace_cap_attack` (cross-workspace attack vector)

---

### M2: Deal stage transition validation

**Severity:** Critical
**Commit:** `47542d0`
**Files changed:** `packages/move/crm_core/sources/deal.move`

**Before:**
`update_deal` accepted any `stage` value (0-255) with no transition validation. Callers could skip stages (LEAD->WON), reopen closed deals (WON->LEAD), or set invalid stage values.

**After:**
Added `is_valid_transition(from, to)` enforcing:
- No-op (`from == to`) is valid
- Terminal states WON/LOST cannot be exited
- LOST is reachable from any non-terminal stage (abandon)
- Otherwise only forward-one-step transitions (LEAD->QUALIFIED->PROPOSAL->NEGOTIATION->WON)

`update_deal` now asserts `stage <= STAGE_LOST` (EInvalidStage) and `is_valid_transition(deal.stage, stage)` (EInvalidStageTransition).

**Impact:** An attacker or buggy client could skip deal pipeline stages, reopen finalized deals, or set garbage stage values — corrupting CRM pipeline analytics and escrow-linked deal states.

**Test Coverage:** `escrow_tests` (deal stage transitions implicitly tested via escrow flows), BFF-side `deal-stage.spec.ts` (VALID_TRANSITIONS map)

---

### B1: Workspace isolation on GET endpoints

**Severity:** Critical
**Commit:** `31e7bed`
**Files changed:**
- `packages/bff/src/profile/profile.service.ts`
- `packages/bff/src/deal/deal.service.ts`
- `packages/bff/src/organization/organization.service.ts`

**Before:**
GET-by-ID methods used `findUniqueOrThrow({ where: { id } })` without workspace scoping. Any authenticated user could read profiles, deals, and organizations from other workspaces by guessing/enumerating UUIDs.

**After:**
All GET-by-ID methods use `findFirstOrThrow({ where: { id, workspaceId } })`, ensuring results are scoped to the caller's workspace. Example from `profile.service.ts`:
```typescript
return this.prisma.profile.findFirstOrThrow({
  where: { id: profileId, workspaceId },
});
```

**Impact:** Cross-tenant data leakage. Any authenticated user could read all CRM data (profiles, deals, organizations) from any workspace.

**Test Coverage:** E2E tests verify 404 when accessing cross-workspace resources.

---

### B2: Webhook HMAC authentication

**Severity:** Critical
**Commit:** `4f2fd81`
**Files changed:**
- `packages/bff/src/webhook/guards/webhook-signature.guard.ts` (NEW)
- `packages/bff/src/webhook/webhook.controller.ts`
- `packages/bff/src/webhook/webhook.module.ts`

**Before:**
Webhook endpoint (`POST /api/webhooks/indexer`) had no authentication. Any external caller could inject fake blockchain events into the CRM indexer pipeline.

**After:**
`WebhookSignatureGuard` validates `x-webhook-signature` header:
1. Parses `sha256=<hex>` format
2. Computes `HMAC-SHA256(WEBHOOK_SECRET, JSON.stringify(body))`
3. Uses `timingSafeEqual` to compare (prevents timing attacks)
4. Throws `UnauthorizedException` on mismatch or missing header

**Impact:** An attacker could forge blockchain events — injecting fake transfers, minting phantom NFTs, or triggering workflow automations with fabricated data.

**Test Coverage:** `whale-alert.listener.spec.ts` (integration with guard applied)

---

### B3: Global ThrottlerGuard with per-route overrides

**Severity:** High
**Commit:** `0789f85`, `3ecf3d1`
**Files changed:**
- `packages/bff/src/app.module.ts`
- `packages/bff/src/common/throttle/throttle.config.ts` (NEW)

**Before:**
No rate limiting on any endpoint. APIs were vulnerable to brute-force attacks, resource exhaustion, and abuse.

**After:**
- `ThrottlerGuard` registered as `APP_GUARD` (applies globally)
- Named rate limit tiers:
  - `global`: 100 req/min (default)
  - `auth`: 10 req/min (login endpoints)
  - `ai`: 20 req/min (LLM-powered endpoints)
  - `gdpr`: 3 req/10min (deletion endpoints)

**Impact:** Brute-force wallet login, GDPR deletion abuse, AI token exhaustion, and general DoS via high request volume.

**Test Coverage:** Integration tests verify 429 responses when limits exceeded.

---

### B4: JWT_SECRET hardcoded fallback removed

**Severity:** Critical
**Commit:** `fb136f4`
**Files changed:** `packages/bff/src/auth/auth.module.ts`

**Before:**
```typescript
secret: configService.get<string>('JWT_SECRET') || 'some-hardcoded-fallback',
```
If `JWT_SECRET` was not set, the server silently used a known default string. All tokens would be forgeable.

**After:**
```typescript
const secret = configService.get<string>('JWT_SECRET');
if (!secret) {
  throw new Error('JWT_SECRET environment variable is required');
}
```
Server refuses to start without a proper secret.

**Impact:** Full authentication bypass. An attacker knowing the hardcoded fallback could forge JWTs for any user/workspace with arbitrary permissions.

**Test Coverage:** Startup test verifies Error thrown when JWT_SECRET is missing.

---

## Wave 2 — Should-fix + Nice-to-have

### M3: Admin cap recovery

**Severity:** High
**Commit:** `0f141e3`
**Files changed:** `packages/move/crm_core/sources/admin_recovery.move` (NEW)

**Before:**
If a workspace owner lost or accidentally destroyed their `WorkspaceAdminCap`, there was no recovery mechanism. The workspace became permanently unmanageable.

**After:**
New `admin_recovery::recover_admin_cap(config, workspace, ctx)` function:
- Asserts system is not paused
- Asserts `workspace::owner(workspace) == ctx.sender()` (only the original workspace owner)
- Creates a fresh `WorkspaceAdminCap` via `capabilities::create_admin_cap`

**Impact:** Permanent loss of workspace admin access with no recovery path. Not directly exploitable, but a critical operational risk.

**Test Coverage:** `crm_core_tests` (happy path recovery), `red_team_tests::red_team_non_owner_admin_recovery` (non-owner attempt blocked)

---

### M4: Multi-sig pause

**Severity:** Medium
**Commit:** `0f141e3`
**Files changed:** `packages/move/crm_core/sources/multi_sig_pause.move` (NEW)

**Before:**
Emergency pause required a single `EmergencyPauseCap` holder. Single point of failure — if the cap was compromised, the attacker could pause/unpause at will.

**After:**
New `PauseProposal` struct with commit-vote threshold:
- `create_proposal(action, reason, voters, threshold, ctx)` — creator must be in voters list
- `vote(proposal, config, ctx)` — checks authorization, prevents double-voting
- Auto-executes `capabilities::set_paused()` when signers reach threshold
- Supports both PAUSE and UNPAUSE actions

**Impact:** Single-key compromise could halt the entire system or maliciously unpause a legitimately paused system.

**Test Coverage:** `crm_core_tests` (proposal creation, multi-sig flow), `red_team_tests::red_team_pause_bypass`

---

### M5: Escrow payee claim window

**Severity:** High
**Commit:** `0f141e3`
**Files changed:** `packages/move/crm_escrow/sources/escrow.move`

**Before:**
Only the payer could release funds. If the payer became unresponsive near expiry, the payee had no recourse — funds would sit until expiry and then only the payer could refund.

**After:**
New `claim_before_expiry(escrow, clock, ctx)`:
- Only callable by the payee
- Only within the 24-hour window before expiry: `[expiry - 24h, expiry)`
- Releases entire remaining balance to payee
- Transitions escrow to COMPLETED
- Refund (`refund()`) now requires `now >= expiry` (payer cannot refund during claim window)

**Impact:** Payee could lose earned funds if payer goes unresponsive, with no mechanism to recover before expiry.

**Test Coverage:** `escrow_tests::test_payee_claim_before_expiry`, `escrow_tests::test_payer_refund_only_after_expiry`, `escrow_tests::test_payee_claim_outside_window_fails`, `red_team_tests::red_team_claim_outside_window`

---

### M6: Commit-reveal arbitration

**Severity:** Medium
**Commit:** `c595ea6`
**Files changed:** `packages/move/crm_escrow/sources/escrow.move`

**Before:**
Arbitrator votes were submitted as plain-text on-chain. Other arbitrators could see pending votes and front-run to match/oppose, undermining impartial dispute resolution.

**After:**
Two-phase commit-reveal voting:
1. `commit_vote(escrow, commitment_hash, reveal_deadline_ms, clock, ctx)` — stores `keccak256(vote_byte || salt)` commitment
2. `reveal_vote(escrow, vote, salt, clock, ctx)` — verifies hash match, records vote, resolves dispute if threshold reached
- Commitments tracked in `ArbitrationState.commitments` + `commitment_hashes` vectors
- Reveal deadline enforced; mismatched reveals abort with `ERevealMismatch`
- Original `vote_on_dispute` preserved for simpler cases

**Impact:** Front-running arbitrator votes to manipulate dispute outcomes in favor of attacker-aligned parties.

**Test Coverage:** `escrow_tests::test_commit_and_reveal_vote`, `escrow_tests::test_reveal_vote_mismatch`, `escrow_tests::test_double_commit_fails`

---

### M7: Per-user rate limiting

**Severity:** Medium
**Commit:** `b3defd6`
**Files changed:** `packages/move/crm_core/sources/capabilities.move`

**Before:**
Only workspace-level rate limiting existed (`RateLimitConfig`). A single malicious user could exhaust the entire workspace's operation quota.

**After:**
New `PerUserRateLimit` struct with `Table<address, UserRateState>`:
- `create_per_user_rate_limit(workspace_id, max_per_epoch, ctx)` — creates config
- `check_user_rate_limit(rate, user, current_epoch)` — per-user epoch-based enforcement
- Auto-resets count on new epoch
- Aborts with `EUserRateLimitExceeded` (101)

**Impact:** Single user could DoS a workspace by consuming all per-epoch operations, blocking legitimate users.

**Test Coverage:** `crm_core_tests::test_rate_limit_check`, `crm_core_tests::test_rate_limit_exceeded`, `crm_core_tests::test_rate_limit_reset_on_new_epoch`

---

### B5: Complete GDPR deletion

**Severity:** High
**Commit:** `c1b0e04`
**Files changed:** `packages/bff/src/gdpr/gdpr-executor.service.ts`

**Before:**
GDPR deletion only cleared profile PII fields + `socialLinks` + `segmentMembership`. Residual personal data remained in related tables.

**After:**
Deletion now also removes (within a single Prisma `$transaction`):
- `vaultSecrets` (encrypted secrets linked to profile)
- `messages` (chat/notification messages)
- `workflowActionLogs` (automation execution logs)
- `dealDocuments` (documents attached to profile's deals, resolved via `deal.findMany`)
- Updates `gdprDeletionLog` status from PENDING to EXECUTED

**Impact:** GDPR non-compliance. Personal data fragments remained in vault, messaging, workflow, and document tables after "deletion", violating Art. 17 Right to Erasure.

**Test Coverage:** `gdpr.service.spec.ts`

---

### B6: Escrow DTO validation

**Severity:** Medium
**Commit:** `87b6e9a`
**Files changed:** `packages/bff/src/deal/dto/create-escrow.dto.ts` (NEW)

**Before:**
Escrow creation endpoint accepted raw input with minimal validation. Invalid SUI addresses, zero amounts, and empty arbitrator lists could reach the blockchain layer.

**After:**
`CreateEscrowDto` with strict class-validator decorators:
- `payee`: `@Matches(/^0x[0-9a-fA-F]{64}$/)` (valid SUI address format)
- `totalAmount`: `@Min(1)` (must be positive)
- `arbitrators`: `@ArrayMinSize(1)`, `@IsString({ each: true })`, `@Matches(SUI_ADDRESS, { each: true })`
- `arbiterThreshold`: `@Min(1)`, `@Max(10)`

**Impact:** Malformed inputs could cause on-chain transaction failures, waste gas, or create escrows in invalid states.

**Test Coverage:** `escrow.service.spec.ts` (DTO validation via ValidationPipe)

---

### B7: Redis challenge store

**Severity:** High
**Commit:** `ff66f11`
**Files changed:** `packages/bff/src/auth/auth.service.ts`

**Before:**
Authentication challenges stored in an in-memory `Map`. Challenges were lost on server restart (breaking in-flight logins) and had no TTL enforcement — stale challenges accumulated indefinitely.

**After:**
Challenges stored in Redis via `CacheService`:
- `generateChallenge()`: `await this.cacheService.set('challenge:<nonce>', Date.now(), 300)` (5-min TTL)
- `consumeChallenge()`: `await this.cacheService.get(...)` + `await this.cacheService.evict(...)` (atomic consume)
- Automatic expiry via Redis TTL — no manual cleanup needed
- Survives server restarts in multi-instance deployments

**Impact:** In a multi-instance deployment (k8s), challenges generated on instance A could not be verified on instance B. Stale challenges could also be replayed without expiry.

**Test Coverage:** `cache.service.spec.ts` (CacheService unit tests)

---

### B8: Log redaction expanded

**Severity:** Medium
**Commit:** `f49eaa0`
**Files changed:** `packages/bff/src/common/logging/logging.module.ts`

**Before:**
Only `req.headers.authorization` was redacted from structured logs.

**After:**
Redaction list expanded to:
- `req.headers.authorization`
- `req.headers.cookie`
- `req.body.encryptedData`
- `req.body.privateKey`
- `req.body.secret`
- `req.body.password`
- `req.body.seedPhrase`
- `req.body.mnemonic`

**Impact:** Sensitive data (cookies, private keys, seed phrases, encrypted vault data) logged in plaintext to log aggregators, accessible to anyone with log access.

**Test Coverage:** Manual verification via log output inspection.

---

### B9: CORS safety in production

**Severity:** Medium
**Commit:** `c4a094d`
**Files changed:** `packages/bff/src/main.ts`

**Before:**
CORS origin fell back to `'*'` or `'http://localhost:3000'` in all environments, including production. Any origin could make credentialed cross-origin requests.

**After:**
```typescript
const corsOrigin = process.env.CORS_ORIGIN;
if (!corsOrigin && process.env.NODE_ENV === 'production') {
  throw new Error('CORS_ORIGIN must be set in production');
}
app.enableCors({
  origin: corsOrigin || 'http://localhost:3000',
  credentials: true,
});
```
Production requires explicit `CORS_ORIGIN`. Development defaults to localhost.

**Impact:** CSRF attacks from any domain. Attacker-controlled sites could make authenticated API calls using the victim's cookies/tokens.

**Test Coverage:** Startup test verifies Error thrown when CORS_ORIGIN missing in production.

---

## Wave 3 — Red Team Tests + NatSpec

**Commits:** `44a1f10`, `ba7ed4b`

### Red Team Attack Vectors (24 tests across 5 packages)

| Package | Test File | Vectors |
|---------|-----------|---------|
| crm_core | `tests/red_team_tests.move` | Cross-workspace cap attack, non-owner admin recovery, cross-workspace object manipulation, mass add-member DoS, type confusion metadata, pause bypass |
| crm_escrow | `tests/red_team_tests.move` | Zero-amount release, over-balance release, milestone overflow basis points, refund-before-expiry, double vote, release-before-cliff, claim-outside-window, non-arbitrator vote |
| crm_data | `tests/red_team_tests.move` | (campaign/segment/ticket attack vectors) |
| crm_action | `tests/red_team_tests.move` | (quest badge attack vectors) |
| crm_vault | `tests/red_team_tests.move` | (vault access control attack vectors) |

### NatSpec Annotations

134 `@notice`, `@param`, `@emits`, `@aborts` annotations added across 21 source files in all 5 Move packages, documenting:
- Function purpose and parameters
- Events emitted
- Abort conditions with error codes
- Access control requirements

---

## Summary

| Wave | ID | Severity | Category |
|------|----|----------|----------|
| 1 | M1 | Critical | Access control — missing cap check |
| 1 | M2 | Critical | State machine — unrestricted transitions |
| 1 | B1 | Critical | Data isolation — cross-tenant read |
| 1 | B2 | Critical | Authentication — unauthenticated webhook |
| 1 | B3 | High | DoS protection — no rate limiting |
| 1 | B4 | Critical | Authentication — hardcoded JWT secret |
| 2 | M3 | High | Operational — admin cap recovery |
| 2 | M4 | Medium | Governance — single-key pause control |
| 2 | M5 | High | Funds safety — payee claim window |
| 2 | M6 | Medium | Fair voting — commit-reveal |
| 2 | M7 | Medium | DoS protection — per-user rate limit |
| 2 | B5 | High | Compliance — incomplete GDPR deletion |
| 2 | B6 | Medium | Input validation — escrow DTO |
| 2 | B7 | High | Auth reliability — in-memory challenge store |
| 2 | B8 | Medium | Data leak — insufficient log redaction |
| 2 | B9 | Medium | CSRF — permissive CORS |
| 3 | — | — | Red team tests (24) + NatSpec (134) |
