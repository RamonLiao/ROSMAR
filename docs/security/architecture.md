# ROSMAR CRM Architecture

> Last updated: 2026-03-10

## 1. Move Package Dependency Graph

```mermaid
graph TD
    SUI["Sui Framework<br/>(testnet)"]

    CORE["crm_core<br/>ACL, Capabilities, Workspace,<br/>Profile, Organization, Deal,<br/>Relation, MultiSigPause,<br/>AdminRecovery, DisplayInit"]

    DATA["crm_data<br/>Campaign, Segment,<br/>Ticket, Deal Pipeline"]

    ESCROW["crm_escrow<br/>Escrow, Vesting,<br/>Arbitration"]

    VAULT["crm_vault<br/>Vault, AccessPolicy<br/>(Walrus + Seal)"]

    ACTION["crm_action<br/>Airdrop, Reward,<br/>QuestBadge SBT"]

    SUI --> CORE
    SUI --> DATA
    SUI --> ESCROW
    SUI --> VAULT
    SUI --> ACTION

    CORE --> DATA
    CORE --> ESCROW
    CORE --> VAULT
    CORE --> ACTION
    DATA --> ESCROW
    DATA --> ACTION
```

`crm_core` is the foundation layer: it defines the capability model (`WorkspaceAdminCap`, `EmergencyPauseCap`, `GlobalConfig`), ACL bitmask system, and all core CRM objects. Every other package depends on it for pause checks and workspace authorization. `crm_data` adds campaign/segment/ticket data structures. `crm_escrow` and `crm_action` both depend on `crm_core` and `crm_data` because they reference workspace authorization and campaign objects respectively. `crm_vault` depends only on `crm_core` since it operates independently of campaign/deal data.

---

## 2. BFF Module Graph

```mermaid
graph TD
    APP["AppModule"]

    subgraph Infrastructure
        CONFIG["ConfigModule<br/>(global)"]
        EVENT["EventEmitterModule"]
        THROTTLE["ThrottleConfig<br/>+ ThrottlerGuard"]
        PRISMA["PrismaModule<br/>(global)"]
        CACHE["CacheModule<br/>(Redis)"]
        HEALTH["HealthModule"]
        LOG["LoggingModule<br/>(pino)"]
    end

    subgraph Auth
        AUTH["AuthModule<br/>SessionGuard, RbacGuard,<br/>WalletStrategy, ZkLoginStrategy"]
        TESTAUTH["TestAuthModule<br/>(NODE_ENV=test only)"]
    end

    subgraph Core Domain
        WS["WorkspaceModule"]
        PROF["ProfileModule"]
        ORG["OrganizationModule"]
        DEAL["DealModule"]
        SEG["SegmentModule"]
    end

    subgraph Extended Domain
        CAMP["CampaignModule"]
        VAULT["VaultModule"]
        TICKET["TicketModule"]
        QUEST["QuestModule"]
    end

    subgraph Actions & Comms
        MSG["MessagingModule"]
        NOTIF["NotificationModule"]
        WEBHOOK["WebhookModule"]
        BROADCAST["BroadcastModule"]
        ENGAGE["EngagementModule"]
        AUTOTAG["AutoTagModule"]
        SOCIAL["SocialModule"]
    end

    subgraph Intelligence
        AGENT["AgentModule<br/>(AI SDK)"]
        ANALYTICS["AnalyticsModule"]
    end

    subgraph Compliance
        GDPR["GdprModule<br/>(BullMQ jobs)"]
    end

    APP --> CONFIG
    APP --> EVENT
    APP --> THROTTLE
    APP --> PRISMA
    APP --> CACHE
    APP --> HEALTH
    APP --> LOG
    APP --> AUTH
    APP -.-> TESTAUTH
    APP --> WS
    APP --> PROF
    APP --> ORG
    APP --> DEAL
    APP --> SEG
    APP --> CAMP
    APP --> VAULT
    APP --> TICKET
    APP --> QUEST
    APP --> MSG
    APP --> NOTIF
    APP --> WEBHOOK
    APP --> BROADCAST
    APP --> ENGAGE
    APP --> AUTOTAG
    APP --> SOCIAL
    APP --> AGENT
    APP --> ANALYTICS
    APP --> GDPR
```

The `AppModule` registers a global `ThrottlerGuard` as `APP_GUARD`, meaning every endpoint is rate-limited by default. `PrismaModule` and `ConfigModule` are global -- available to all modules without explicit imports. `CacheModule` wraps Redis via `ioredis` and is used by `AuthService` for challenge nonce storage. `TestAuthModule` is conditionally loaded only when `NODE_ENV=test`, providing a bypass login endpoint.

---

## 3. Fund Flow Diagram

