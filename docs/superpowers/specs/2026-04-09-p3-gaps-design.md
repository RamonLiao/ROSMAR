# P3 Gap Completion — Design Spec

**Date**: 2026-04-09
**Scope**: Fix all remaining gaps in P3 modules to production-ready
**Approach**: Module-by-module (6 waves)

---

## Gap Inventory (15 items)

### Critical (runtime failures)
1. X adapter uses app-only bearer token → 403 on tweet post
2. RpcVerifier stub trusts any txDigest → zero verification
3. ActionService in-memory plan store → lost on restart, broken multi-instance

### Important (incomplete features)
4. OAuth state store in-memory → state mismatch multi-instance
5. Non-SUI token USD = $0 → Net Worth inaccurate
6. EVM hardcoded to ETH mainnet → multi-chain identity only sees one chain
7. BalanceSync decimal hardcoded 9 → wrong precision for non-SUI coins
8. ManualVerifier no admin approval → quest manual steps can never complete
9. Broadcast has no email channel adapter

### Enhancement (completeness)
10. YieldOptimizer only Cetus live → Aftermath/Scallop/NAVI mock
11. WorkspaceAiConfig no Prisma relation → inconvenient queries
12. Broadcast.segmentId no FK → no referential integrity
13. EVM multi-chain config → support Polygon/Arbitrum/Base
14. Playbook templates incomplete → blank guildId/roleId, missing send_x
15. Broadcast no template variable substitution

---

## W1: Agent Module (P3-3/P3-4)

### 1a. ActionService plan store → Redis

**Current**: `Map<string, ActionPlan>`, 5min TTL with no eviction.

**Change**: Use existing `CacheService` (Redis-backed).

```
Key:    action-plan:{planId}
Value:  JSON.stringify(plan)
TTL:    300s (Redis native expiry)
```

- `planAction()` → `cacheService.set(key, plan, 300)`
- `executeAction()` → `cacheService.get(key)`, null = expired
- Delete `private readonly plans` Map
- Add validation: LLM-emitted action types must exist in `WorkflowEngine` registered types whitelist
- The ad-hoc campaign created in `executeAction` should be persisted to DB for audit trail

**Files**: `packages/bff/src/agent/action/action.service.ts`

### 1b. YieldOptimizer real APIs

**Current**: Only Cetus fetched live. Aftermath, Scallop, NAVI always mock.

**Change**: Add `fetch*Pools()` per protocol, same pattern as Cetus (10s timeout + mock fallback).

| Protocol | API Endpoint | Data |
|----------|-------------|------|
| Cetus | `https://api.cetus.zone/v2/sui/pools_info` | LP pool APY (existing) |
| Aftermath | `https://aftermath.finance/api/pools` | LP pool APY |
| Scallop | `https://sdk.scallop.io/api/market` | Lending/supply rates |
| NAVI | `https://api.naviprotocol.io/api/v1/market` | Supply APY |

- Each protocol gets its own 15min cache key
- `getPoolApys()` merges all four sources
- On fetch failure, log warning and use mock data for that protocol only

**Files**: `packages/bff/src/agent/yield/yield-optimizer.service.ts`

---

## W2: Social Module (P3-6)

### 2a. OAuth state → Redis

**Current**: `Map<string, OAuthState>`, no TTL, no eviction, leaks memory.

**Change**:

```
Key:    oauth-state:{stateHex}
Value:  JSON.stringify({ profileId, platform, codeVerifier })
TTL:    600s (10min)
```

- `getAuthUrl()` → `cacheService.set(key, state, 600)`
- `handleCallback()` → `cacheService.get(key)` + `cacheService.del(key)` (consume once)
- Delete `private stateStore` Map
- Startup guard: throw if `SOCIAL_ENCRYPTION_KEY` env var is not set (no all-zero default key)

**Files**: `packages/bff/src/social/social-link.service.ts`

---

## W3: Blockchain Module (P3-5)

### 3a. Non-SUI token USD pricing

**Current**: Only native SUI gets USD price. All other SUI coins → `usdPrice: 0`.

**Change**: `PriceOracleService.getTokenPrice(coinType: string): Promise<number | null>`

- Hardcoded coinType → CoinGecko ID mapping for known SUI ecosystem tokens:
  - `0x5d4b...::usdc::USDC` → `"usd-coin"`
  - `0xc060...::usdt::USDT` → `"tether"`
  - `0xaf8c...::weth::WETH` → `"weth"`
  - `0x06864...::cetus::CETUS` → `"cetus-protocol"`
  - (+ SCA, NAVX, afSUI)
- Batch fetch from CoinGecko `/simple/price?ids=...&vs_currencies=usd`
- 5min cache (single key for all prices)
- Unknown coinType → return `null` (not $0), skip from net worth calc

**Files**: `packages/bff/src/blockchain/price-oracle.service.ts`

