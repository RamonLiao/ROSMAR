# Decentralized CRM - System Architecture Design

**Version**: v1.1
**Date**: 2026-02-15
**Status**: Approved (v1.1 — architecture review improvements applied)
**Scope**: Production MVP - Full system architecture

---

## 1. Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| MVP Scope | Production MVP | Target real customers (NFT projects), not just demo |
| Architecture Pattern | BFF (Backend-for-Frontend) | TS handles auth/business/SDK integration; Rust handles perf-critical queries |
| Backend API | Rust (hot path) + TypeScript (business logic) | Best performance for high-frequency queries, TS for rapid business iteration |
| Database | PostgreSQL + TimescaleDB | JOIN-intensive CRM queries + time-series chain events in single DB |
| Multi-tenant | Row-level (workspace_id) | Simplest, lowest ops cost, sufficient for MVP scale |
| On-chain Strategy | Medium on-chain + dynamic_field/dynamic_object_field | Core metadata on-chain for composability; dynamic_object_field for externally queryable sub-objects, dynamic_field for pure values |
| Frontend | Next.js (App Router) + Tailwind + Shadcn | SSR support, modern DX, spec-aligned |
| Indexer | Self-built Rust (sui-data-ingestion) | Full control, best performance, official Sui crate |
| Auth | ZkLogin + Wallet + Passkey | Complete coverage: Web2 users, crypto natives, passwordless |
| Deployment | Docker + VPS | Simple, sufficient for MVP, easy to operate |

---

## 2. System Overview & Service Boundaries

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  Next.js App (App Router) + Tailwind + Shadcn                    │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐            │
│  │ZkLogin  │ │Wallet    │ │Passkey   │ │Seal Client│            │
│  │SDK      │ │Adapter   │ │WebAuthn  │ │(decrypt)  │            │
│  └─────────┘ └──────────┘ └──────────┘ └───────────┘            │
└──────────────────────┬───────────────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼───────────────────────────────────────────┐
│                    BFF LAYER (NestJS)                             │
│                                                                  │
│  ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────────┐  │
│  │Auth      │ │Campaign   │ │Messaging  │ │Seal/Walrus       │  │
│  │Module    │ │Module     │ │Module     │ │Integration       │  │
│  ├──────────┤ ├───────────┤ ├───────────┤ ├──────────────────┤  │
│  │Session   │ │Workflow   │ │Telegram   │ │Encrypt/Decrypt   │  │
│  │RBAC      │ │Scheduler  │ │Discord    │ │Blob Management   │  │
│  │ZkLogin   │ │Job Queue  │ │Email      │ │Policy CRUD       │  │
│  └──────────┘ └───────────┘ └───────────┘ └──────────────────┘  │
│                       │ gRPC (internal)                          │
└───────────────────────┼──────────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────────┐
│                 RUST CORE SERVICE (Axum + tonic)                  │
│                                                                  │
│  ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────────┐  │
│  │Profile   │ │Activity   │ │Segment    │ │Search            │  │
│  │Engine    │ │Feed       │ │Engine     │ │Engine            │  │
│  ├──────────┤ ├───────────┤ ├───────────┤ ├──────────────────┤  │
│  │CRUD      │ │Timeline   │ │Rule eval  │ │Full-text search  │  │
│  │Aggregate │ │Streaming  │ │Score calc │ │Filter/Sort       │  │
│  │Net worth │ │Whale alert│ │Membership │ │Cmd+K quick find  │  │
│  └──────────┘ └───────────┘ └───────────┘ └──────────────────┘  │
└───────────────────────┬──────────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────────┐
│                    DATA LAYER                                     │
│                                                                  │
│  ┌─────────────────────────┐  ┌────────────────────────────────┐ │
│  │ PostgreSQL + TimescaleDB│  │ Rust Indexer                   │ │
│  │ ┌─────────┐ ┌─────────┐│  │ (sui-data-ingestion)           │ │
│  │ │CRM Table│ │Hyper-   ││  │ ┌────────┐ ┌────────┐          │ │
│  │ │(regular)│ │table    ││  │ │Mint    │ │DeFi   │          │ │
│  │ │profiles │ │(events) ││  │ │listener│ │tracker│ ...      │ │
│  │ │orgs     │ │wallet_  ││  │ └────────┘ └────────┘          │ │
│  │ │deals    │ │activity ││  └──────────────┬─────────────────┘ │
│  │ │campaigns│ │         ││                 │                   │
│  │ └─────────┘ └─────────┘│◄────────────────┘                   │
│  └─────────────────────────┘                                     │
└──────────────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────────┐
│                  BLOCKCHAIN LAYER                                 │
│                                                                  │
│  ┌─────────────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ Sui Network     │  │ Walrus   │  │ Seal     │  │ SuiNS     │ │
│  │ Move Contracts  │  │ Blob     │  │ Encrypt  │  │ Name      │ │
│  │ - Profile       │  │ Storage  │  │ + Policy │  │ Resolver  │ │
│  │ - Workspace     │  │          │  │          │  │           │ │
│  │ - ACL           │  │          │  │          │  │           │ │
│  │ - Audit Events  │  │          │  │          │  │           │ │
│  └─────────────────┘  └──────────┘  └──────────┘  └───────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Service Responsibilities