```mermaid
sequenceDiagram
    participant Payer
    participant BFF
    participant SUI as SUI Chain
    participant Payee
    participant Arb as Arbitrator(s)

    Note over Payer,SUI: === Escrow Lifecycle ===

    Payer->>BFF: POST /escrow/create
    BFF->>SUI: create_escrow(config, workspace, cap, deal_id, payee, arbs, threshold, expiry)
    SUI-->>SUI: Share Escrow object (state=CREATED)

    Payer->>BFF: POST /escrow/fund
    BFF->>SUI: fund_escrow(escrow, coin, clock)
    SUI-->>SUI: Balance deposited (state=FUNDED)

    alt Payer releases (after 1h lock)
        Payer->>BFF: POST /escrow/release
        BFF->>SUI: release(escrow, amount, clock)
        SUI->>Payee: transfer SUI
        SUI-->>SUI: state=PARTIALLY_RELEASED or COMPLETED
    end

    alt Vesting attached
        Payer->>SUI: add_vesting(escrow, type, cliff, duration, milestones)
        Payer->>SUI: complete_milestone(escrow, index)
        Payer->>SUI: release_vested(escrow, clock)
        SUI->>Payee: transfer vested amount
    end

    alt Payee claims before expiry
        Payee->>SUI: claim_before_expiry(escrow, clock)
        Note right of SUI: Window: [expiry-24h, expiry)
        SUI->>Payee: transfer remaining balance
    end

    alt Payer refunds (expired or no-expiry)
        Payer->>SUI: refund(escrow, clock)
        SUI->>Payer: return remaining balance
    end

    alt Dispute
        Payer->>SUI: raise_dispute(escrow)
        SUI-->>SUI: state=DISPUTED, ArbitrationState added

        alt Direct voting
            Arb->>SUI: vote_on_dispute(escrow, vote=0|1)
        end
        alt Commit-reveal voting
            Arb->>SUI: commit_vote(escrow, hash, deadline)
            Arb->>SUI: reveal_vote(escrow, vote, salt)
        end

        Note over SUI: When votes >= threshold:
        SUI->>Payee: release (decision=0)
        SUI->>Payer: refund (decision=1)
    end

    Note over Payer,SUI: === Airdrop ===

    Payer->>BFF: POST /airdrop/batch
    BFF->>SUI: batch_airdrop(config, workspace, cap, recipients, fund, amount_per)
    SUI->>Payee: split & transfer to each recipient
    SUI->>Payer: return remainder

    Note over Payer,SUI: === Reward ===

    Payer->>BFF: POST /reward/distribute
    BFF->>SUI: distribute(config, ws, cap, campaign, recipient, amount, type, fund)
    Note right of SUI: Campaign must be ACTIVE
    SUI->>Payee: transfer reward
    SUI-->>SUI: RewardRecord created

    Note over Payer,SUI: === Quest Badge (SBT) ===

    BFF->>SUI: mint_badge(config, ws, cap, registry, recipient, quest_id, ...)
    SUI->>Payee: transfer::transfer (non-store = soul-bound)
```

The escrow module is the primary fund custody mechanism. Funds enter via `fund_escrow` and can only exit through four paths: payer-initiated `release` (with 1-hour minimum lock), payee `claim_before_expiry` (24h window), payer `refund` (after expiry or if no expiry set), or arbitration dispute resolution. The 1-hour lock prevents immediate release after funding. Vesting adds time-based or milestone-based release schedules on top of the funded escrow.

Airdrops and rewards are stateless fund transfers -- SUI is split from a provided coin and transferred immediately. No fund custody is involved beyond the transaction itself.

---

## 4. Auth Flow

```mermaid
sequenceDiagram
    participant Client
    participant BFF
    participant Redis
    participant SUI as SUI Chain
    participant Enoki as Enoki API
    participant DB as PostgreSQL

    Note over Client,DB: === Wallet Signature Auth ===

    Client->>BFF: GET /auth/challenge
    BFF->>Redis: SET challenge:{nonce} = timestamp (TTL 300s)
    BFF-->>Client: "Sign this message...\n{nonce}"

    Client->>Client: signPersonalMessage(message)

    Client->>BFF: POST /auth/wallet-login {address, signature, message}
    BFF->>Redis: GET + DEL challenge:{nonce}
    Note right of BFF: Single-use nonce consumed
    BFF->>SUI: verifyPersonalMessageSignature(msg, sig, {client})
    SUI-->>BFF: recovered publicKey
    BFF->>BFF: publicKey.toSuiAddress() === address?

    BFF->>DB: Find or create workspace membership
    BFF-->>Client: {accessToken, refreshToken, user}

    Note over Client,DB: === zkLogin Auth ===

    Client->>Client: OAuth flow -> JWT from provider
    Client->>BFF: POST /auth/zklogin {jwt, salt}
    BFF->>Enoki: POST /v1/zklogin/derive-address {jwt, salt}
    Enoki-->>BFF: {address}
    BFF->>DB: Find or create workspace membership
    BFF-->>Client: {accessToken, refreshToken, user}

    Note over Client,DB: === Passkey / WebAuthn Auth ===

    Client->>BFF: POST /auth/passkey/register/options {address}
    BFF-->>Client: registration options + challenge

    Client->>Client: navigator.credentials.create(...)
    Client->>BFF: POST /auth/passkey/register/verify {response}
    BFF->>DB: Store PasskeyCredential

    Client->>BFF: POST /auth/passkey/login/options
    BFF-->>Client: authentication options + challenge

    Client->>Client: navigator.credentials.get(...)
    Client->>BFF: POST /auth/passkey/login/verify {response}
    BFF->>DB: Lookup credential, verify, update counter
    BFF-->>Client: {accessToken, refreshToken, user}

    Note over Client,DB: === Session Validation ===

    Client->>BFF: Any API request (Cookie: access_token=... or Authorization: Bearer ...)
    BFF->>BFF: SessionGuard: JWT verify
    BFF->>BFF: RbacGuard: (user.permissions & required) === required?
    BFF-->>Client: 200 OK or 401/403
```

