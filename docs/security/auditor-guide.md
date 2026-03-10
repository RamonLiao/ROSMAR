# ROSMAR CRM Security Auditor Guide

> Last updated: 2026-03-10

## 1. Repository Structure

```
rosmar/
  packages/
    move/
      crm_core/        # Core on-chain primitives (workspace, profile, org, deal, ACL, capabilities)
      crm_data/        # Data-layer objects (campaign, segment, ticket, deal pipeline)
      crm_escrow/      # Escrow, vesting, arbitration (holds SUI funds)
      crm_vault/       # Encrypted storage (Walrus + Seal integration), access policies
      crm_action/      # Side-effect modules (airdrop, reward distribution, quest badge SBT)
    bff/               # NestJS 11 backend-for-frontend (REST API, auth, TX building)
  docker-compose.yml   # TimescaleDB (pg16) + Redis 7
  pnpm-workspace.yaml  # workspace: packages/*
```

### Move Package Summary

| Package | Description | Key Concern |
|---------|-------------|-------------|
| `crm_core` | Workspace, Profile, Organization, Deal, Relation, ACL bitmask, GlobalConfig pause, rate limiting, multi-sig pause, admin recovery, Display init | Access control root, capability model, emergency pause |
| `crm_data` | Campaign (FSM), Segment, Ticket (FSM), Deal pipeline (FSM) | State machine correctness, optimistic lock |
| `crm_escrow` | Escrow (SUI balance), vesting (linear/milestone), arbitration (direct + commit-reveal) | Fund custody, release/refund logic, dispute resolution |
| `crm_vault` | Vault (Walrus blob references), AccessPolicy (Seal key-server `seal_approve`) | Decryption access control, cross-policy replay prevention |
| `crm_action` | Airdrop (batch/variable), Reward (single/batch), QuestBadge (SBT, dedup registry) | Fund distribution, overflow, SBT non-transferability |

### BFF Summary

NestJS 11 application serving as the off-chain orchestration layer. Key modules:

- **AuthModule** -- wallet signature verify, zkLogin (Enoki), passkey/WebAuthn, JWT sessions
- **BlockchainModule** -- SUI TX building and submission
- **VaultModule** -- Walrus upload, Seal encryption orchestration
- **GdprModule** -- data deletion/export flows
- **CacheModule** -- Redis-backed caching
- **ThrottleConfig** -- `@nestjs/throttler` rate limiting (global ThrottlerGuard)
- Domain modules: Workspace, Profile, Organization, Deal, Segment, Campaign, Ticket, Quest, etc.

---

## 2. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| SUI CLI | Latest stable | `cargo install --locked --git https://github.com/MystenLabs/sui.git sui` |
| Node.js | >= 20 | Required for NestJS 11 |
| pnpm | >= 9 | `corepack enable && corepack prepare pnpm@latest` |
| Docker & Docker Compose | Latest | TimescaleDB (pg16) on port 5432, Redis 7 on port 6379 |
| Rust/Cargo | Latest stable | Only needed if building SUI CLI from source |

Environment setup:

```bash
# Start databases
docker compose up -d

# Install BFF dependencies
cd packages/bff && pnpm install

# Generate Prisma client
cd packages/bff && npx prisma generate

# Run migrations
cd packages/bff && npx prisma migrate dev
```

---

## 3. Build & Test Commands

### Move Packages

```bash
# Build each package (order matters for dependencies)
cd packages/move/crm_core   && sui move build
cd packages/move/crm_data   && sui move build
cd packages/move/crm_escrow && sui move build
cd packages/move/crm_vault  && sui move build
cd packages/move/crm_action && sui move build

# Run tests
cd packages/move/crm_core   && sui move test
cd packages/move/crm_escrow && sui move test
cd packages/move/crm_action && sui move test

# Gas tracking (useful for cost analysis)
cd packages/move/crm_escrow && sui move test --gas-tracking
```

### BFF

```bash
cd packages/bff

# Install + build
pnpm install
pnpm build

# Type checking (no emit)
npx tsc --noEmit

# Unit tests
pnpm test           # jest (watch mode)
pnpm test:cov       # with coverage

# E2E tests
pnpm test:e2e       # jest --config ./test/jest-e2e.json
```

### Root-level

```bash
pnpm build   # builds all packages
pnpm test    # tests all packages
pnpm lint    # lints all packages
```

---

## 4. Key Files to Review

### crm_core (access control foundation)

| File | Priority | Why |
|------|----------|-----|
| `sources/capabilities.move` | **CRITICAL** | GlobalConfig pause, WorkspaceAdminCap creation, rate limiting |
| `sources/acl.move` | **HIGH** | Permission bitmask (READ=1, WRITE=2, SHARE=4, DELETE=8, MANAGE=16), role levels |
| `sources/workspace.move` | **HIGH** | Workspace creation, member add/remove, owner protection, admin cap issuance |
| `sources/admin_recovery.move` | **HIGH** | Admin cap recovery (owner-only gate) |
| `sources/multi_sig_pause.move` | **HIGH** | Multi-sig proposal for global pause/unpause, `public(package)` set_paused |
| `sources/deal.move` | MEDIUM | Deal stage FSM (LEAD -> ... -> WON/LOST), `is_valid_transition` |
| `sources/profile.move` | MEDIUM | Profile create/archive, wallet binding (dynamic object field) |
| `sources/organization.move` | MEDIUM | Organization CRUD with optimistic locking |
| `sources/relation.move` | LOW | Profile-Organization links |
| `sources/display_init.move` | LOW | OTW Display setup, publisher claim |

### crm_escrow (fund custody)