| Service | Responsible For | NOT Responsible For |
|---|---|---|
| **Next.js** | UI rendering, client-side Seal decryption, wallet signing | Any business logic |
| **BFF (NestJS)** | Auth/session, business orchestration, Seal/Walrus server ops, external integrations (TG/Discord), job queue | High-frequency queries, score calculation |
| **Rust Core** | Profile/Activity/Segment high-perf queries, engagement score calc, full-text search, whale alert | Auth, external API integrations |
| **Rust Indexer** | Chain event listening → DB writes | Any API responses |
| **Sui Contracts** | Ownership, ACL, core metadata, audit events | Business query logic |

### Communication Protocols

| Path | Protocol | Rationale |
|---|---|---|
| Frontend → BFF | HTTPS REST + WebSocket (realtime) | Standard web |
| BFF → Rust Core | gRPC (tonic) | Type-safe, efficient, streaming support |
| BFF → Sui/Walrus/Seal | Sui TS SDK (GraphQL transport) / Walrus SDK / Seal SDK | Official SDKs are TS-first. MUST use GraphQL, NOT JSON-RPC (deprecated, removed April 2026) |
| Indexer → DB | Direct SQL (sqlx) | Maximum write performance |
| Indexer → Sui | sui-data-ingestion crate | Official Rust solution |

---

## 3. Move Contract Architecture

### Package Structure

```
move/
├── crm_core/           # Core modules (stable, rarely upgraded)
│   ├── workspace.move      # Workspace (tenant) management
│   ├── profile.move        # Customer Profile
│   ├── organization.move   # Organization/DAO/Project
│   ├── relation.move       # Profile <-> Organization relations
│   ├── acl.move            # Role-based access control (bitmask RBAC)
│   ├── capabilities.move   # AdminCap, EmergencyPauseCap, GlobalConfig
│   └── display_init.move   # Object Display setup for all core types
│
├── crm_data/           # Data & activity modules
│   ├── segment.move        # Segment rule definitions
│   ├── campaign.move       # Campaign on-chain records
│   ├── deal.move           # Sales pipeline deals
│   └── ticket.move         # Support tickets
│
├── crm_vault/          # Privacy & storage modules
│   ├── vault.move          # Seal encrypted blob pointer management
│   └── policy.move         # Seal access policy definitions
│
└── crm_action/         # On-chain action modules (frequently iterated)
    ├── airdrop.move        # Batch airdrop
    ├── reward.move         # Conditional rewards
    └── gas_sponsor.move    # Gas sponsorship
```

Split into 4 packages for independent upgrade cycles. `crm_core` should be stable; `crm_action` iterates frequently.

### Core Object Definitions

```move
// ===== crm_core::capabilities =====

/// Capability for workspace-level admin operations
public struct WorkspaceAdminCap has key, store {
    id: UID,
    workspace_id: ID,
}

/// Capability for emergency pause — freezes all contract operations
public struct EmergencyPauseCap has key, store {
    id: UID,
}

/// Global config — shared object, checked by all entry functions
public struct GlobalConfig has key {
    id: UID,
    paused: bool,
    pause_reason: Option<String>,
}

/// Rate limiting config per workspace
public struct RateLimitConfig has key {
    id: UID,
    workspace_id: ID,
    max_operations_per_epoch: u64,
    current_epoch: u64,
    current_count: u64,
}

// ===== crm_core::workspace =====
public struct Workspace has key {
    id: UID,
    name: String,
    owner: address,
    member_count: u64,
    created_at: u64,
    // dynamic_object_field: member_address -> MemberRecord  (independently queryable)
    // dynamic_field: "settings" -> WorkspaceSettings         (pure value, internal only)
    // dynamic_field: "score_weights" -> ScoreWeightConfig     (pure value, internal only)
}

/// Stored as dynamic_object_field on Workspace — independently queryable via GraphQL
public struct MemberRecord has key, store {
    id: UID,
    workspace_id: ID,
    address: address,
    role: Role,
    joined_at: u64,
}

public struct Role has store, copy, drop {
    level: u8,        // 0=viewer, 1=member, 2=admin, 3=owner
    permissions: u64, // bitmask: read|write|share|manage|...
}

// ===== crm_core::profile =====
public struct Profile has key, store {
    id: UID,
    workspace_id: ID,
    primary_address: address,
    suins_name: Option<String>,
    tier: u8,                     // 0=dormant, 1=active, 2=core, 3=vip, 4=whale
    engagement_score: u64,
    tags: vector<String>,
    walrus_blob_id: Option<ID>,
    seal_policy_id: Option<ID>,
    version: u64,                 // optimistic lock — increment on every update
    is_archived: bool,            // soft delete — never hard delete CRM data
    archived_at: Option<u64>,
    created_at: u64,
    updated_at: u64,
    // dynamic_object_field: wallet_address -> WalletBinding  (independently queryable by indexer)
    // dynamic_field: "socials" -> Table<String, String>       (pure value, accessed via profile)
}

/// Stored as dynamic_object_field on Profile — indexer can query "which profile owns this wallet?"
public struct WalletBinding has key, store {
    id: UID,
    profile_id: ID,
    address: address,
    chain: String,                // "sui", "evm", "solana"
    added_at: u64,
}

// ===== crm_core::organization =====
public struct Organization has key, store {
    id: UID,
    workspace_id: ID,
    name: String,
    org_type: u8,                 // 0=company, 1=dao, 2=protocol, 3=nft_project
    primary_address: Option<address>,
    tags: vector<String>,
    walrus_blob_id: Option<ID>,
    seal_policy_id: Option<ID>,
    version: u64,
    is_archived: bool,
    created_at: u64,
}

// ===== crm_core::relation =====
public struct Relation has key, store {
    id: UID,
    workspace_id: ID,
    profile_id: ID,
    org_id: ID,
    role_label: String,           // "Founder", "Investor", "Advisor"
    since: u64,
}

// ===== crm_data::deal =====
public struct Deal has key, store {
    id: UID,
    workspace_id: ID,
    title: String,
    stage: u8,                    // 0=new, 1=qualified, 2=proposal, 3=won, 4=lost
    value_token: Option<String>,
    value_amount: u64,
    assignee: address,
    profile_id: Option<ID>,
    org_id: Option<ID>,
    walrus_blob_id: Option<ID>,
    seal_policy_id: Option<ID>,
    version: u64,
    is_archived: bool,
    created_at: u64,
    updated_at: u64,
}

// ===== crm_data::segment =====
public struct Segment has key, store {
    id: UID,
    workspace_id: ID,
    name: String,
    rule_hash: vector<u8>,        // Hash of rules JSON (tamper-proof)
    member_count: u64,
    is_dynamic: bool,
    created_at: u64,
}

// ===== crm_data::campaign =====
public struct Campaign has key, store {
    id: UID,
    workspace_id: ID,
    name: String,
    segment_id: ID,
    status: u8,                   // 0=draft, 1=active, 2=paused, 3=completed
    start_time: u64,
    end_time: Option<u64>,
    reward_type: Option<u8>,      // 0=token, 1=nft, 2=role, 3=none
    created_at: u64,
}
```