Three authentication paths converge on the same `resolveOrCreateMembership` function, which either finds the user's existing workspace membership or auto-provisions a new workspace with owner role. JWT tokens embed `address`, `workspaceId`, `role`, and `permissions`. The `SessionGuard` extracts JWT from httpOnly cookie or Authorization header. The `RbacGuard` enforces bitmask permissions matching the on-chain ACL model.

Key security properties:
- Challenge nonces are single-use (Redis GET + DEL)
- Challenge TTL is 5 minutes
- Wallet signature verification uses SUI SDK `verifyPersonalMessageSignature` which handles zkLogin JWK verification
- Recovered address must match claimed address
- WebAuthn counters are incremented to prevent replay
- Refresh tokens have configurable expiry (default 7d)

---

## 5. Data Flow

```mermaid
sequenceDiagram
    participant User
    participant BFF as BFF (NestJS)
    participant Guard as SessionGuard + RbacGuard
    participant Service as Domain Service
    participant TxBuilder as TX Builder
    participant SUI as SUI Chain
    participant Prisma as Prisma (PostgreSQL)
    participant Cache as Redis Cache

    User->>BFF: HTTP Request (Cookie/Bearer JWT)
    BFF->>Guard: Authenticate + Authorize

    alt Auth fails
        Guard-->>User: 401 Unauthorized / 403 Forbidden
    end

    Guard->>BFF: request.user = {address, workspaceId, role, permissions}
    BFF->>Service: Controller delegates to service

    alt Read path (query)
        Service->>Prisma: Query database
        Prisma-->>Service: Result
        Service-->>User: JSON response
    end

    alt Write path (mutation)
        Service->>TxBuilder: Build SUI Transaction Block
        TxBuilder->>TxBuilder: Add move calls (config, workspace, cap, ...)

        alt SUI_DRY_RUN=true
            TxBuilder-->>Service: Mock result {digest: 'dry-run'}
        else Production
            TxBuilder->>SUI: Execute Transaction
            SUI-->>TxBuilder: Transaction digest + effects
        end

        TxBuilder-->>Service: TX result
        Service->>Prisma: Optimistic write (mirror on-chain state)
        Service->>Cache: Invalidate relevant cache keys

        alt Event-driven side effects
            Service->>BFF: EventEmitter.emit('deal.updated', ...)
            BFF->>Service: Listeners trigger notifications, webhooks, auto-tags
        end

        Service-->>User: {digest, data}
    end

    Note over User,Cache: === Read Optimization ===

    User->>BFF: GET /profiles/:id
    BFF->>Cache: Check Redis cache
    alt Cache hit
        Cache-->>User: Cached response
    end
    alt Cache miss
        BFF->>Prisma: Query DB
        Prisma-->>BFF: Result
        BFF->>Cache: SET with TTL
        BFF-->>User: JSON response
    end
```

The write path follows a pattern of: (1) build SUI transaction with capability objects, (2) execute on-chain, (3) mirror state into PostgreSQL via Prisma for fast reads. This dual-write approach means the on-chain state is the source of truth, while PostgreSQL serves as a read-optimized cache. The `SUI_DRY_RUN=true` flag enables testing without chain interaction.

Key architectural properties:
- **Global ThrottlerGuard** -- every endpoint is rate-limited at the BFF level
- **ValidationPipe whitelist** -- unknown request fields are stripped before reaching controllers
- **Optimistic concurrency** -- on-chain objects carry `version` fields; BFF passes `expected_version` to prevent stale writes
- **Event-driven side effects** -- `EventEmitterModule` decouples mutations from notification/webhook/auto-tag logic
- **CORS credentials mode** -- `CORS_ORIGIN` is required in production; cookies are sent with `credentials: true`
- **BullMQ async jobs** -- GDPR deletion, export, and cleanup run as background jobs via Redis-backed queues
