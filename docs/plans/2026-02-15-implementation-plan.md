# Decentralized CRM — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-ready Web3 CRM with Sui Move contracts, Rust indexer, NestJS BFF, Rust Core query service, and Next.js frontend.

**Architecture:** BFF pattern — NestJS handles auth/business logic/SDK integration, Rust Core handles high-perf queries via gRPC, Rust Indexer streams chain events into PostgreSQL+TimescaleDB. Sui Move contracts (4 packages) store ownership, ACL, core metadata. Seal+Walrus for encrypted storage.

**Tech Stack:** Sui Move, Rust (Axum+tonic+sqlx), TypeScript (NestJS, Next.js), PostgreSQL+TimescaleDB, Redis (BullMQ), gRPC, Docker, Traefik

**Design Doc:** `docs/plans/2026-02-15-system-architecture-design.md` (v1.1)

---

## Phase Overview

```
Phase 1: Project Scaffolding & Infrastructure     (~2 days)
Phase 2: Move Contracts — crm_core                 (~3 days)
Phase 3: Move Contracts — crm_data + crm_vault     (~2 days)
Phase 4: Move Contracts — crm_action + Display      (~1 day)
Phase 5: Database Schema & Migrations               (~1 day)
Phase 6: Rust Indexer                                (~3 days)
Phase 7: Rust Core Service                           (~3 days)
Phase 8: BFF — Auth & Workspace                      (~3 days)
Phase 9: BFF — Profile, Org, Deal, Segment           (~3 days)
Phase 10: BFF — Campaign, Vault, Messaging           (~3 days)
Phase 11: Frontend — Shell & Auth                    (~2 days)
Phase 12: Frontend — Core Pages                      (~4 days)
Phase 13: Frontend — Advanced Features               (~3 days)
Phase 14: Integration & E2E Testing                  (~2 days)
Phase 15: Docker Deployment & Monitoring             (~2 days)
                                            Total: ~37 days
```

### Dependency Graph

```
Phase 1 (Scaffold)
  ├── Phase 2 (crm_core) → Phase 3 (crm_data/vault) → Phase 4 (crm_action/display)
  ├── Phase 5 (DB Schema)
  │     ├── Phase 6 (Indexer) ──────────────────────────┐
  │     ├── Phase 7 (Rust Core) ────────────────────────┤
  │     └── Phase 8 (BFF Auth) → Phase 9 (BFF CRUD) ───┤
  │                              → Phase 10 (BFF Adv) ──┤
  └── Phase 11 (FE Shell) → Phase 12 (FE Pages) ───────┤
                           → Phase 13 (FE Advanced) ────┤
                                                        ▼
                                              Phase 14 (E2E)
                                                        │
                                              Phase 15 (Deploy)
```

Parallelizable: Phases 2-4 (Move) can run in parallel with Phases 5-7 (Backend) and Phase 11 (FE shell).

---

## Phase 1: Project Scaffolding & Infrastructure

### Task 1.1: Initialize Monorepo

**Files:**
- Create: `package.json` (workspace root)
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `docker-compose.yml`
- Create: `docker-compose.prod.yml`

**Step 1: Initialize git and root package.json**

```bash
cd /Users/ramonliao/Documents/Code/Project/Web3/BlockchainDev/SUI/Projects/Decentralised_CRM
git init
```

```json
// package.json
{
  "name": "decentralised-crm",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.4.0"
  }
}
```

**Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["build"] },
    "lint": {},
    "typecheck": {}
  }
}
```

**Step 3: Create directory structure**

```bash
mkdir -p packages/{move,proto,shared-types,frontend,bff,rust-core,indexer}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
.next/
target/
.env
.env.*
!.env.example
*.DS_Store
```

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: initialize monorepo with turborepo"
```

---

### Task 1.2: Docker Compose (Development)

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

**Step 1: Write docker-compose.yml**

```yaml
# docker-compose.yml
services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: crm
      POSTGRES_USER: crm
      POSTGRES_PASSWORD: ${PG_PASSWORD:-crm_dev_password}
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U crm"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  pg_data:
  redis_data:
```

**Step 2: Write .env.example**

```env
# Database
PG_PASSWORD=crm_dev_password
DATABASE_URL=postgresql://crm:crm_dev_password@localhost:5432/crm

# Redis
REDIS_URL=redis://localhost:6379

# Sui
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_NETWORK=testnet

# Rust Core gRPC
RUST_CORE_GRPC=http://localhost:50051

# Auth
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Google OAuth (for ZkLogin)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

**Step 3: Start services and verify**

```bash
docker compose up -d
docker compose ps
# Expected: postgres and redis both "healthy"/"running"
```

**Step 4: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "chore: add docker-compose with PostgreSQL+TimescaleDB and Redis"
```

---

### Task 1.3: Initialize Move Project

**Files:**
- Create: `packages/move/crm_core/Move.toml`
- Create: `packages/move/crm_core/sources/.gitkeep`
- Create: `packages/move/crm_data/Move.toml`
- Create: `packages/move/crm_vault/Move.toml`
- Create: `packages/move/crm_action/Move.toml`

**Step 1: Create crm_core package**

```bash
mkdir -p packages/move/crm_core/sources
```

```toml
# packages/move/crm_core/Move.toml
[package]
name = "crm_core"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
crm_core = "0x0"
```

**Step 2: Create crm_data package (depends on crm_core)**

```toml
# packages/move/crm_data/Move.toml
[package]
name = "crm_data"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }
crm_core = { local = "../crm_core" }

[addresses]
crm_data = "0x0"
```

**Step 3: Create crm_vault and crm_action similarly**

```toml
# packages/move/crm_vault/Move.toml
[package]
name = "crm_vault"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }
crm_core = { local = "../crm_core" }

[addresses]
crm_vault = "0x0"
```

```toml
# packages/move/crm_action/Move.toml
[package]
name = "crm_action"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }
crm_core = { local = "../crm_core" }
crm_data = { local = "../crm_data" }

[addresses]
crm_action = "0x0"
```

**Step 4: Verify build**

```bash
cd packages/move/crm_core && sui move build
# Expected: BUILDING crm_core, no errors
```

**Step 5: Commit**

```bash
git add packages/move/
git commit -m "chore: initialize 4 Move packages with dependency chain"
```

---

### Task 1.4: Initialize Rust Projects

**Files:**
- Create: `packages/rust-core/Cargo.toml`
- Create: `packages/rust-core/src/main.rs`
- Create: `packages/indexer/Cargo.toml`
- Create: `packages/indexer/src/main.rs`
- Create: `packages/proto/core.proto`

**Step 1: Create Rust Core project**

```bash
cd packages/rust-core
cargo init --name crm-core
```

```toml
# packages/rust-core/Cargo.toml
[package]
name = "crm-core"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1", features = ["full"] }
tonic = "0.12"
prost = "0.13"
axum = "0.8"
sqlx = { version = "0.8", features = ["runtime-tokio", "postgres", "uuid", "chrono", "json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
dotenvy = "0.15"

[build-dependencies]
tonic-build = "0.12"
```

**Step 2: Create Indexer project**

```bash
cd packages/indexer
cargo init --name crm-indexer
```