### Dynamic Field Strategy

```
Rule: Use dynamic_object_field when external tools need to query the value independently.
      Use dynamic_field for pure config/values accessed only through the parent object.

┌─────────────────────┬──────────────────────┬────────────────────────────────┐
│ Data                │ Field Type           │ Reason                         │
├─────────────────────┼──────────────────────┼────────────────────────────────┤
│ MemberRecord        │ dynamic_object_field │ Query "what roles does 0x123   │
│                     │                      │ have across workspaces?"       │
│ WalletBinding       │ dynamic_object_field │ Indexer queries "which profile │
│                     │                      │ owns wallet 0xabc?"            │
│ Workspace settings  │ dynamic_field        │ Pure config, only admin reads  │
│ Score weights       │ dynamic_field        │ Pure config, only engine reads │
│ Social links        │ dynamic_field        │ Key-value, accessed via profile│
└─────────────────────┴──────────────────────┴────────────────────────────────┘
```

### Dynamic Field Extension (with access control)

```move
// Generic metadata add/get/remove — requires workspace admin permission
public fun set_field<V: store + drop>(
    config: &GlobalConfig,
    workspace: &Workspace,
    admin_cap: &WorkspaceAdminCap,
    profile: &mut Profile,
    expected_version: u64,        // optimistic lock
    key: String,
    value: V,
    ctx: &TxContext,
) {
    // 1. Check global pause
    assert!(!config.paused, EPaused);
    // 2. Verify capability matches workspace
    assert!(admin_cap.workspace_id == object::id(workspace), ECapMismatch);
    // 3. Verify profile belongs to workspace
    assert!(profile.workspace_id == object::id(workspace), EWorkspaceMismatch);
    // 4. Optimistic lock check
    assert!(profile.version == expected_version, EVersionConflict);

    if (dynamic_field::exists_(&profile.id, key)) {
        *dynamic_field::borrow_mut(&mut profile.id, key) = value;
    } else {
        dynamic_field::add(&mut profile.id, key, value);
    };

    profile.version = profile.version + 1;
    profile.updated_at = tx_context::epoch_timestamp_ms(ctx);

    // Emit audit event
    event::emit(AuditEventV1 {
        version: 1,
        workspace_id: object::id(workspace),
        actor: ctx.sender(),
        action: ACTION_UPDATE,
        object_type: OBJECT_PROFILE,
        object_id: object::id(profile),
        timestamp: tx_context::epoch_timestamp_ms(ctx),
    });
}

public fun get_field<V: store>(profile: &Profile, key: String): &V {
    dynamic_field::borrow(&profile.id, key)
}

public fun remove_field<V: store + drop>(
    config: &GlobalConfig,
    workspace: &Workspace,
    admin_cap: &WorkspaceAdminCap,
    profile: &mut Profile,
    expected_version: u64,
    key: String,
    ctx: &TxContext,
): V {
    assert!(!config.paused, EPaused);
    assert!(admin_cap.workspace_id == object::id(workspace), ECapMismatch);
    assert!(profile.workspace_id == object::id(workspace), EWorkspaceMismatch);
    assert!(profile.version == expected_version, EVersionConflict);

    profile.version = profile.version + 1;
    dynamic_field::remove(&mut profile.id, key)
}
```

### Audit Events (versioned)

```move
// Versioned event — Indexer routes by version field for forward compatibility
public struct AuditEventV1 has copy, drop {
    version: u8,       // = 1, future upgrades can emit V2 with new fields
    workspace_id: ID,
    actor: address,
    action: u8,        // CREATE=0, UPDATE=1, DELETE=2, SHARE=3, REVOKE=4, ARCHIVE=5
    object_type: u8,   // PROFILE=0, ORG=1, DEAL=2, SEGMENT=3, CAMPAIGN=4, VAULT=5
    object_id: ID,
    timestamp: u64,
}

// Constants for action and object_type enums
const ACTION_CREATE: u8 = 0;
const ACTION_UPDATE: u8 = 1;
const ACTION_DELETE: u8 = 2;
const ACTION_SHARE: u8 = 3;
const ACTION_REVOKE: u8 = 4;
const ACTION_ARCHIVE: u8 = 5;

const OBJECT_PROFILE: u8 = 0;
const OBJECT_ORG: u8 = 1;
const OBJECT_DEAL: u8 = 2;
const OBJECT_SEGMENT: u8 = 3;
const OBJECT_CAMPAIGN: u8 = 4;
const OBJECT_VAULT: u8 = 5;
```