### 3b. EVM multi-chain support

**Current**: `getEvmBalance()` hardcodes `chain: '0x1'` (ETH mainnet).

**Change**:

- `ProfileWallet.chain` values: `"ETH"`, `"POLYGON"`, `"ARBITRUM"`, `"BASE"`
- Chain → Moralis ID mapping:

| Chain | Moralis ID |
|-------|-----------|
| ETH | `0x1` |
| POLYGON | `0x89` |
| ARBITRUM | `0xa4b1` |
| BASE | `0x2105` |

- `getEvmBalance(address, chain)` accepts chain param
- `getNetWorth()` dispatches per wallet's chain value
- `EvmResolverService` stays single-provider (ENS is mainnet-only)

**Files**: `packages/bff/src/blockchain/balance-aggregator.service.ts`

### 3c. BalanceSync decimal fix

**Current**: `const decimals = symbol === 'SUI' ? 9 : 9; // TODO`

**Change**:

- Call `SuiClient.getCoinMetadata(coinType)` for `decimals` field
- In-memory cache (coin metadata is immutable on-chain)
- **SUI review feedback**: Do NOT fallback to `9`. Use hardcoded known-decimals map for common bridged tokens (USDC=6, USDT=6, WETH=8). Unknown coin with no metadata → return `null`, skip from balance calc rather than showing wrong amount (1000x error risk).

**Files**: `packages/bff/src/blockchain/balance-sync.service.ts`

---

## W4: Quest Module (P3-7 adjacent)

### 4a. RpcVerifier — real on-chain verification

**Current**: Trusts any non-empty `txDigest`. Zero verification.

**Change**: Inject `SuiClient`, call `getTransactionBlock` with full options.

```typescript
const tx = await client.getTransactionBlock(txDigest, {
  showBalanceChanges: true,  // for token_transfer (SUI review: don't parse PTB manually)
  showEvents: true,          // for nft_mint, staking, defi_interaction
  showInput: true,           // for contract_call
  showEffects: true,         // for status + created objects
});
```

**Verification branches by `step.verificationType`:**

| Type | Verification Logic |
|------|-------------------|
| `token_transfer` | `balanceChanges.find(bc => bc.owner.AddressOwner === recipient && bc.coinType === coinType && BigInt(bc.amount) >= amount)` |
| `nft_mint` | `events.some(e => e.type.startsWith(originalPackageId + '::'))` matching expected event |
| `contract_call` | `tx.transaction.data.transaction.inputs` contains `MoveCall` to `target` |
| `any_tx` | `tx.effects.status.status === 'success'` |
| `object_ownership` | **New (SUI review)**: `getOwnedObjects({ filter: { StructType } })` for current-state check |
| `staking` | **New (SUI review)**: `events` contains `0x3::validator::StakingRequestEvent` |
| `defi_interaction` | **New (SUI review)**: `events` contains protocol-specific swap/deposit event |

**SUI review feedback incorporated:**
- Use `showBalanceChanges` instead of parsing `TransferObjects` from `showInput`
- Store `originalPackageId` in verificationConfig (survives package upgrades)
- Event type matching uses `startsWith()` not exact match (handles generics like `SwapEvent<T1, T2>`)
- Use `.some()` on events array (one tx can emit multiple events)

**`step.verificationConfig` JSON schema:**
```json
{
  "token_transfer": { "recipient": "0x...", "coinType": "0x2::sui::SUI", "minAmount": "1000000000" },
  "nft_mint": { "originalPackageId": "0x...", "eventName": "MintEvent" },
  "contract_call": { "target": "0xpkg::module::function" },
  "object_ownership": { "structType": "0xpkg::module::MyNFT" },
  "staking": { "minAmount": "1000000000" },
  "defi_interaction": { "originalPackageId": "0x...", "eventName": "SwapEvent" }
}
```

**Files**: `packages/bff/src/quest/verifiers/rpc.verifier.ts`

### 4b. ManualVerifier admin approval flow

**Current**: `verify()` always returns `false`, no admin endpoint.

**Change**:

- `ManualVerifier.verify()` returns `{ verified: false, pendingApproval: true }`
- `QuestStepCompletion` stores `status: 'PENDING_APPROVAL'`
- Quest controller adds two admin endpoints:
  - `GET /quests/:id/steps/:stepId/submissions` — list pending claims
  - `PATCH /quests/:id/steps/:stepId/submissions/:completionId` — `{ approved: boolean }`
- Protected by `@UseGuards(RbacGuard)` + `@Roles('admin', 'manager')`
- On approval → update completion status → trigger auto-complete check (same as claimStep)

**Files**: `packages/bff/src/quest/quest.controller.ts`, `packages/bff/src/quest/quest.service.ts`, `packages/bff/src/quest/verifiers/manual.verifier.ts`

---

## W5: Broadcast Module (P3-9)