```toml
# packages/indexer/Cargo.toml
[package]
name = "crm-indexer"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1", features = ["full"] }
sqlx = { version = "0.8", features = ["runtime-tokio", "postgres", "uuid", "chrono", "json"] }
sui-data-ingestion-core = "0.1"
sui-types = "0.1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
reqwest = { version = "0.12", features = ["json"] }
dotenvy = "0.15"
```

**Step 3: Create proto definition**

```protobuf
// packages/proto/core.proto
syntax = "proto3";
package crm.core;

service ProfileService {
  rpc ListProfiles(ListProfilesRequest) returns (ListProfilesResponse);
  rpc GetProfile(GetProfileRequest) returns (ProfileDetail);
  rpc GetActivityFeed(ActivityFeedRequest) returns (stream ActivityEvent);
  rpc Search(SearchRequest) returns (SearchResponse);
}

service SegmentService {
  rpc EvaluateSegment(EvaluateRequest) returns (EvaluateResponse);
  rpc GetSegmentMembers(SegmentMembersRequest) returns (SegmentMembersResponse);
}

service AnalyticsService {
  rpc GetDashboardOverview(DashboardRequest) returns (DashboardResponse);
  rpc RecalculateScores(ScoreRequest) returns (ScoreResponse);
  rpc CheckWhaleAlert(WhaleAlertRequest) returns (stream WhaleAlert);
}

// --- Messages ---

message ListProfilesRequest {
  string workspace_id = 1;
  int32 page = 2;
  int32 page_size = 3;
  string sort_by = 4;
  string sort_order = 5;
  ProfileFilter filter = 6;
}

message ProfileFilter {
  repeated int32 tiers = 1;
  repeated string tags = 2;
  optional int64 min_score = 3;
  optional int64 max_score = 4;
  optional string last_active_after = 5;
  optional string last_active_before = 6;
  optional string search_query = 7;
}

message ListProfilesResponse {
  repeated ProfileSummary profiles = 1;
  int32 total = 2;
  int32 page = 3;
  int32 page_size = 4;
}

message ProfileSummary {
  string id = 1;
  string primary_address = 2;
  string suins_name = 3;
  int32 tier = 4;
  int64 engagement_score = 5;
  repeated string tags = 6;
  string display_name = 7;
  string last_active_at = 8;
}

message GetProfileRequest {
  string id = 1;
}

message ProfileDetail {
  ProfileSummary summary = 1;
  string sui_object_id = 2;
  string avatar_url = 3;
  string source = 4;
  string created_at = 5;
  string updated_at = 6;
  int64 version = 7;
  bool is_archived = 8;
}

message ActivityFeedRequest {
  string profile_id = 1;
  int32 limit = 2;
  string before = 3;
}

message ActivityEvent {
  string time = 1;
  string event_type = 2;
  string contract_address = 3;
  string collection = 4;
  string token = 5;
  int64 amount = 6;
  string tx_digest = 7;
}

message SearchRequest {
  string workspace_id = 1;
  string query = 2;
  int32 limit = 3;
}

message SearchResponse {
  repeated SearchResult results = 1;
}

message SearchResult {
  string id = 1;
  string type = 2;
  string title = 3;
  string subtitle = 4;
}

message EvaluateRequest {
  string segment_id = 1;
}

message EvaluateResponse {
  int32 member_count = 1;
  repeated string profile_ids = 2;
}

message SegmentMembersRequest {
  string segment_id = 1;
  int32 page = 2;
  int32 page_size = 3;
}

message SegmentMembersResponse {
  repeated ProfileSummary members = 1;
  int32 total = 2;
}

message DashboardRequest {
  string workspace_id = 1;
}

message DashboardResponse {
  int64 total_profiles = 1;
  int64 active_profiles_30d = 2;
  int64 total_deals_value = 3;
  int32 open_tickets = 4;
  repeated TierDistribution tier_distribution = 5;
}

message TierDistribution {
  int32 tier = 1;
  int64 count = 2;
}

message ScoreRequest {
  string workspace_id = 1;
}

message ScoreResponse {
  int32 profiles_updated = 1;
  int32 tier_changes = 2;
}

message WhaleAlertRequest {
  string workspace_id = 1;
}

message WhaleAlert {
  string profile_id = 1;
  string address = 2;
  string event_type = 3;
  int64 amount = 4;
  string timestamp = 5;
}
```

**Step 4: Verify Rust builds**

```bash
cd packages/rust-core && cargo check
cd packages/indexer && cargo check
```

**Step 5: Commit**

```bash
git add packages/rust-core/ packages/indexer/ packages/proto/
git commit -m "chore: initialize Rust Core, Indexer, and proto definitions"
```

---

### Task 1.5: Initialize NestJS BFF

**Files:**
- Create: `packages/bff/` (via nest CLI)

**Step 1: Generate NestJS project**

```bash
cd packages
npx @nestjs/cli new bff --package-manager npm --skip-git
```

**Step 2: Install core dependencies**

```bash
cd packages/bff
npm install @nestjs/config @nestjs/jwt @nestjs/passport @nestjs/bull
npm install passport passport-jwt passport-custom
npm install @mysten/sui @mysten/dapp-kit @mysten/zklogin
npm install bullmq ioredis
npm install class-validator class-transformer
npm install @grpc/grpc-js @grpc/proto-loader @nestjs/microservices
npm install uuid
npm install -D @types/passport-jwt
```

**Step 3: Verify build**

```bash
cd packages/bff && npm run build
# Expected: no errors
```

**Step 4: Commit**

```bash
git add packages/bff/
git commit -m "chore: initialize NestJS BFF with core dependencies"
```

---

### Task 1.6: Initialize Next.js Frontend

**Files:**
- Create: `packages/frontend/` (via create-next-app)

**Step 1: Generate Next.js project**

```bash
cd packages
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

**Step 2: Install UI and blockchain dependencies**

```bash
cd packages/frontend
npm install @mysten/dapp-kit @mysten/sui @mysten/zklogin
npm install @tanstack/react-query zustand
npm install react-hook-form @hookform/resolvers zod
npm install recharts @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install reactflow
npx shadcn@latest init -d
```

**Step 3: Verify build**

```bash
cd packages/frontend && npm run build
```

**Step 4: Commit**

```bash
git add packages/frontend/
git commit -m "chore: initialize Next.js frontend with Sui SDK and UI dependencies"
```

---

## Phase 2: Move Contracts — crm_core

### Task 2.1: Capabilities & GlobalConfig

**Files:**
- Create: `packages/move/crm_core/sources/capabilities.move`
- Test: `sui move test` in crm_core

**Step 1: Write capabilities module**

```move
// packages/move/crm_core/sources/capabilities.move
module crm_core::capabilities {
    use std::string::String;

    // ===== Error codes =====
    const EPaused: u64 = 0;
    const ENotOwner: u64 = 1;
    const ECapMismatch: u64 = 2;

    // ===== Structs =====

    /// Global pause switch — shared object
    public struct GlobalConfig has key {
        id: UID,
        paused: bool,
        pause_reason: Option<String>,
    }

    /// Capability for workspace-level admin operations
    public struct WorkspaceAdminCap has key, store {
        id: UID,
        workspace_id: ID,
    }

    /// Capability for emergency pause
    public struct EmergencyPauseCap has key, store {
        id: UID,
    }