### ACL Permission Model

```move
const READ: u64     = 1;      // 0b000001
const WRITE: u64    = 2;      // 0b000010
const SHARE: u64    = 4;      // 0b000100
const DELETE: u64   = 8;      // 0b001000
const MANAGE: u64   = 16;     // 0b010000
const ADMIN: u64    = 31;     // 0b011111

// Preset roles:
// Viewer:  READ
// Member:  READ | WRITE
// Admin:   READ | WRITE | SHARE | DELETE | MANAGE
// Owner:   ADMIN
```

Note: Bitmask RBAC handles fine-grained permissions (read/write/share).
Capability objects (WorkspaceAdminCap, EmergencyPauseCap) handle coarse-grained system operations.
Both work together for complete access control.

### Object Display Standard

All core objects must register Display templates for proper rendering in
Sui Explorer, wallets, and third-party dApps.

```move
// ===== crm_core::display_init =====
fun init(otw: CRM_CORE, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);

    // Profile Display
    let profile_display = display::new_with_fields<Profile>(
        &publisher,
        vector[
            string::utf8(b"name"),
            string::utf8(b"description"),
            string::utf8(b"image_url"),
            string::utf8(b"project_url"),
        ],
        vector[
            string::utf8(b"{suins_name}"),
            string::utf8(b"CRM Profile | Tier: {tier} | Score: {engagement_score}"),
            string::utf8(b"https://app.crm.xyz/api/avatar/{primary_address}"),
            string::utf8(b"https://app.crm.xyz/profiles/{id}"),
        ],
        ctx,
    );
    display::update_version(&mut profile_display);

    // Workspace Display
    let workspace_display = display::new_with_fields<Workspace>(
        &publisher,
        vector[
            string::utf8(b"name"),
            string::utf8(b"description"),
            string::utf8(b"project_url"),
        ],
        vector[
            string::utf8(b"{name}"),
            string::utf8(b"CRM Workspace | Members: {member_count}"),
            string::utf8(b"https://app.crm.xyz/workspaces/{id}"),
        ],
        ctx,
    );
    display::update_version(&mut workspace_display);

    // Organization Display
    let org_display = display::new_with_fields<Organization>(
        &publisher,
        vector[
            string::utf8(b"name"),
            string::utf8(b"description"),
            string::utf8(b"project_url"),
        ],
        vector[
            string::utf8(b"{name}"),
            string::utf8(b"CRM Organization | Type: {org_type}"),
            string::utf8(b"https://app.crm.xyz/organizations/{id}"),
        ],
        ctx,
    );
    display::update_version(&mut org_display);

    // Deal Display
    let deal_display = display::new_with_fields<Deal>(
        &publisher,
        vector[
            string::utf8(b"name"),
            string::utf8(b"description"),
            string::utf8(b"project_url"),
        ],
        vector[
            string::utf8(b"{title}"),
            string::utf8(b"CRM Deal | Stage: {stage}"),
            string::utf8(b"https://app.crm.xyz/deals/{id}"),
        ],
        ctx,
    );
    display::update_version(&mut deal_display);

    // Transfer all Display objects and Publisher to deployer
    transfer::public_transfer(profile_display, ctx.sender());
    transfer::public_transfer(workspace_display, ctx.sender());
    transfer::public_transfer(org_display, ctx.sender());
    transfer::public_transfer(deal_display, ctx.sender());
    transfer::public_transfer(publisher, ctx.sender());
}
```

### Sponsored Transaction (Gas Station)

Web2 users via ZkLogin may not hold SUI. BFF provides gas sponsorship:

```
Gas Station Flow:
  1. BFF maintains a gas_pool account (pre-funded with SUI)
  2. When user initiates action:
     - User signs business logic (via ZkLogin/Passkey)
     - gas_pool account pays gas via sponsored transaction
  3. Per-workspace gas budget enforcement:
     - Daily limit, per-user limit (stored in workspace settings)
     - Low balance alert (< 10 SUI → Telegram notification)
  4. Gas consumption recorded in audit_logs for workspace admin reporting
```

### On-chain vs Off-chain Data Distribution

| Data | On-chain (Sui Object) | Off-chain (PG) | Encrypted (Seal+Walrus) |
|---|---|---|---|
| Profile core | address, tier, score, tags, suins | -- | email, phone, custom fields |
| Profile activity | audit events only | wallet_activity (TimescaleDB) | -- |
| Organization | name, type, tags, address | detailed description, history | internal docs |
| Deal | stage, value, assignee | detailed notes, follow-ups | DD docs, contract drafts |
| Segment | name, rule_hash, member_count | full rules JSON, member list | -- |
| Campaign | status, segment_id, reward_type | message templates, send logs | -- |
| Notes | -- | -- | All encrypted (Seal+Walrus) |
| Files/Media | -- | -- | All encrypted (Seal+Walrus) |

---

## 4. Database Schema

### Regular Tables