| File | Priority | Why |
|------|----------|-----|
| `sources/escrow.move` | **CRITICAL** | SUI balance custody, fund/release/refund, claim_before_expiry, dispute arbitration, commit-reveal voting |
| `sources/vesting.move` | **HIGH** | Linear + milestone vesting math (u128 intermediate), basis points |
| `sources/arbitration.move` | LOW | Constants only (DECISION_RELEASE=0, DECISION_REFUND=1) |

### crm_vault (encrypted storage)

| File | Priority | Why |
|------|----------|-----|
| `sources/policy.move` | **HIGH** | `seal_approve` entry function -- Seal key-server verification, 3 rule types, cross-policy replay check |
| `sources/vault.move` | MEDIUM | Vault CRUD, Walrus blob ID + Seal policy ID attachment |

### crm_action (fund distribution)

| File | Priority | Why |
|------|----------|-----|
| `sources/airdrop.move` | **HIGH** | Batch SUI transfer, overflow risk in `amount_per_recipient * recipient_count` |
| `sources/reward.move` | **HIGH** | Campaign-gated reward distribution, fund splitting |
| `sources/quest_badge.move` | MEDIUM | SBT minting, dedup registry (Table), BCS key generation |

### BFF Auth

| File | Priority | Why |
|------|----------|-----|
| `src/auth/auth.service.ts` | **CRITICAL** | Challenge generation (Redis), wallet signature verify, zkLogin (Enoki), passkey/WebAuthn, JWT issue/refresh, workspace switch |
| `src/auth/guards/session.guard.ts` | **HIGH** | JWT extraction from cookie / Bearer header |
| `src/auth/guards/rbac.guard.ts` | **HIGH** | Permission bitmask enforcement (mirrors on-chain ACL) |
| `src/auth/strategies/wallet.strategy.ts` | MEDIUM | Passport custom strategy for wallet auth |
| `src/auth/strategies/zklogin.strategy.ts` | MEDIUM | Passport custom strategy for zkLogin |
| `src/main.ts` | MEDIUM | CORS config, ValidationPipe whitelist, global prefix |

---

## 5. Dependencies

### Move (External)

- **Sui Framework** (testnet rev) -- `git = "https://github.com/MystenLabs/sui.git"`, subdir `crates/sui-framework/packages/sui-framework`
- All 5 packages use Move edition `2024.beta`

### Move (Internal Dependency Graph)

```
crm_core       <- (no Move deps, only Sui)
crm_data       <- crm_core
crm_vault      <- crm_core
crm_escrow     <- crm_core, crm_data
crm_action     <- crm_core, crm_data
```

### BFF (Key npm Dependencies)

| Package | Version | Role |
|---------|---------|------|
| `@mysten/sui` | ^2.4.0 | SUI JSON-RPC client, TX building |
| `@mysten/zklogin` | ^0.8.1 | zkLogin utilities |
| `@mysten/enoki` | ^1.0.3 | Enoki API client |
| `@nestjs/jwt` | ^11.0.2 | JWT sign/verify |
| `@nestjs/passport` | ^11.0.5 | Auth strategy framework |
| `@nestjs/throttler` | ^6.5.0 | Rate limiting |
| `@simplewebauthn/server` | ^13.2.3 | Passkey/WebAuthn verification |
| `@prisma/client` | ^7.4.0 | Database ORM |
| `@prisma/adapter-pg` | ^7.4.0 | PostgreSQL adapter |
| `ioredis` | ^5.9.3 | Redis client (caching, challenges) |
| `zod` | ^4.3.6 | Runtime validation |
| `ethers` | ^6.16.0 | EVM wallet utilities |
| `@solana/web3.js` | ^1.98.4 | Solana wallet utilities |
| `bullmq` | ^5.69.2 | Job queue (GDPR, async tasks) |
| `ai` / `@ai-sdk/anthropic` / `@ai-sdk/openai` | Various | AI agent features |

---

## 6. Network Info

- **Target network**: SUI Testnet
- **RPC endpoint**: `https://fullnode.testnet.sui.io:443` (configurable via `SUI_RPC_URL`)
- **Package addresses**: All set to `0x0` in Move.toml (pre-deployment)
- **Deployment scripts**: `deploy/` directory, `scripts/` directory
- **BFF port**: 3001 (configurable via `PORT`)
- **CORS origin**: `http://localhost:3000` (dev), required via `CORS_ORIGIN` in production

---

## 7. Security Fixes Applied

> See `docs/security/fix-changelog.md` for the complete list of security fixes with timestamps and rationale.

Key areas where hardening has been applied:

- **Global pause mechanism** -- `EmergencyPauseCap` + multi-sig pause proposal system
- **Rate limiting** -- Per-workspace and per-user on-chain rate limits, plus BFF-level `@nestjs/throttler`
- **Optimistic concurrency** -- Version fields on all mutable on-chain objects
- **Escrow safety** -- Minimum lock duration (1 hour), claim window (24h before expiry), arbitrator conflict-of-interest checks
- **Commit-reveal voting** -- Prevents arbitrator vote front-running via keccak256 hash commitment
- **Admin recovery** -- Owner-only cap recovery with pause check
- **Seal cross-policy replay prevention** -- `seal_approve` verifies `id` matches policy object address
- **Auth challenge replay prevention** -- Redis-backed nonce with 5-min TTL, single-use consumption
- **Input validation** -- `ValidationPipe({ whitelist: true, transform: true })` strips unknown fields
- **CORS enforcement** -- Required `CORS_ORIGIN` in production, credentials mode enabled
- **SBT non-transferability** -- `QuestBadge` lacks `store` ability, preventing post-mint transfer
- **Dedup registry** -- `QuestRegistry` shared Table prevents double-minting of quest badges