    /// Rate limiting per workspace
    public struct RateLimitConfig has key {
        id: UID,
        workspace_id: ID,
        max_operations_per_epoch: u64,
        current_epoch: u64,
        current_count: u64,
    }

    // ===== Init =====

    fun init(ctx: &mut TxContext) {
        let config = GlobalConfig {
            id: object::new(ctx),
            paused: false,
            pause_reason: option::none(),
        };
        transfer::share_object(config);

        let pause_cap = EmergencyPauseCap {
            id: object::new(ctx),
        };
        transfer::transfer(pause_cap, ctx.sender());
    }

    // ===== Public functions =====

    public fun assert_not_paused(config: &GlobalConfig) {
        assert!(!config.paused, EPaused);
    }

    public fun pause(
        config: &mut GlobalConfig,
        _cap: &EmergencyPauseCap,
        reason: String,
    ) {
        config.paused = true;
        config.pause_reason = option::some(reason);
    }

    public fun unpause(
        config: &mut GlobalConfig,
        _cap: &EmergencyPauseCap,
    ) {
        config.paused = false;
        config.pause_reason = option::none();
    }

    public fun is_paused(config: &GlobalConfig): bool {
        config.paused
    }

    // ===== AdminCap helpers =====

    public fun create_admin_cap(
        workspace_id: ID,
        ctx: &mut TxContext,
    ): WorkspaceAdminCap {
        WorkspaceAdminCap {
            id: object::new(ctx),
            workspace_id,
        }
    }

    public fun assert_cap_matches(cap: &WorkspaceAdminCap, workspace_id: ID) {
        assert!(cap.workspace_id == workspace_id, ECapMismatch);
    }

    public fun cap_workspace_id(cap: &WorkspaceAdminCap): ID {
        cap.workspace_id
    }

    // ===== Rate limiting =====

    public fun create_rate_limit(
        workspace_id: ID,
        max_ops: u64,
        ctx: &mut TxContext,
    ): RateLimitConfig {
        RateLimitConfig {
            id: object::new(ctx),
            workspace_id,
            max_operations_per_epoch: max_ops,
            current_epoch: 0,
            current_count: 0,
        }
    }

    public fun check_rate_limit(
        rate: &mut RateLimitConfig,
        current_epoch: u64,
    ) {
        if (rate.current_epoch != current_epoch) {
            rate.current_epoch = current_epoch;
            rate.current_count = 0;
        };
        assert!(rate.current_count < rate.max_operations_per_epoch, 100);
        rate.current_count = rate.current_count + 1;
    }
}
```

**Step 2: Write test**

```move
#[test_only]
module crm_core::capabilities_tests {
    use crm_core::capabilities;

    #[test]
    fun test_pause_unpause() {
        let mut ctx = tx_context::dummy();
        // init creates shared GlobalConfig and EmergencyPauseCap
        // We test via direct struct creation in test
        let mut config = capabilities::test_create_config(&mut ctx);
        let cap = capabilities::test_create_pause_cap(&mut ctx);

        assert!(!capabilities::is_paused(&config));
        capabilities::pause(&mut config, &cap, b"maintenance".to_string());
        assert!(capabilities::is_paused(&config));
        capabilities::unpause(&mut config, &cap);
        assert!(!capabilities::is_paused(&config));

        // cleanup
        sui::test_utils::destroy(config);
        sui::test_utils::destroy(cap);
    }
}
```

Note: Add `#[test_only]` helper constructors to capabilities.move for testing.

**Step 3: Run tests**

```bash
cd packages/move/crm_core && sui move test
# Expected: all tests pass
```

**Step 4: Commit**

```bash
git add packages/move/crm_core/
git commit -m "feat(move): add capabilities module — GlobalConfig, AdminCap, PauseCap, RateLimit"
```

---

### Task 2.2: ACL Module

**Files:**
- Create: `packages/move/crm_core/sources/acl.move`

**Step 1: Write ACL module with bitmask permissions**

```move
// packages/move/crm_core/sources/acl.move
module crm_core::acl {
    // Permission bitmask constants
    const READ: u64     = 1;
    const WRITE: u64    = 2;
    const SHARE: u64    = 4;
    const DELETE: u64   = 8;
    const MANAGE: u64   = 16;
    const ADMIN: u64    = 31;

    // Role levels
    const ROLE_VIEWER: u8 = 0;
    const ROLE_MEMBER: u8 = 1;
    const ROLE_ADMIN: u8 = 2;
    const ROLE_OWNER: u8 = 3;

    // Errors
    const EInsufficientPermission: u64 = 200;

    public struct Role has store, copy, drop {
        level: u8,
        permissions: u64,
    }

    public fun viewer(): Role { Role { level: ROLE_VIEWER, permissions: READ } }
    public fun member(): Role { Role { level: ROLE_MEMBER, permissions: READ | WRITE } }
    public fun admin(): Role { Role { level: ROLE_ADMIN, permissions: ADMIN } }
    public fun owner(): Role { Role { level: ROLE_OWNER, permissions: ADMIN } }

    public fun has_permission(role: &Role, permission: u64): bool {
        (role.permissions & permission) == permission
    }

    public fun assert_permission(role: &Role, permission: u64) {
        assert!(has_permission(role, permission), EInsufficientPermission);
    }

    public fun level(role: &Role): u8 { role.level }
    public fun permissions(role: &Role): u64 { role.permissions }

    public fun custom_role(level: u8, permissions: u64): Role {
        Role { level, permissions }
    }

    // Permission constants accessors
    public fun perm_read(): u64 { READ }
    public fun perm_write(): u64 { WRITE }
    public fun perm_share(): u64 { SHARE }
    public fun perm_delete(): u64 { DELETE }
    public fun perm_manage(): u64 { MANAGE }
}
```

**Step 2: Test and commit**

```bash
cd packages/move/crm_core && sui move test
git add packages/move/crm_core/sources/acl.move
git commit -m "feat(move): add ACL module — bitmask RBAC permissions"
```

---

### Task 2.3: Workspace Module

**Files:**
- Create: `packages/move/crm_core/sources/workspace.move`

**Step 1: Write workspace module with MemberRecord as dynamic_object_field**