```sql
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sui_object_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    owner_address TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workspace_members (
    workspace_id UUID REFERENCES workspaces(id),
    address TEXT NOT NULL,
    role_level SMALLINT NOT NULL DEFAULT 0,
    permissions BIGINT NOT NULL DEFAULT 1,
    joined_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (workspace_id, address)
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    sui_object_id TEXT UNIQUE,
    primary_address TEXT NOT NULL,
    suins_name TEXT,
    tier SMALLINT DEFAULT 0,
    engagement_score BIGINT DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    display_name TEXT,
    avatar_url TEXT,
    last_active_at TIMESTAMPTZ,
    source TEXT,
    walrus_blob_id TEXT,
    seal_policy_id TEXT,
    version BIGINT DEFAULT 0,                  -- optimistic lock (matches on-chain version)
    is_archived BOOLEAN DEFAULT false,         -- soft delete
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, primary_address)
);

ALTER TABLE profiles ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('simple',
            coalesce(display_name, '') || ' ' ||
            coalesce(suins_name, '') || ' ' ||
            coalesce(primary_address, '') || ' ' ||
            coalesce(array_to_string(tags, ' '), '')
        )
    ) STORED;
CREATE INDEX idx_profiles_search ON profiles USING GIN(search_vector);
CREATE INDEX idx_profiles_workspace_tier ON profiles(workspace_id, tier);
CREATE INDEX idx_profiles_workspace_score ON profiles(workspace_id, engagement_score DESC);
CREATE INDEX idx_profiles_tags ON profiles USING GIN(tags);

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    sui_object_id TEXT UNIQUE,
    name TEXT NOT NULL,
    org_type SMALLINT DEFAULT 0,
    primary_address TEXT,
    tags TEXT[] DEFAULT '{}',
    walrus_blob_id TEXT,
    seal_policy_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    profile_id UUID REFERENCES profiles(id),
    org_id UUID REFERENCES organizations(id),
    role_label TEXT NOT NULL,
    since TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, profile_id, org_id)
);

CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    sui_object_id TEXT UNIQUE,
    title TEXT NOT NULL,
    stage SMALLINT DEFAULT 0,
    value_token TEXT,
    value_amount BIGINT DEFAULT 0,
    assignee_address TEXT,
    profile_id UUID REFERENCES profiles(id),
    org_id UUID REFERENCES organizations(id),
    walrus_blob_id TEXT,
    seal_policy_id TEXT,
    expected_close_date DATE,
    version BIGINT DEFAULT 0,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_deals_pipeline ON deals(workspace_id, stage) WHERE NOT is_archived;

CREATE TABLE segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    sui_object_id TEXT UNIQUE,
    name TEXT NOT NULL,
    rules JSONB NOT NULL,
    rule_hash TEXT NOT NULL,
    is_dynamic BOOLEAN DEFAULT true,
    member_count INT DEFAULT 0,
    last_evaluated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE segment_members (
    segment_id UUID REFERENCES segments(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id),
    added_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (segment_id, profile_id)
);

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    sui_object_id TEXT UNIQUE,
    name TEXT NOT NULL,
    segment_id UUID REFERENCES segments(id),
    status SMALLINT DEFAULT 0,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    reward_type SMALLINT,
    message_template JSONB,
    stats JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    profile_id UUID REFERENCES profiles(id),
    title TEXT NOT NULL,
    status SMALLINT DEFAULT 0,
    priority SMALLINT DEFAULT 1,
    assignee_address TEXT,
    source TEXT,
    sla_deadline TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    workspace_id UUID NOT NULL,
    actor_address TEXT NOT NULL,
    action SMALLINT NOT NULL,
    object_type SMALLINT NOT NULL,
    object_id TEXT NOT NULL,
    tx_hash TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_audit_workspace_time ON audit_logs(workspace_id, created_at DESC);
```

### TimescaleDB Hypertables

```sql
CREATE TABLE wallet_events (
    time TIMESTAMPTZ NOT NULL,
    workspace_id UUID,
    address TEXT NOT NULL,
    profile_id UUID,
    event_type TEXT NOT NULL,
    contract_address TEXT,
    collection TEXT,
    token TEXT,
    amount BIGINT DEFAULT 0,
    tx_digest TEXT NOT NULL,
    raw_data JSONB,
    PRIMARY KEY (time, tx_digest, address)
);
SELECT create_hypertable('wallet_events', 'time');
CREATE INDEX idx_events_profile ON wallet_events(profile_id, time DESC);
CREATE INDEX idx_events_type_collection ON wallet_events(event_type, collection, time DESC);

CREATE TABLE engagement_snapshots (
    time TIMESTAMPTZ NOT NULL,
    profile_id UUID NOT NULL,
    score BIGINT NOT NULL,
    tier SMALLINT NOT NULL,
    PRIMARY KEY (time, profile_id)
);
SELECT create_hypertable('engagement_snapshots', 'time');

SELECT add_compression_policy('wallet_events', INTERVAL '7 days');
SELECT add_compression_policy('engagement_snapshots', INTERVAL '30 days');
SELECT add_retention_policy('wallet_events', INTERVAL '365 days');

CREATE TABLE indexer_checkpoints (
    chain TEXT PRIMARY KEY DEFAULT 'sui',
    last_checkpoint BIGINT NOT NULL DEFAULT 0,
    last_processed_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. Indexer Architecture

```
Sui Network
    │ checkpoint stream (sui-data-ingestion)
    ▼