### 5a. X adapter → OAuth 2.0 user token

**Current**: Uses `X_BEARER_TOKEN` (app-only). Will 403 on write operations.

**Change**:

- Remove `X_BEARER_TOKEN` env dependency
- `XChannelAdapter.send(content, cfg)`:
  - `cfg.workspaceId` → query `SocialLink` for workspace owner's X account
  - Decrypt OAuth access token from `SocialLink.oauthTokenEncrypted`
  - Post with `Authorization: Bearer {user_access_token}`
  - Handle token refresh: X OAuth2 refresh flow → update encrypted token in DB
- Add 280 char check: truncate + warning log if exceeded

**Files**: `packages/bff/src/broadcast/adapters/x-channel.adapter.ts`

### 5b. Email channel adapter

**Current**: No email adapter in broadcast. `EmailService` exists in messaging module.

**Change**:

- New `EmailChannelAdapter` implements `ChannelAdapter`
- Delegates to existing `EmailService.sendEmail()`
- **Architecture**: Email is per-recipient (unlike Discord/Telegram/X which are channel-level)
  - On send: query segment members → iterate → send per recipient
  - `BroadcastDelivery` for email stores aggregate (`deliveredCount`, `failedCount`), not per-recipient rows

**Files**: `packages/bff/src/broadcast/adapters/email-channel.adapter.ts` (new)

### 5c. Template variable substitution

**Current**: `broadcast.content` sent raw, no substitution.

**Change**:

- `BroadcastService.renderTemplate(content: string, context: TemplateContext): string`
- Supported variables:
  - `{{profile.name}}`, `{{profile.primaryAddress}}`, `{{profile.ensName}}`, `{{profile.tier}}`
  - `{{workspace.name}}`
- Channel-level sends (Discord/Telegram/X): workspace context only, no profile vars
- Per-recipient sends (email): full profile + workspace context
- Unknown `{{...}}` → preserved as-is (no error)

**Files**: `packages/bff/src/broadcast/broadcast.service.ts`

### 5d. Broadcast scheduled send

**Current**: `schedule()` sets `status='scheduled'` + `scheduledAt` in DB. Nothing triggers it.

**Change**:

- Verify `BroadcastSendJob` (`packages/bff/src/jobs/broadcast-send.job.ts`) has cron scanning for `status = 'scheduled' AND scheduledAt <= now()`
- If not wired, add cron interval (every 1min) to check and trigger `broadcastService.send(id)`

**Files**: `packages/bff/src/jobs/broadcast-send.job.ts`

### 5e. Broadcast.segmentId FK

**Change**: Prisma migration to add `@relation` from `Broadcast.segmentId` → `Segment.id`

**Files**: `packages/bff/prisma/schema.prisma`

---

## W6: Cross-cutting

### 6a. WorkspaceAiConfig Prisma relation

**Change**:
- `WorkspaceAiConfig` add `workspace Workspace @relation(fields: [workspaceId], references: [id])`
- `Workspace` model add `aiConfig WorkspaceAiConfig?`
- Enables `include: { aiConfig: true }`

### 6b. Playbook templates

**Change**:
- Templates are correctly designed as overridable starters (blank guildId/roleId is by design)
- Add validation in `CampaignService.createFromTemplate()`: check required fields are filled
- Add `send_x` step type to templates (using fixed X adapter)
- Add one more template: `re-engagement` (segment_exited → send_email + send_telegram)

### 6c. LlmUsageLog relation — SKIP

Not adding. Append-only log table, `where: { workspaceId }` is sufficient. Adding relation would cause unintended eager loading.

**Files**: `packages/bff/prisma/schema.prisma`, `packages/bff/src/campaign/template/playbook-templates.ts`

---

## Not In Scope

- PromptTemplate DB migration (tracked in `tasks/notes.md` as future upgrade)
- EVM multi-provider fallback (premature optimization)
- Solana SPL token pricing (same pattern as SUI, defer to next sprint)
- LlmUsageLog Prisma relation (not needed)

---

## Prisma Migrations

Single migration covering:
1. `Broadcast.segmentId` → FK to `Segment`
2. `WorkspaceAiConfig.workspaceId` → relation to `Workspace`
3. `QuestStepCompletion` add `status` enum field (`VERIFIED`, `PENDING_APPROVAL`, `REJECTED`)

---

## Test Strategy

Each wave runs existing + new tests before proceeding:

| Wave | Tests |
|------|-------|
| W1 | action.service.spec (plan store), yield-optimizer mock verify |
| W2 | social-link.service.spec (OAuth flow) |
| W3 | balance-aggregator.spec, evm-resolver.spec, price-oracle.spec |
| W4 | quest-verification.spec, quest.controller e2e (admin approval) |
| W5 | channel-adapters.spec, broadcast.service.spec |
| W6 | prisma migration dry-run, playbook validation |