```move
// packages/move/crm_core/sources/workspace.move
module crm_core::workspace {
    use std::string::String;
    use sui::dynamic_object_field;
    use sui::dynamic_field;
    use sui::event;
    use crm_core::acl::{Self, Role};
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};

    // Errors
    const ENotOwner: u64 = 300;
    const EMemberExists: u64 = 301;
    const EMemberNotFound: u64 = 302;
    const EWorkspaceMismatch: u64 = 303;

    // ===== Structs =====

    public struct Workspace has key {
        id: UID,
        name: String,
        owner: address,
        member_count: u64,
        created_at: u64,
    }

    /// Stored as dynamic_object_field — independently queryable
    public struct MemberRecord has key, store {
        id: UID,
        workspace_id: ID,
        address: address,
        role: Role,
        joined_at: u64,
    }

    // ===== Events =====

    public struct WorkspaceCreated has copy, drop {
        workspace_id: ID,
        owner: address,
        name: String,
    }

    public struct MemberAdded has copy, drop {
        workspace_id: ID,
        member: address,
        role_level: u8,
    }

    public struct MemberRemoved has copy, drop {
        workspace_id: ID,
        member: address,
    }

    // ===== Public functions =====

    public fun create(
        config: &GlobalConfig,
        name: String,
        ctx: &mut TxContext,
    ): (Workspace, WorkspaceAdminCap) {
        capabilities::assert_not_paused(config);

        let workspace = Workspace {
            id: object::new(ctx),
            name,
            owner: ctx.sender(),
            member_count: 1,
            created_at: tx_context::epoch_timestamp_ms(ctx),
        };

        let workspace_id = object::id(&workspace);

        // Create admin cap for owner
        let admin_cap = capabilities::create_admin_cap(workspace_id, ctx);

        // Add owner as member (dynamic_object_field)
        let member = MemberRecord {
            id: object::new(ctx),
            workspace_id,
            address: ctx.sender(),
            role: acl::owner(),
            joined_at: tx_context::epoch_timestamp_ms(ctx),
        };
        dynamic_object_field::add(&mut workspace.id, ctx.sender(), member);

        event::emit(WorkspaceCreated {
            workspace_id,
            owner: ctx.sender(),
            name: workspace.name,
        });

        (workspace, admin_cap)
    }

    public fun add_member(
        config: &GlobalConfig,
        workspace: &mut Workspace,
        cap: &WorkspaceAdminCap,
        member_address: address,
        role: Role,
        ctx: &mut TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, object::id(workspace));
        assert!(
            !dynamic_object_field::exists_<address>(&workspace.id, member_address),
            EMemberExists
        );

        let member = MemberRecord {
            id: object::new(ctx),
            workspace_id: object::id(workspace),
            address: member_address,
            role,
            joined_at: tx_context::epoch_timestamp_ms(ctx),
        };
        dynamic_object_field::add(&mut workspace.id, member_address, member);
        workspace.member_count = workspace.member_count + 1;

        event::emit(MemberAdded {
            workspace_id: object::id(workspace),
            member: member_address,
            role_level: acl::level(&role),
        });
    }

    public fun remove_member(
        config: &GlobalConfig,
        workspace: &mut Workspace,
        cap: &WorkspaceAdminCap,
        member_address: address,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, object::id(workspace));
        assert!(member_address != workspace.owner, ENotOwner);

        let member: MemberRecord = dynamic_object_field::remove(
            &mut workspace.id,
            member_address,
        );
        workspace.member_count = workspace.member_count - 1;

        event::emit(MemberRemoved {
            workspace_id: object::id(workspace),
            member: member_address,
        });

        // Destroy removed member record
        let MemberRecord { id, .. } = member;
        object::delete(id);
    }

    public fun get_member_role(
        workspace: &Workspace,
        member_address: address,
    ): &Role {
        let member: &MemberRecord = dynamic_object_field::borrow(
            &workspace.id,
            member_address,
        );
        &member.role
    }

    public fun is_member(workspace: &Workspace, addr: address): bool {
        dynamic_object_field::exists_<address>(&workspace.id, addr)
    }

    // Accessors
    public fun id(w: &Workspace): ID { object::id(w) }
    public fun owner(w: &Workspace): address { w.owner }
    public fun name(w: &Workspace): &String { &w.name }
    public fun member_count(w: &Workspace): u64 { w.member_count }
}
```

**Step 2: Test and commit**

```bash
cd packages/move/crm_core && sui move test
git add packages/move/crm_core/sources/workspace.move
git commit -m "feat(move): add workspace module with MemberRecord as dynamic_object_field"
```

---

### Task 2.4: Profile Module

**Files:**
- Create: `packages/move/crm_core/sources/profile.move`

**Step 1: Write profile module with version, soft delete, dynamic_object_field for wallets**

```move
// packages/move/crm_core/sources/profile.move
module crm_core::profile {
    use std::string::String;
    use sui::dynamic_object_field;
    use sui::dynamic_field;
    use sui::event;
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};
    use crm_core::acl;

    // Errors
    const EVersionConflict: u64 = 400;
    const EWorkspaceMismatch: u64 = 401;
    const EAlreadyArchived: u64 = 402;

    // AuditEvent constants
    const ACTION_CREATE: u8 = 0;
    const ACTION_UPDATE: u8 = 1;
    const ACTION_ARCHIVE: u8 = 5;

    const OBJECT_PROFILE: u8 = 0;

    // ===== Structs =====

    public struct Profile has key, store {
        id: UID,
        workspace_id: ID,
        primary_address: address,
        suins_name: Option<String>,
        tier: u8,
        engagement_score: u64,
        tags: vector<String>,
        walrus_blob_id: Option<ID>,
        seal_policy_id: Option<ID>,
        version: u64,
        is_archived: bool,
        archived_at: Option<u64>,
        created_at: u64,
        updated_at: u64,
    }

    /// Stored as dynamic_object_field on Profile
    public struct WalletBinding has key, store {
        id: UID,
        profile_id: ID,
        address: address,
        chain: String,
        added_at: u64,
    }

    // ===== Events =====

    public struct AuditEventV1 has copy, drop {
        version: u8,
        workspace_id: ID,
        actor: address,
        action: u8,
        object_type: u8,
        object_id: ID,
        timestamp: u64,
    }

    // ===== Public functions =====

    public fun create(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        primary_address: address,
        suins_name: Option<String>,
        tags: vector<String>,
        ctx: &mut TxContext,
    ): Profile {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        let profile = Profile {
            id: object::new(ctx),
            workspace_id: workspace::id(workspace),
            primary_address,
            suins_name,
            tier: 0,
            engagement_score: 0,
            tags,
            walrus_blob_id: option::none(),
            seal_policy_id: option::none(),
            version: 0,
            is_archived: false,
            archived_at: option::none(),
            created_at: tx_context::epoch_timestamp_ms(ctx),
            updated_at: tx_context::epoch_timestamp_ms(ctx),
        };

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_CREATE,
            object_type: OBJECT_PROFILE,
            object_id: object::id(&profile),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });

        profile
    }

    public fun update_tier_and_score(
        profile: &mut Profile,
        tier: u8,
        score: u64,
        ctx: &TxContext,
    ) {
        profile.tier = tier;
        profile.engagement_score = score;
        profile.version = profile.version + 1;
        profile.updated_at = tx_context::epoch_timestamp_ms(ctx);
    }

    public fun archive(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        profile: &mut Profile,
        expected_version: u64,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(profile.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(profile.version == expected_version, EVersionConflict);
        assert!(!profile.is_archived, EAlreadyArchived);

        profile.is_archived = true;
        profile.archived_at = option::some(tx_context::epoch_timestamp_ms(ctx));
        profile.version = profile.version + 1;

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_ARCHIVE,
            object_type: OBJECT_PROFILE,
            object_id: object::id(profile),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    public fun add_wallet(
        profile: &mut Profile,
        wallet_address: address,
        chain: String,
        ctx: &mut TxContext,
    ) {
        let binding = WalletBinding {
            id: object::new(ctx),
            profile_id: object::id(profile),
            address: wallet_address,
            chain,
            added_at: tx_context::epoch_timestamp_ms(ctx),
        };
        dynamic_object_field::add(&mut profile.id, wallet_address, binding);
        profile.version = profile.version + 1;
    }

    // Dynamic field extension with access control
    public fun set_metadata<V: store + drop>(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        profile: &mut Profile,
        expected_version: u64,
        key: String,
        value: V,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(profile.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(profile.version == expected_version, EVersionConflict);

        if (dynamic_field::exists_(&profile.id, key)) {
            *dynamic_field::borrow_mut(&mut profile.id, key) = value;
        } else {
            dynamic_field::add(&mut profile.id, key, value);
        };

        profile.version = profile.version + 1;
        profile.updated_at = tx_context::epoch_timestamp_ms(ctx);

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_UPDATE,
            object_type: OBJECT_PROFILE,
            object_id: object::id(profile),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    // Accessors
    public fun workspace_id(p: &Profile): ID { p.workspace_id }
    public fun primary_address(p: &Profile): address { p.primary_address }
    public fun tier(p: &Profile): u8 { p.tier }
    public fun engagement_score(p: &Profile): u64 { p.engagement_score }
    public fun version(p: &Profile): u64 { p.version }
    public fun is_archived(p: &Profile): bool { p.is_archived }
}
```