┌──────────────────────────────────────────┐
│           Rust Indexer Process            │
│                                          │
│  Checkpoint Consumer (exactly-once)      │
│       │                                  │
│  Event Router (by event type)            │
│       │                                  │
│  ┌────┴────┬────────┬────────┐           │
│  │NFT     │DeFi    │Gov     │ ...       │
│  │Handler │Handler │Handler │           │
│  └────┬───┴────┬───┴────┬───┘           │
│       │        │        │                │
│  Event Enricher (resolve profile_id)     │
│       │                                  │
│  Batch Writer (sqlx, 100 rows / 1s)     │
│       │                                  │
│  Alert Engine (whale/VIP detection)      │
│       → POST webhook to BFF              │
└──────────────────────────────────────────┘
```

Key design:
- **Progress tracking**: `indexer_checkpoints` table, resume from breakpoint
- **Fault tolerance**: Batch events + checkpoint update in single DB transaction
- **Profile association**: In-memory `address → profile_id` cache, DB fallback on miss
- **Score calculation**: NOT in indexer. Rust Core scheduled job every 5 minutes

### Data Sync Flow

```
Chain Sui Object change
  ├──→ Indexer writes wallet_events
  ├──→ Indexer updates profiles (last_active_at)
  └──→ Chain AuditEvent → Indexer writes audit_logs

BFF business operation
  ├──→ Write on-chain (Sui tx) → wait confirmation
  ├──→ Optimistic write to PG (fast UI response)
  └──→ Chain event captured by Indexer → audit_logs (idempotent)

Indexer is the source of truth for chain data consistency.
BFF PG writes are optimistic cache only.
```

---

## 6. BFF API Design

### Module Structure

```
bff/src/
├── auth/           # ZkLogin, Wallet, Passkey strategies + session/RBAC guards
├── workspace/      # Workspace CRUD, member invite/remove
├── profile/        # Thin layer: writes → Sui tx + PG, reads → gRPC Rust Core
├── organization/   # Org CRUD
├── deal/           # Sales pipeline management
├── segment/        # Segment CRUD + manual evaluate trigger
├── campaign/       # Campaign CRUD + launch/pause + workflow engine
├── ticket/         # Support ticket management
├── vault/          # Seal + Walrus: proxy encrypted blobs (BFF never sees plaintext)
├── messaging/      # Telegram, Discord, Email integration
├── blockchain/     # Sui client, tx-builder, SuiNS resolver
├── grpc/           # Rust Core gRPC client + proto definitions
├── jobs/           # BullMQ: segment-eval, campaign-scheduler, sla-checker, sync
└── common/         # Audit log interceptor, HTTP exception filter, shared DTOs
```

### Core API Endpoints

```
Auth
  POST   /auth/zklogin
  POST   /auth/wallet
  POST   /auth/passkey
  POST   /auth/refresh
  POST   /auth/logout

Workspace
  POST   /workspaces
  GET    /workspaces/:id
  PATCH  /workspaces/:id
  POST   /workspaces/:id/members
  DELETE /workspaces/:id/members/:addr
  PATCH  /workspaces/:id/members/:addr

Profile
  GET    /profiles
  GET    /profiles/:id
  POST   /profiles
  PATCH  /profiles/:id
  GET    /profiles/:id/activity
  GET    /profiles/:id/assets

Organization
  GET    /organizations
  GET    /organizations/:id
  POST   /organizations
  PATCH  /organizations/:id

Deal
  GET    /deals
  GET    /deals/:id
  POST   /deals
  PATCH  /deals/:id
  GET    /deals/pipeline/stats

Segment
  GET    /segments
  GET    /segments/:id
  POST   /segments
  PATCH  /segments/:id
  POST   /segments/:id/evaluate
  GET    /segments/:id/members

Campaign
  GET    /campaigns
  GET    /campaigns/:id
  POST   /campaigns
  PATCH  /campaigns/:id
  POST   /campaigns/:id/launch
  POST   /campaigns/:id/pause
  GET    /campaigns/:id/stats

Ticket
  GET    /tickets
  GET    /tickets/:id
  POST   /tickets
  PATCH  /tickets/:id

Vault
  POST   /vault/notes
  GET    /vault/notes/:id
  PATCH  /vault/notes/:id
  POST   /vault/files/upload
  GET    /vault/files/:id/download
  GET    /vault/files

Search
  GET    /search?q=xxx

Dashboard
  GET    /dashboard/overview
  GET    /dashboard/activity-feed
```

### Key Business Flows

#### Profile Creation (dual-write)

```
Frontend → BFF: POST /profiles {address, name, tags}
  1. BFF builds Move call: crm_core::profile::create_profile()
  2. BFF submits Sui tx → wait confirmation → get sui_object_id
  3. BFF optimistic write to PG (profiles table)
  4. Return 200 {id, sui_object_id}
  Background: Indexer captures AuditEvent → writes audit_logs → reconciles profiles
```

#### Encrypted Note (Seal + Walrus) — Client-side Encryption

IMPORTANT: Seal is a client-side encryption scheme. The BFF must NEVER see plaintext.
Encryption and decryption happen exclusively in the browser.

```
Write flow:
  Frontend: plaintext → Seal SDK encrypt (in browser) → encrypted_blob
  Frontend → BFF: POST /vault/notes {profile_id, encrypted_blob, policy_id}
                  (BFF only receives the already-encrypted blob)
  BFF → Walrus: upload encrypted_blob → blob_id
  BFF → Sui: record vault object (blob_id + policy_id)
  BFF → PG: store metadata only (title, profile_id, blob_id — NO plaintext)
  Return 200 {note_id}

Read flow:
  Frontend → BFF: GET /vault/notes/:id
  BFF → Walrus: fetch encrypted_blob
  BFF → Frontend: return encrypted_blob (still encrypted)
  Frontend: Seal SDK → request decryption key from key server
            → key server verifies on-chain policy → returns key
            → decrypt in browser → display plaintext