**Step 2: Test and commit**

```bash
cd packages/move/crm_core && sui move test
git add packages/move/crm_core/sources/profile.move
git commit -m "feat(move): add profile module with version lock, soft delete, WalletBinding"
```

---

### Task 2.5: Organization & Relation Modules

**Files:**
- Create: `packages/move/crm_core/sources/organization.move`
- Create: `packages/move/crm_core/sources/relation.move`

Follow same patterns as Profile: version field, is_archived, AuditEventV1 emission, GlobalConfig+AdminCap checks on all mutating functions.

**Commit:** `feat(move): add organization and relation modules`

---

## Phase 3: Move Contracts — crm_data + crm_vault

### Task 3.1: Segment Module

**Files:**
- Create: `packages/move/crm_data/sources/segment.move`

Core struct fields: id, workspace_id, name, rule_hash, member_count, is_dynamic, created_at.
Functions: create, update_rule_hash, update_member_count.
All mutations require GlobalConfig + AdminCap.
Emit AuditEventV1.

**Commit:** `feat(move): add segment module`

### Task 3.2: Campaign Module

**Files:**
- Create: `packages/move/crm_data/sources/campaign.move`

Core struct fields: id, workspace_id, name, segment_id, status, start_time, end_time, reward_type, created_at.
Functions: create, launch, pause, complete.
Status transitions enforced: draft→active→paused→active, active→completed.

**Commit:** `feat(move): add campaign module with status state machine`

### Task 3.3: Deal & Ticket Modules

**Files:**
- Create: `packages/move/crm_data/sources/deal.move`
- Create: `packages/move/crm_data/sources/ticket.move`

Deal: stage transitions (new→qualified→proposal→won/lost), version, is_archived.
Ticket: status transitions (open→in_progress→waiting→resolved→closed), priority, SLA fields.

**Commit:** `feat(move): add deal and ticket modules`

### Task 3.4: Vault & Policy Modules

**Files:**
- Create: `packages/move/crm_vault/sources/vault.move`
- Create: `packages/move/crm_vault/sources/policy.move`

Vault object stores: walrus_blob_id, seal_policy_id, owner_profile_id, vault_type (note/file), created_at.
Policy object: access rules reference for Seal integration.

**Commit:** `feat(move): add vault and policy modules for Seal+Walrus integration`

---

## Phase 4: Move Contracts — crm_action + Display

### Task 4.1: Airdrop, Reward, Gas Sponsor Modules

**Files:**
- Create: `packages/move/crm_action/sources/airdrop.move`
- Create: `packages/move/crm_action/sources/reward.move`
- Create: `packages/move/crm_action/sources/gas_sponsor.move`

Airdrop: batch_airdrop function that takes vector of addresses and Coin.
Reward: conditional reward distribution based on campaign criteria.
Gas Sponsor: gas pool management for sponsored transactions.

**Commit:** `feat(move): add action modules — airdrop, reward, gas sponsor`

### Task 4.2: Object Display Setup

**Files:**
- Create: `packages/move/crm_core/sources/display_init.move`

Register Display<Profile>, Display<Workspace>, Display<Organization>, Display<Deal> with field templates as specified in design doc section "Object Display Standard".

**Commit:** `feat(move): add Object Display templates for all core types`

### Task 4.3: Full Contract Test Suite

**Step 1: Run all Move tests across all 4 packages**

```bash
cd packages/move/crm_core && sui move test
cd packages/move/crm_data && sui move test
cd packages/move/crm_vault && sui move test
cd packages/move/crm_action && sui move test
```

**Step 2: Deploy to localnet for integration testing**

```bash
sui client publish packages/move/crm_core --gas-budget 100000000
# Record package IDs for crm_data dependency
```

**Commit:** `test(move): full test suite passing across all 4 packages`

---

## Phase 5: Database Schema & Migrations

### Task 5.1: Install sqlx CLI and Create Migration

**Step 1: Install sqlx-cli**

```bash
cargo install sqlx-cli --features postgres
```

**Step 2: Create migration directory and initial migration**

```bash
mkdir -p packages/indexer/migrations
cd packages/indexer
sqlx database create --database-url $DATABASE_URL
```

**Step 3: Write migration file**

Create: `packages/indexer/migrations/001_initial_schema.sql`

Content: Full SQL schema from design doc Section 4 (all CREATE TABLE statements, indexes, TimescaleDB hypertables, compression and retention policies).

**Step 4: Run migration**

```bash
cd packages/indexer
sqlx migrate run --database-url $DATABASE_URL
```

**Step 5: Verify tables**

```bash
psql $DATABASE_URL -c "\dt"
# Expected: all tables listed
psql $DATABASE_URL -c "SELECT * FROM timescaledb_information.hypertables;"
# Expected: wallet_events, engagement_snapshots
```

**Commit:** `feat(db): initial schema with TimescaleDB hypertables`

---

## Phase 6: Rust Indexer

### Task 6.1: Indexer Core — Checkpoint Consumer

**Files:**
- Create: `packages/indexer/src/config.rs`
- Create: `packages/indexer/src/consumer.rs`
- Create: `packages/indexer/src/db.rs`
- Modify: `packages/indexer/src/main.rs`

Implement the checkpoint consumer using `sui-data-ingestion-core` Worker trait.
Progress tracking via `indexer_checkpoints` table.

**Commit:** `feat(indexer): checkpoint consumer with progress tracking`

### Task 6.2: Event Router & Handlers

**Files:**
- Create: `packages/indexer/src/router.rs`
- Create: `packages/indexer/src/handlers/mod.rs`
- Create: `packages/indexer/src/handlers/nft.rs`
- Create: `packages/indexer/src/handlers/defi.rs`
- Create: `packages/indexer/src/handlers/audit.rs`

Route events by type to specialized handlers.
Each handler parses event data and produces `wallet_events` rows.
Audit handler parses AuditEventV1 (checking version field) → writes `audit_logs`.

**Commit:** `feat(indexer): event router with NFT, DeFi, and audit handlers`

### Task 6.3: Batch Writer & Profile Enricher

**Files:**
- Create: `packages/indexer/src/writer.rs`
- Create: `packages/indexer/src/enricher.rs`
- Create: `packages/indexer/src/cache.rs`

Batch writer: accumulate up to 100 events or 1 second, then batch INSERT within single DB transaction (events + checkpoint update).
Enricher: resolve address → profile_id via in-memory cache with DB fallback.
Cache: `HashMap<String, Uuid>` for address→profile_id mapping.

**Commit:** `feat(indexer): batch writer with enricher and address cache`

### Task 6.4: Whale Alert Engine

**Files:**
- Create: `packages/indexer/src/alerts.rs`

Detect large transactions exceeding configurable thresholds.
POST webhook to BFF endpoint `/webhooks/indexer/whale-alert`.

**Commit:** `feat(indexer): whale alert detection with BFF webhook`

---

## Phase 7: Rust Core Service

### Task 7.1: gRPC Server Bootstrap

**Files:**
- Create: `packages/rust-core/build.rs`
- Modify: `packages/rust-core/src/main.rs`
- Create: `packages/rust-core/src/config.rs`

Set up tonic gRPC server, compile proto, connect to PostgreSQL via sqlx.

**Commit:** `feat(rust-core): gRPC server bootstrap with DB connection`

### Task 7.2: Profile Service Implementation

**Files:**
- Create: `packages/rust-core/src/server/profile_service.rs`
- Create: `packages/rust-core/src/repo/profile_repo.rs`

Implement ListProfiles (pagination, filter, sort), GetProfile, GetActivityFeed (streaming from wallet_events), Search (tsvector).

**Commit:** `feat(rust-core): profile service with list, get, activity feed, search`

### Task 7.3: Segment & Analytics Services

**Files:**
- Create: `packages/rust-core/src/server/segment_service.rs`
- Create: `packages/rust-core/src/server/analytics_service.rs`
- Create: `packages/rust-core/src/repo/segment_repo.rs`
- Create: `packages/rust-core/src/repo/analytics_repo.rs`

Segment: EvaluateSegment (rules JSON → dynamic SQL), GetSegmentMembers.
Analytics: DashboardOverview (aggregate queries), RecalculateScores, WhaleAlert stream.

**Commit:** `feat(rust-core): segment evaluation and analytics services`

### Task 7.4: Score Engine & Segment Engine

**Files:**
- Create: `packages/rust-core/src/engine/score_engine.rs`
- Create: `packages/rust-core/src/engine/segment_engine.rs`
- Create: `packages/rust-core/src/engine/search_engine.rs`

Score engine: batch recalculate engagement scores per workspace weight config.
Segment engine: parse rules JSONB → generate dynamic SQL WHERE clauses.
Search engine: multi-table tsvector search (profiles + organizations).

**Commit:** `feat(rust-core): score, segment, and search engines`

### Task 7.5: Scheduler

**Files:**
- Create: `packages/rust-core/src/scheduler/mod.rs`
- Create: `packages/rust-core/src/scheduler/score_recalc.rs`
- Create: `packages/rust-core/src/scheduler/segment_refresh.rs`
- Create: `packages/rust-core/src/scheduler/snapshot.rs`

Tokio-based cron: score recalc every 5 min, segment refresh every 10 min, snapshots every hour.

**Commit:** `feat(rust-core): scheduled tasks for score, segment, and snapshot`

---

## Phase 8: BFF — Auth & Workspace

### Task 8.1: Auth Module — Wallet Signature Verification

**Files:**
- Create: `packages/bff/src/auth/auth.module.ts`
- Create: `packages/bff/src/auth/auth.controller.ts`
- Create: `packages/bff/src/auth/auth.service.ts`
- Create: `packages/bff/src/auth/strategies/wallet.strategy.ts`
- Create: `packages/bff/src/auth/guards/session.guard.ts`
- Create: `packages/bff/src/auth/guards/rbac.guard.ts`
- Create: `packages/bff/src/auth/decorators/current-user.ts`
- Create: `packages/bff/src/auth/decorators/permissions.ts`

Wallet strategy: verify signed message → derive address → lookup workspace_members → issue JWT.
Session guard: validate httpOnly cookie JWT on every request.
RBAC guard: check bitmask permissions via @RequirePermissions() decorator.

**Commit:** `feat(bff): auth module with wallet signature verification and RBAC`

### Task 8.2: Auth Module — ZkLogin & Passkey

**Files:**
- Create: `packages/bff/src/auth/strategies/zklogin.strategy.ts`
- Create: `packages/bff/src/auth/strategies/passkey.strategy.ts`

ZkLogin: verify Google JWT → generate ZK proof → derive Sui address → issue session.
Passkey: WebAuthn registration/authentication flow.

**Commit:** `feat(bff): ZkLogin and Passkey authentication strategies`

### Task 8.3: Workspace Module

**Files:**
- Create: `packages/bff/src/workspace/workspace.module.ts`
- Create: `packages/bff/src/workspace/workspace.controller.ts`
- Create: `packages/bff/src/workspace/workspace.service.ts`

CRUD: create workspace (→ Sui tx + PG), invite/remove members, update roles.
All mutations: (1) submit Sui tx, (2) optimistic PG write.

**Commit:** `feat(bff): workspace CRUD with Sui tx + PG dual-write`

### Task 8.4: Blockchain Client & TX Builder

**Files:**
- Create: `packages/bff/src/blockchain/sui.client.ts`
- Create: `packages/bff/src/blockchain/tx-builder.service.ts`
- Create: `packages/bff/src/blockchain/suins.service.ts`

Sui client: wrap @mysten/sui with GraphQL transport (NOT JSON-RPC).
TX builder: construct Move call transactions for all contract modules.
SuiNS: resolve .sui names ↔ addresses.

**Commit:** `feat(bff): Sui client (GraphQL transport), TX builder, SuiNS resolver`

### Task 8.5: gRPC Client for Rust Core

**Files:**
- Create: `packages/bff/src/grpc/rust-core.client.ts`

Connect to Rust Core via gRPC. Typed client generated from proto/core.proto.

**Commit:** `feat(bff): gRPC client for Rust Core service`

---

## Phase 9: BFF — Profile, Org, Deal, Segment

### Task 9.1: Profile Module

**Files:**
- Create: `packages/bff/src/profile/profile.module.ts`
- Create: `packages/bff/src/profile/profile.controller.ts`
- Create: `packages/bff/src/profile/profile.service.ts`

Thin layer: writes → Sui tx + PG, reads → gRPC proxy to Rust Core.
Endpoints: GET/POST/PATCH /profiles, GET /profiles/:id/activity, GET /profiles/:id/assets.

**Commit:** `feat(bff): profile module with Sui tx writes and gRPC reads`

### Task 9.2: Organization Module

Similar pattern to Profile. CRUD with Sui tx + PG.

**Commit:** `feat(bff): organization module`

### Task 9.3: Deal Module

Pipeline management. Stage transitions trigger Sui tx.
Endpoints include GET /deals/pipeline/stats.

**Commit:** `feat(bff): deal module with pipeline management`

### Task 9.4: Segment Module

Create segment: store rules JSONB in PG, store rule_hash on-chain.
Evaluate: trigger Rust Core gRPC EvaluateSegment.

**Commit:** `feat(bff): segment module with rule storage and evaluation trigger`

---

## Phase 10: BFF — Campaign, Vault, Messaging