BFF's role: proxy encrypted blobs only. Zero knowledge of content.
```

#### Campaign Workflow Automation

```
Indexer detects NFT mint → webhook to BFF
  1. BFF resolves address → profile
  2. BFF checks active campaigns for matching triggers
  3. Match found → execute actions:
     a) Send Telegram welcome message
     b) Execute airdrop Sui tx
  4. Update campaign stats + profile timeline
```

### gRPC Proto (BFF ↔ Rust Core)

```protobuf
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
```

---

## 7. Frontend Architecture

### Directory Structure

```
frontend/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── page.tsx                  # Dashboard overview
│   │   ├── profiles/[id]/page.tsx    # 360 degree profile
│   │   ├── deals/page.tsx            # Pipeline kanban
│   │   ├── segments/new/page.tsx     # Rule builder
│   │   ├── campaigns/[id]/workflow/  # Journey builder
│   │   ├── tickets/page.tsx
│   │   ├── vault/{notes,files}/
│   │   ├── analytics/page.tsx
│   │   └── settings/{workspace,members,roles,integrations}/
│
├── components/
│   ├── ui/                   # Shadcn base components
│   ├── layout/               # Sidebar, Topbar, Command palette (Cmd+K)
│   ├── profile/              # Profile card, timeline, asset gallery
│   ├── deal/                 # Kanban board, deal card, deal room
│   ├── segment/              # Visual rule builder
│   ├── campaign/             # Workflow canvas, campaign stats
│   ├── vault/                # Encrypted note editor, file uploader
│   ├── charts/               # Score distribution, activity heatmap, pipeline funnel
│   └── shared/               # Data table, address display, tier badge, tag input
│
├── lib/
│   ├── api/client.ts         # BFF API client (fetch + auth)
│   ├── blockchain/           # sui-provider, zklogin, passkey, seal-client
│   ├── hooks/                # React Query hooks (useProfiles, useDeals, useRealtime)
│   └── utils/                # format-address, format-token, time-ago
│
└── stores/                   # Zustand: auth-store, workspace-store, ui-store
```

### Tech Stack

| Feature | Choice | Rationale |
|---|---|---|
| Data fetching | TanStack Query | Cache, auto-revalidate, optimistic updates |
| Global state | Zustand | Lightweight, no Provider nesting |
| Forms | React Hook Form + Zod | Type-safe validation |
| Charts | Recharts | React-based, lightweight, customizable |
| Drag & drop | dnd-kit | Accessible, performant (Kanban/workflow) |
| Flow diagrams | React Flow | Node-based workflow builder |
| Realtime | WebSocket (native) | Whale alert, activity feed push |
| Wallet | @mysten/dapp-kit | Official Sui React SDK |

---

## 8. Rust Core Service

```
rust-core/src/
├── main.rs
├── server/               # gRPC service implementations
│   ├── profile_service.rs
│   ├── segment_service.rs
│   └── analytics_service.rs
│
├── engine/               # Core computation engines
│   ├── score_engine.rs       # Customizable weight formula, batch recalc
│   ├── segment_engine.rs     # Rules JSON → dynamic SQL, member refresh
│   ├── search_engine.rs      # PG tsvector, multi-table search
│   └── whale_detector.rs     # Threshold detection, webhook push
│
├── repo/                 # Data access (sqlx)
│   ├── profile_repo.rs
│   ├── activity_repo.rs
│   ├── segment_repo.rs
│   └── analytics_repo.rs
│
├── scheduler/            # Scheduled tasks
│   ├── score_recalc.rs       # Every 5 min: batch recalc scores
│   ├── segment_refresh.rs    # Every 10 min: refresh dynamic segments
│   └── snapshot.rs           # Every hour: engagement_snapshots
│
└── cache/
    └── address_map.rs        # In-memory address → profile_id cache
```

### Score Engine

```
Per-workspace customizable weight config:
{
  "score_weights": {
    "tx_count_30d": 1.0,
    "hold_days": 0.5,
    "vote_count": 2.0,
    "nft_count": 0.3,
    "total_value_usd": 0.1
  },
  "tier_thresholds": {
    "whale": 10000, "vip": 5000, "core": 1000, "active": 100, "dormant": 0
  }
}

Recalc flow (every 5 min):
  1. Aggregate wallet_events → per-profile raw metrics
  2. Apply weights → sum to score
  3. Compare tier_thresholds → determine tier
  4. Batch UPDATE profiles SET engagement_score, tier
  5. Tier changes → webhook to BFF
  6. Write engagement_snapshots
```

### Segment Engine

```
Rules JSON → Dynamic SQL generation:
  { "operator": "AND", "conditions": [...] }
  →
  SELECT p.id FROM profiles p
  WHERE p.workspace_id = $1
    AND p.tier >= 3
    AND 'DeFi' = ANY(p.tags)
    AND EXISTS (SELECT 1 FROM wallet_events e ...)