### Task 10.1: Campaign Module & Workflow Engine

**Files:**
- Create: `packages/bff/src/campaign/campaign.module.ts`
- Create: `packages/bff/src/campaign/campaign.controller.ts`
- Create: `packages/bff/src/campaign/campaign.service.ts`
- Create: `packages/bff/src/campaign/workflow/workflow.engine.ts`
- Create: `packages/bff/src/campaign/workflow/actions/send-telegram.ts`
- Create: `packages/bff/src/campaign/workflow/actions/send-discord.ts`
- Create: `packages/bff/src/campaign/workflow/actions/airdrop-token.ts`

Workflow engine: match indexer webhook events against active campaign triggers → execute action chain.

**Commit:** `feat(bff): campaign module with workflow engine and action plugins`

### Task 10.2: Vault Module (Seal + Walrus Proxy)

**Files:**
- Create: `packages/bff/src/vault/vault.module.ts`
- Create: `packages/bff/src/vault/vault.controller.ts`
- Create: `packages/bff/src/vault/vault.service.ts`
- Create: `packages/bff/src/vault/walrus.client.ts`

IMPORTANT: BFF only proxies encrypted blobs. Never sees plaintext.
Upload: receive encrypted_blob from frontend → upload to Walrus → record on-chain.
Download: fetch encrypted_blob from Walrus → return to frontend for client-side decryption.

**Commit:** `feat(bff): vault module — encrypted blob proxy (client-side encryption only)`

### Task 10.3: Messaging Module

**Files:**
- Create: `packages/bff/src/messaging/messaging.module.ts`
- Create: `packages/bff/src/messaging/telegram.service.ts`
- Create: `packages/bff/src/messaging/discord.service.ts`
- Create: `packages/bff/src/messaging/email.service.ts`

Telegram: bot API for sending messages and receiving webhooks.
Discord: bot API for role management and channel posting.
Email: SendGrid/Mailgun integration as fallback channel.

**Commit:** `feat(bff): messaging module — Telegram, Discord, Email integrations`

### Task 10.4: Job Queue & Scheduled Tasks

**Files:**
- Create: `packages/bff/src/jobs/segment-eval.job.ts`
- Create: `packages/bff/src/jobs/campaign-scheduler.job.ts`
- Create: `packages/bff/src/jobs/sla-checker.job.ts`
- Create: `packages/bff/src/jobs/sync-onchain.job.ts`

BullMQ jobs: segment evaluation scheduling, campaign message dispatch, SLA deadline checks, on-chain→PG reconciliation.

**Commit:** `feat(bff): background jobs — segment eval, campaign scheduler, SLA checker`

### Task 10.5: Audit Log Interceptor & Common Middleware

**Files:**
- Create: `packages/bff/src/common/interceptors/audit-log.interceptor.ts`
- Create: `packages/bff/src/common/filters/http-exception.filter.ts`

NestJS interceptor: auto-capture POST/PATCH/DELETE → write audit_logs.
Global exception filter: structured error responses.

**Commit:** `feat(bff): audit log interceptor and global error handling`

---

## Phase 11: Frontend — Shell & Auth

### Task 11.1: App Shell — Layout, Sidebar, Topbar

**Files:**
- Create: `packages/frontend/src/app/(dashboard)/layout.tsx`
- Create: `packages/frontend/src/components/layout/sidebar.tsx`
- Create: `packages/frontend/src/components/layout/topbar.tsx`
- Create: `packages/frontend/src/components/layout/command-palette.tsx`
- Create: `packages/frontend/src/stores/ui-store.ts`

Sidebar: navigation links to all modules.
Topbar: workspace selector, user avatar, notification bell.
Command palette: Cmd+K global search (calls GET /search).

**Commit:** `feat(frontend): app shell with sidebar, topbar, and command palette`

### Task 11.2: Auth Flow — Login Page

**Files:**
- Create: `packages/frontend/src/app/(auth)/login/page.tsx`
- Create: `packages/frontend/src/app/(auth)/layout.tsx`
- Create: `packages/frontend/src/lib/blockchain/sui-provider.tsx`
- Create: `packages/frontend/src/lib/blockchain/zklogin.ts`
- Create: `packages/frontend/src/lib/blockchain/passkey.ts`
- Create: `packages/frontend/src/stores/auth-store.ts`

Login page: three login options (Google ZkLogin, Wallet Connect, Passkey).
SuiProvider: @mysten/dapp-kit provider wrapping the app.
Auth store: Zustand store for session state.

**Commit:** `feat(frontend): login page with ZkLogin, Wallet, and Passkey auth`

### Task 11.3: API Client & React Query Setup

**Files:**
- Create: `packages/frontend/src/lib/api/client.ts`
- Create: `packages/frontend/src/lib/hooks/use-profiles.ts`
- Create: `packages/frontend/src/lib/hooks/use-deals.ts`
- Create: `packages/frontend/src/lib/hooks/use-realtime.ts`
- Create: `packages/frontend/src/stores/workspace-store.ts`

API client: fetch wrapper with auth header injection, error handling.
React Query hooks: typed hooks for each BFF endpoint.
WebSocket hook: connect to BFF WebSocket for realtime events.

**Commit:** `feat(frontend): API client, React Query hooks, and WebSocket setup`

---

## Phase 12: Frontend — Core Pages

### Task 12.1: Dashboard Page

**Files:**
- Create: `packages/frontend/src/app/(dashboard)/page.tsx`
- Create: `packages/frontend/src/components/charts/score-distribution.tsx`
- Create: `packages/frontend/src/components/charts/activity-heatmap.tsx`
- Create: `packages/frontend/src/components/charts/pipeline-funnel.tsx`

Overview cards: active wallets, tier distribution, pipeline total, open tickets.
Charts: Recharts-based visualizations.

**Commit:** `feat(frontend): dashboard page with overview cards and charts`

### Task 12.2: Profiles Page — List & Detail

**Files:**
- Create: `packages/frontend/src/app/(dashboard)/profiles/page.tsx`
- Create: `packages/frontend/src/app/(dashboard)/profiles/[id]/page.tsx`
- Create: `packages/frontend/src/components/profile/profile-card.tsx`
- Create: `packages/frontend/src/components/profile/profile-timeline.tsx`
- Create: `packages/frontend/src/components/profile/asset-gallery.tsx`
- Create: `packages/frontend/src/components/profile/engagement-badge.tsx`
- Create: `packages/frontend/src/components/shared/data-table.tsx`
- Create: `packages/frontend/src/components/shared/address-display.tsx`
- Create: `packages/frontend/src/components/shared/tier-badge.tsx`

List: data table with filter/sort/search, tier badges, engagement scores.
Detail: 360° profile view with activity timeline, asset gallery, notes, related orgs.

**Commit:** `feat(frontend): profiles list and 360° detail page`

### Task 12.3: Deals Page — Kanban Pipeline

**Files:**
- Create: `packages/frontend/src/app/(dashboard)/deals/page.tsx`
- Create: `packages/frontend/src/app/(dashboard)/deals/[id]/page.tsx`
- Create: `packages/frontend/src/components/deal/kanban-board.tsx`
- Create: `packages/frontend/src/components/deal/deal-card.tsx`