```

---

## 9. Deployment Architecture

### Docker Compose (Production)

```
Services:
  traefik       - Reverse proxy + SSL (Let's Encrypt)
  nextjs        - Frontend (:3000)
  bff           - NestJS API (:4000)
  rust-core     - gRPC service (:50051, internal only)
  indexer       - Chain event indexer (no port, background)
  postgres      - TimescaleDB (:5432)
  redis         - BullMQ job queue + session store (:6379)
  prometheus    - Metrics (:9090)
  grafana       - Dashboards (:3001)
  loki          - Log aggregation (:3100)
```

### Environment Separation

| | Development | Staging | Production |
|---|---|---|---|
| Sui Network | localnet | testnet | mainnet |
| Walrus | testnet | testnet | mainnet |
| DB | local Docker | VPS Docker | VPS Docker |
| Domain | localhost:3000 | stg.crm.xyz | app.crm.xyz |
| Monitoring | No | Yes | Yes |
| Backup | No | Daily | Every 6 hours |

---

## 10. Security Design

### Authentication Flow (ZkLogin)

```
1. User clicks Google login → BFF generates nonce, redirects to Google
2. Google OAuth → returns JWT
3. Frontend sends Google JWT to BFF
4. BFF verifies JWT + generates ZK proof + derives Sui address
5. BFF creates session JWT (httpOnly cookie, 15min + refresh 7d)
```

### Security Layers

| Layer | Measures |
|---|---|
| Network | Traefik SSL, rate limiting (100 req/s/IP), CORS whitelist |
| Auth | httpOnly cookie, JWT short-lived (15min) + refresh rotation, CSRF token |
| Authorization | RBAC bitmask check (every request), Seal policy (sensitive data) |
| Data | Seal client-side E2E encryption (notes/files — BFF never sees plaintext), PG SSL, Redis password auth |
| Contracts | All admin functions check Role + Workspace ownership |
| Input | Zod schema validation (BFF), parameterized SQL, XSS sanitize |
| Logging | No sensitive fields logged, audit_logs on-chain immutable |
| Backup | PG pg_dump → encrypted → stored on Walrus |

### Contract Security

- All public entry functions: (1) check GlobalConfig.paused, (2) verify Capability, (3) verify workspace match
- Workspace admin transfer requires multisig (optional)
- Contract upgrades require UpgradeCap owner signature (stored in multisig)
- Optimistic locking (version field) prevents concurrent modification conflicts
- Soft delete (is_archived) ensures data recovery and compliance
- Rate limiting per workspace prevents abuse
- Pre-launch: security audit (sui-dev-agents) + Move Prover + third-party audit

### Sui API Migration Notice

| API | Status | Action Required |
|---|---|---|
| gRPC | GA (production) | Indexer uses sui-data-ingestion (gRPC-based) ✓ |
| GraphQL | Beta | BFF @mysten/sui SDK must use GraphQL transport |
| JSON-RPC | **Deprecated, removed April 2026** | Do NOT use. Verify all SDK calls use GraphQL |

Ensure `@mysten/sui` and `@mysten/dapp-kit` versions support GraphQL transport.

---

## 11. Development Workflow

### Monorepo Structure

```
decentralised-crm/
├── .github/workflows/
│   ├── ci.yml                # PR: lint + type-check + test
│   ├── deploy-staging.yml    # merge to main → auto deploy staging
│   └── deploy-prod.yml      # tag v*.*.* → manual confirm → deploy prod
├── packages/
│   ├── move/                 # Sui Move contracts (4 packages)
│   ├── proto/                # Shared protobuf definitions
│   ├── shared-types/         # Shared TypeScript types
│   ├── frontend/             # Next.js
│   ├── bff/                  # NestJS
│   ├── rust-core/            # Rust gRPC service
│   └── indexer/              # Rust indexer
├── docker-compose.yml        # Local dev
├── docker-compose.prod.yml   # Production
└── turbo.json                # Turborepo config
```

### CI/CD Pipeline

```
PR → Move test + Frontend tsc/eslint/vitest + BFF tsc/eslint/jest
   + Rust cargo test/clippy + Proto buf lint
   → All pass → Merge to main
   → Auto deploy staging (testnet)
   → E2E smoke tests
   → Manual tag v*.*.* → Deploy production (mainnet)
```

### Monitoring & Alerts

| Monitor | Alert Condition |
|---|---|
| API latency | P99 > 500ms for 5 min |
| Error rate | 5xx > 1% for 2 min |
| Indexer lag | > 100 checkpoints behind (~30s) |
| DB connections | > 80% pool size |
| Disk | > 80% usage |
| Whale alert | Realtime → Telegram notification |
| Gas balance | Deployer account < 10 SUI |

Alert channel: Telegram Bot → workspace admin group

---

## Appendix: v1.1 Changelog (Architecture Review Improvements)

| # | Change | Category |
|---|---|---|
| 1 | `dynamic_field` → `dynamic_object_field` for externally queryable sub-objects (MemberRecord, WalletBinding) | Move contracts |
| 2 | Added Object Display standard for all core types (Profile, Workspace, Organization, Deal) | Move contracts |
| 3 | `set_field` now requires WorkspaceAdminCap + GlobalConfig pause check + version lock | Move contracts |
| 4 | Added Capability Pattern: WorkspaceAdminCap, EmergencyPauseCap, GlobalConfig, RateLimitConfig | Move contracts |
| 5 | Confirmed JSON-RPC deprecated; all SDK calls must use GraphQL transport | BFF / Frontend |
| 6 | Seal encryption moved to client-side only; BFF never sees plaintext | BFF + Frontend |
| 7 | Added Sponsored Transaction (Gas Station) flow for ZkLogin users | BFF |
| 8 | AuditEvent → AuditEventV1 with version field for forward-compatible Indexer parsing | Move contracts + Indexer |
| 9 | Added `version` field (optimistic lock) to Profile, Organization, Deal | Move contracts + DB |
| 10 | Added `is_archived` / `archived_at` (soft delete) to Profile, Organization, Deal | Move contracts + DB |
| 11 | Added RateLimitConfig for per-workspace abuse prevention | Move contracts |