Kanban: dnd-kit drag-and-drop board. Stage columns. Drag to change stage → PATCH /deals/:id.

**Commit:** `feat(frontend): deals pipeline with Kanban drag-and-drop`

### Task 12.4: Segments Page — Rule Builder

**Files:**
- Create: `packages/frontend/src/app/(dashboard)/segments/page.tsx`
- Create: `packages/frontend/src/app/(dashboard)/segments/new/page.tsx`
- Create: `packages/frontend/src/app/(dashboard)/segments/[id]/page.tsx`
- Create: `packages/frontend/src/components/segment/rule-builder.tsx`

Visual rule builder: AND/OR groups, condition rows (field, operator, value).
Preview: show matching count before saving.

**Commit:** `feat(frontend): segments with visual rule builder`

---

## Phase 13: Frontend — Advanced Features

### Task 13.1: Campaign Page & Workflow Canvas

**Files:**
- Create: `packages/frontend/src/app/(dashboard)/campaigns/page.tsx`
- Create: `packages/frontend/src/app/(dashboard)/campaigns/[id]/page.tsx`
- Create: `packages/frontend/src/app/(dashboard)/campaigns/[id]/workflow/page.tsx`
- Create: `packages/frontend/src/components/campaign/workflow-canvas.tsx`
- Create: `packages/frontend/src/components/campaign/campaign-stats.tsx`

Workflow canvas: React Flow node-based editor. Trigger nodes → action nodes.
Campaign stats: sent/opened/converted metrics.

**Commit:** `feat(frontend): campaign management with React Flow workflow builder`

### Task 13.2: Vault — Encrypted Notes & Files

**Files:**
- Create: `packages/frontend/src/app/(dashboard)/vault/notes/page.tsx`
- Create: `packages/frontend/src/app/(dashboard)/vault/files/page.tsx`
- Create: `packages/frontend/src/components/vault/encrypted-note-editor.tsx`
- Create: `packages/frontend/src/components/vault/file-uploader.tsx`
- Create: `packages/frontend/src/lib/blockchain/seal-client.ts`

Seal client: encrypt in browser before sending to BFF, decrypt after receiving.
Note editor: rich text editor → encrypt → upload.
File uploader: encrypt file → upload encrypted blob.

**Commit:** `feat(frontend): encrypted vault with client-side Seal encryption`

### Task 13.3: Tickets, Organizations, Settings Pages

**Files:**
- Create: `packages/frontend/src/app/(dashboard)/tickets/page.tsx`
- Create: `packages/frontend/src/app/(dashboard)/organizations/page.tsx`
- Create: `packages/frontend/src/app/(dashboard)/settings/workspace/page.tsx`
- Create: `packages/frontend/src/app/(dashboard)/settings/members/page.tsx`

Standard CRUD pages with data tables, forms, and role management.

**Commit:** `feat(frontend): tickets, organizations, and settings pages`

### Task 13.4: Analytics Page

**Files:**
- Create: `packages/frontend/src/app/(dashboard)/analytics/page.tsx`

Mixed on-chain + CRM analytics: retention by NFT holding, campaign conversion rates, engagement trends.

**Commit:** `feat(frontend): analytics page with mixed on-chain/CRM reports`

---

## Phase 14: Integration & E2E Testing

### Task 14.1: Contract → Indexer → Rust Core Integration Test

**Step 1:** Deploy contracts to localnet
**Step 2:** Create test workspace + profiles via CLI
**Step 3:** Verify indexer captures events → writes to PG
**Step 4:** Verify Rust Core returns correct data via gRPC

**Commit:** `test: contract → indexer → rust-core integration test`

### Task 14.2: BFF E2E Test

**Step 1:** Start all services locally (docker-compose + manual)
**Step 2:** Test auth flow: wallet login → JWT → protected endpoint
**Step 3:** Test profile CRUD: create → verify on-chain + PG
**Step 4:** Test campaign workflow: mock indexer webhook → verify action execution

**Commit:** `test: BFF E2E tests for auth, CRUD, and campaign workflow`

### Task 14.3: Frontend Smoke Tests

**Step 1:** Vitest + React Testing Library for critical components
**Step 2:** Test: login flow, profile list rendering, Kanban drag, rule builder

**Commit:** `test: frontend smoke tests for critical flows`

---

## Phase 15: Docker Deployment & Monitoring

### Task 15.1: Dockerfiles for All Services

**Files:**
- Create: `packages/frontend/Dockerfile`
- Create: `packages/bff/Dockerfile`
- Create: `packages/rust-core/Dockerfile`
- Create: `packages/indexer/Dockerfile`

Multi-stage builds for minimal image size.

**Commit:** `chore: Dockerfiles for all services`

### Task 15.2: Production Docker Compose

**Files:**
- Create: `docker-compose.prod.yml`
- Create: `traefik/traefik.yml`
- Create: `traefik/dynamic.yml`

Traefik: SSL termination (Let's Encrypt), routing rules, rate limiting.
All services: health checks, restart policies, resource limits.

**Commit:** `chore: production docker-compose with Traefik SSL`

### Task 15.3: Monitoring Stack

**Files:**
- Create: `monitoring/prometheus.yml`
- Create: `monitoring/grafana/dashboards/crm.json`
- Create: `monitoring/loki-config.yml`

Prometheus: scrape BFF /metrics, Rust Core /metrics, PG exporter.
Grafana: API latency, error rate, indexer lag, DB connections dashboards.
Loki: centralized log aggregation.
Alert rules: as defined in design doc.

**Commit:** `chore: monitoring stack — Prometheus, Grafana, Loki`

### Task 15.4: CI/CD Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-staging.yml`
- Create: `.github/workflows/deploy-prod.yml`

CI: Move test + TS typecheck/lint/test + Rust test/clippy + proto lint.
Staging: auto-deploy on merge to main.
Production: manual trigger on tag v*.*.*.

**Commit:** `chore: CI/CD pipeline — PR checks, staging auto-deploy, prod manual deploy`

---

## Execution Notes

### Parallelization Strategy

Three parallel workstreams from Phase 1 completion:

| Stream | Phases | Focus |
|---|---|---|
| **Move** | 2 → 3 → 4 | Smart contracts + tests |
| **Backend** | 5 → 6 + 7 (parallel) → 8 → 9 → 10 | DB + Indexer + Rust Core + BFF |
| **Frontend** | 11 → 12 → 13 | UI pages and components |

Phase 14 (Integration) requires all three streams complete.
Phase 15 (Deploy) can start in parallel with Phase 14.

### Risk Areas

1. **Sui SDK GraphQL transport** — verify @mysten/sui supports GraphQL before Phase 8.4
2. **Seal SDK integration** — Seal is relatively new; prototype early in Phase 10.2 / 13.2
3. **sui-data-ingestion crate** — API may differ from documented; prototype in Phase 6.1
4. **ZkLogin flow** — complex multi-step; prototype before full implementation in Phase 8.2

### MVP Cut Line

If time-constrained, these can be deferred post-MVP:
- Phase 13.1 (Campaign workflow canvas) — replace with simple form
- Phase 13.4 (Analytics) — replace with basic stats
- Passkey auth — launch with ZkLogin + Wallet only
- Ticket module — defer to Phase 2 product
- Gas sponsor module — defer until real Web2 users onboard
