# P2-1 Rust Indexer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the disconnected indexer pipeline so Sui on-chain events flow into TimescaleDB and trigger webhooks to BFF.

**Architecture:** CheckpointConsumer extracts events -> EventRouter dispatches by type -> Handlers enrich + write DB -> WebhookDispatcher POSTs to BFF. All components exist but are disconnected.

**Tech Stack:** Rust, tokio, sqlx (PostgreSQL/TimescaleDB), reqwest, serde, tracing

---

## Task 1: Wire Consumer -> Router

**Files:**
- Modify: `packages/indexer/src/consumer.rs` (lines ~130-145, the event loop gap)
- Modify: `packages/indexer/src/main.rs` (pass router into consumer)

**Step 1: Update CheckpointConsumer to accept EventRouter**

In `consumer.rs`, add `router: Arc<EventRouter>` field to `CheckpointConsumer` struct and update `new()`:

```rust
pub struct CheckpointConsumer {
    config: Arc<Config>,
    pool: PgPool,
    http: reqwest::Client,
    router: Arc<EventRouter>,
}

impl CheckpointConsumer {
    pub fn new(config: Arc<Config>, pool: PgPool, http: reqwest::Client, router: Arc<EventRouter>) -> Self {
        Self { config, pool, http, router }
    }
}
```

**Step 2: Replace the event log-only loop with router dispatch**

In `process_transaction()` (around line 138), replace:
```rust
for event in events {
    tracing::trace!("Event: {:?}", event);
}
```
With:
```rust
for event in events {
    if let Err(e) = self.router.route_event(&event, &self.pool).await {
        tracing::warn!(tx_digest = %tx_digest, error = %e, "Failed to route event");
    }
}
```

**Step 3: Update main.rs to pass router into consumer**

In `main.rs`, wrap router in `Arc` and pass to `CheckpointConsumer::new()`:
```rust
let router = Arc::new(EventRouter::new(config.clone()));
let consumer = CheckpointConsumer::new(config.clone(), pool.clone(), http.clone(), router);
```

**Step 4: Build and verify compilation**

Run: `cd packages/indexer && cargo build 2>&1`
Expected: Compiles with no errors

**Step 5: Commit**

```bash
git add packages/indexer/src/consumer.rs packages/indexer/src/main.rs
git commit -m "feat(indexer): wire CheckpointConsumer -> EventRouter dispatch"
```

---

## Task 2: Integrate Enricher into Router

**Files:**
- Modify: `packages/indexer/src/router.rs` (add enricher to router)
- Modify: `packages/indexer/src/main.rs` (pass enricher)

**Step 1: Add Enricher to EventRouter**

```rust
pub struct EventRouter {
    config: Arc<Config>,
    enricher: Arc<Enricher>,
}

impl EventRouter {
    pub fn new(config: Arc<Config>, enricher: Arc<Enricher>) -> Self {
        Self { config, enricher }
    }
}
```

**Step 2: Enrich events after handler writes**

In `route_event()`, after the handler writes the raw event, resolve address -> profile_id:

```rust
pub async fn route_event(&self, event: &serde_json::Value, pool: &PgPool) -> Result<(), String> {
    let event_type_str = event.get("type").and_then(|t| t.as_str()).unwrap_or("");
    let address = self.extract_address(event);

    // Dispatch to handler
    let wallet_event = if self.is_nft_event(event_type_str) {
        handle_nft_event(event, pool).await?
    } else if self.is_defi_event(event_type_str) {
        handle_defi_event(event, pool).await?
    } else if self.is_governance_event(event_type_str) {
        handle_governance_event(event, pool).await?
    } else if self.is_audit_event(event_type_str) {
        handle_audit_event(event, pool).await?;
        return Ok(()); // audit events don't need enrichment
    } else {
        tracing::trace!(event_type = %event_type_str, "Unhandled event type");
        return Ok(());
    };

    // Enrich: resolve address -> profile_id
    let profile_id = if let Some(addr) = &address {
        self.enricher.resolve_address(addr, pool).await.ok().flatten()
    } else {
        None
    };

    Ok(())
}
```

**Step 3: Update main.rs to pass enricher to router**

```rust
let enricher = Arc::new(Enricher::new(pool.clone()).await);
let router = Arc::new(EventRouter::new(config.clone(), enricher));
```

**Step 4: Build**

Run: `cd packages/indexer && cargo build 2>&1`

**Step 5: Commit**

```bash
git add packages/indexer/src/router.rs packages/indexer/src/main.rs
git commit -m "feat(indexer): integrate Enricher into EventRouter for address->profile resolution"
```

---

## Task 3: Add handle_governance_event

**Files:**
- Create: `packages/indexer/src/handlers/governance.rs`
- Modify: `packages/indexer/src/handlers/mod.rs` (export)
- Modify: `packages/indexer/src/router.rs` (add governance matching)

**Step 1: Create governance handler**

```rust
// packages/indexer/src/handlers/governance.rs
use sqlx::PgPool;
use tracing;

use super::WalletEvent;

/// Handle governance events (vote, propose, execute).
/// Generic schema — extensible for future CRM-specific governance.
pub async fn handle_governance_event(
    event: &serde_json::Value,
    pool: &PgPool,
) -> Result<WalletEvent, String> {
    let parsed = event.get("parsedJson").unwrap_or(event);

    // Extract common fields
    let voter = parsed.get("voter")
        .or_else(|| parsed.get("sender"))
        .or_else(|| parsed.get("user"))
        .and_then(|v| v.as_str())
        .unwrap_or_default();

    let proposal_id = parsed.get("proposal_id")
        .or_else(|| parsed.get("proposalId"))
        .and_then(|v| v.as_str())
        .unwrap_or_default();

    let vote_type = parsed.get("vote_type")
        .or_else(|| parsed.get("voteType"))
        .or_else(|| parsed.get("vote"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    let weight = parsed.get("weight")
        .or_else(|| parsed.get("voting_power"))
        .and_then(|v| v.as_u64())
        .unwrap_or(1);

    let protocol = parsed.get("protocol")
        .and_then(|v| v.as_str())
        .unwrap_or("generic");

    let dao_id = parsed.get("dao_id")
        .or_else(|| parsed.get("daoId"))
        .and_then(|v| v.as_str())
        .map(String::from);

    let tx_digest = event.get("txDigest")
        .or_else(|| event.get("id").and_then(|id| id.get("txDigest")))
        .and_then(|v| v.as_str())
        .unwrap_or_default();

    let timestamp_ms = event.get("timestampMs")
        .and_then(|v| v.as_str().or_else(|| v.as_u64().map(|_| "")).and_then(|s| {
            if s.is_empty() { v.as_u64() } else { s.parse::<u64>().ok() }
        }))
        .unwrap_or(0);

    let event_type = if event.get("type").and_then(|t| t.as_str()).unwrap_or("").contains("propose") {
        "governance_propose"
    } else if event.get("type").and_then(|t| t.as_str()).unwrap_or("").contains("execute") {
        "governance_execute"
    } else {
        "governance_vote"
    };

    // Build raw_data with governance-specific fields
    let raw_data = serde_json::json!({
        "proposal_id": proposal_id,
        "voter": voter,
        "vote_type": vote_type,
        "weight": weight,
        "protocol": protocol,
        "dao_id": dao_id,
    });

    let contract_address = parsed.get("package")
        .or_else(|| parsed.get("packageId"))
        .and_then(|v| v.as_str())
        .unwrap_or_default();

    sqlx::query(
        "INSERT INTO wallet_events (time, address, event_type, contract_address, token, amount, tx_digest, raw_data)
         VALUES (to_timestamp($1::double precision / 1000), $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (time, tx_digest, address) DO NOTHING"
    )
    .bind(timestamp_ms as f64)
    .bind(voter)
    .bind(event_type)
    .bind(contract_address)
    .bind("") // no token for governance
    .bind(weight as i64)
    .bind(tx_digest)
    .bind(&raw_data)
    .execute(pool)
    .await
    .map_err(|e| format!("DB insert error: {e}"))?;

    tracing::info!(
        event_type = %event_type,
        voter = %voter,
        proposal_id = %proposal_id,
        vote_type = %vote_type,
        "Governance event indexed"
    );

    Ok(WalletEvent {
        address: voter.to_string(),
        event_type: event_type.to_string(),
        contract_address: contract_address.to_string(),
        collection: String::new(),
        token: String::new(),
        amount: weight as i64,
        tx_digest: tx_digest.to_string(),
        raw_data: raw_data,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    #[cfg(feature = "integration")]
    async fn test_handle_governance_event() {
        let pool = PgPool::connect(&std::env::var("DATABASE_URL").unwrap())
            .await.unwrap();

        let event = json!({
            "type": "0x123::governance::VoteEvent",
            "parsedJson": {
                "voter": "0x00000000000000000000000000000000000000000000000000000000e2e00001",
                "proposal_id": "prop-001",
                "vote_type": "for",
                "weight": 1000,
                "protocol": "generic",
                "dao_id": null
            },
            "txDigest": "TestGovDigest001",
            "timestampMs": "1709827200000"
        });

        let result = handle_governance_event(&event, &pool).await;
        assert!(result.is_ok());
        let wallet_event = result.unwrap();
        assert_eq!(wallet_event.event_type, "governance_vote");
        assert_eq!(wallet_event.amount, 1000);
    }
}
```

**Step 2: Export from mod.rs**

Add to `packages/indexer/src/handlers/mod.rs`:
```rust
pub mod governance;
pub use governance::handle_governance_event;
```

**Step 3: Add governance matching to router**

In `router.rs`, add:
```rust
fn is_governance_event(&self, event_type: &str) -> bool {
    let lower = event_type.to_lowercase();
    lower.contains("governance") || lower.contains("::dao::") ||
    lower.contains("voting") || lower.contains("proposal")
}
```

**Step 4: Build**

Run: `cd packages/indexer && cargo build 2>&1`

**Step 5: Commit**

```bash
git add packages/indexer/src/handlers/governance.rs packages/indexer/src/handlers/mod.rs packages/indexer/src/router.rs
git commit -m "feat(indexer): add handle_governance_event with generic extensible schema"
```

---

## Task 4: Add WebhookDispatcher (unified event POST to BFF)

**Files:**
- Create: `packages/indexer/src/webhook.rs`
- Modify: `packages/indexer/src/router.rs` (call dispatcher after handler)
- Modify: `packages/indexer/src/main.rs` (init dispatcher)
- Modify: `packages/indexer/src/lib.rs` (export module)

**Step 1: Create WebhookDispatcher**

```rust
// packages/indexer/src/webhook.rs
use reqwest::Client;
use serde::Serialize;
use std::sync::Arc;
use tracing;
use uuid::Uuid;

use crate::config::Config;

#[derive(Debug, Serialize)]
pub struct IndexerEvent {
    pub event_id: String,
    pub event_type: String,
    pub profile_id: Option<String>,
    pub address: String,
    pub data: serde_json::Value,
    pub tx_digest: String,
    pub timestamp: u64,
}

pub struct WebhookDispatcher {
    config: Arc<Config>,
    http: Client,
}

impl WebhookDispatcher {
    pub fn new(config: Arc<Config>, http: Client) -> Self {
        Self { config, http }
    }

    pub async fn dispatch(&self, event: IndexerEvent) -> Result<(), String> {
        let url = format!("{}/webhooks/indexer-event", self.config.bff_webhook_url);

        tracing::debug!(
            event_type = %event.event_type,
            address = %event.address,
            "Dispatching webhook to BFF"
        );

        let resp = self.http
            .post(&url)
            .json(&event)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
            .map_err(|e| format!("Webhook POST failed: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            tracing::warn!(status = %status, body = %body, "BFF webhook non-2xx response");
            return Err(format!("BFF returned {status}"));
        }

        tracing::info!(event_type = %event.event_type, "Webhook dispatched");
        Ok(())
    }

    pub fn build_event(
        event_type: &str,
        address: &str,
        profile_id: Option<String>,
        data: serde_json::Value,
        tx_digest: &str,
        timestamp: u64,
    ) -> IndexerEvent {
        IndexerEvent {
            event_id: Uuid::new_v4().to_string(),
            event_type: event_type.to_string(),
            profile_id,
            address: address.to_string(),
            data,
            tx_digest: tx_digest.to_string(),
            timestamp,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_event() {
        let event = WebhookDispatcher::build_event(
            "nft_transfer",
            "0xabc",
            Some("uuid-123".to_string()),
            serde_json::json!({"collection": "0xnft"}),
            "digest123",
            1709827200000,
        );
        assert_eq!(event.event_type, "nft_transfer");
        assert_eq!(event.profile_id, Some("uuid-123".to_string()));
        assert!(!event.event_id.is_empty());
    }
}
```

**Step 2: Wire dispatcher into router**

Add `dispatcher: Arc<WebhookDispatcher>` to `EventRouter`, and after each handler + enrichment, call:

```rust
// At end of route_event(), after enrichment:
let indexer_event = WebhookDispatcher::build_event(
    &wallet_event.event_type,
    &wallet_event.address,
    profile_id.map(|id| id.to_string()),
    wallet_event.raw_data.clone(),
    &wallet_event.tx_digest,
    timestamp_ms,
);

// Fire-and-forget (don't block indexing on webhook delivery)
let dispatcher = self.dispatcher.clone();
tokio::spawn(async move {
    if let Err(e) = dispatcher.dispatch(indexer_event).await {
        tracing::warn!(error = %e, "Webhook dispatch failed (non-blocking)");
    }
});
```

**Step 3: Update main.rs**

```rust
let dispatcher = Arc::new(WebhookDispatcher::new(config.clone(), http.clone()));
let router = Arc::new(EventRouter::new(config.clone(), enricher, dispatcher));
```

**Step 4: Add `pub mod webhook;` to `lib.rs`**

**Step 5: Build + run unit test**

Run: `cd packages/indexer && cargo build && cargo test test_build_event 2>&1`

**Step 6: Commit**

```bash
git add packages/indexer/src/webhook.rs packages/indexer/src/router.rs packages/indexer/src/main.rs packages/indexer/src/lib.rs
git commit -m "feat(indexer): add WebhookDispatcher for unified event POST to BFF"
```

---

## Task 5: Integrate AlertEngine into Router

**Files:**
- Modify: `packages/indexer/src/router.rs` (call alert engine)
- Modify: `packages/indexer/src/main.rs` (pass alert engine)

**Step 1: Add AlertEngine to EventRouter**

```rust
pub struct EventRouter {
    config: Arc<Config>,
    enricher: Arc<Enricher>,
    dispatcher: Arc<WebhookDispatcher>,
    alert_engine: Arc<AlertEngine>,
}
```

**Step 2: Call check_and_alert after handler**

In `route_event()`, after the handler returns `wallet_event`:

```rust
// Check whale alert (before general webhook, so whale gets priority)
if let Err(e) = self.alert_engine.check_and_alert(&wallet_event, profile_id).await {
    tracing::warn!(error = %e, "Whale alert check failed");
}
```

**Step 3: Update main.rs**

```rust
let alert_engine = Arc::new(AlertEngine::new(config.clone(), http.clone(), pool.clone()));
let router = Arc::new(EventRouter::new(config.clone(), enricher, dispatcher, alert_engine));
```

**Step 4: Build**

Run: `cd packages/indexer && cargo build 2>&1`

**Step 5: Commit**

```bash
git add packages/indexer/src/router.rs packages/indexer/src/main.rs
git commit -m "feat(indexer): integrate AlertEngine into event routing pipeline"
```

---

## Task 6: BFF Webhook Receiver Endpoint

**Files:**
- Create: `packages/bff/src/webhook/webhook.module.ts`
- Create: `packages/bff/src/webhook/webhook.controller.ts`
- Create: `packages/bff/src/webhook/webhook.service.ts`
- Create: `packages/bff/src/webhook/dto/indexer-event.dto.ts`
- Modify: `packages/bff/src/app.module.ts` (import WebhookModule)

**Step 1: Create DTO**

```typescript
// packages/bff/src/webhook/dto/indexer-event.dto.ts
import { IsString, IsOptional, IsNumber, IsObject, IsUUID } from 'class-validator';

export class IndexerEventDto {
  @IsUUID()
  event_id: string;

  @IsString()
  event_type: string;

  @IsOptional()
  @IsString()
  profile_id?: string;

  @IsString()
  address: string;

  @IsObject()
  data: Record<string, unknown>;

  @IsString()
  tx_digest: string;

  @IsNumber()
  timestamp: number;
}
```

**Step 2: Create service**

```typescript
// packages/bff/src/webhook/webhook.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IndexerEventDto } from './dto/indexer-event.dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async handleIndexerEvent(event: IndexerEventDto): Promise<void> {
    this.logger.log(
      `Received indexer event: ${event.event_type} from ${event.address}`,
    );

    // Emit internal event for downstream consumers (future: P3-2 Journey triggers)
    this.eventEmitter.emit('indexer.event', event);

    // Whale alerts get additional handling
    if (event.event_type === 'whale_alert') {
      this.eventEmitter.emit('indexer.whale-alert', event);
      this.logger.warn(
        `Whale alert: ${event.address} — ${JSON.stringify(event.data)}`,
      );
    }
  }
}
```

**Step 3: Create controller**

```typescript
// packages/bff/src/webhook/webhook.controller.ts
import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { IndexerEventDto } from './dto/indexer-event.dto';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('indexer-event')
  @HttpCode(200)
  async handleIndexerEvent(@Body() event: IndexerEventDto): Promise<{ ok: true }> {
    await this.webhookService.handleIndexerEvent(event);
    return { ok: true };
  }
}
```

**Step 4: Create module**

```typescript
// packages/bff/src/webhook/webhook.module.ts
import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
```

**Step 5: Wire into AppModule**

In `packages/bff/src/app.module.ts`, add:
```typescript
import { WebhookModule } from './webhook/webhook.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    WebhookModule,
    // ... existing modules
  ],
})
```

**Step 6: Install event-emitter if not present**

Run: `cd packages/bff && pnpm list @nestjs/event-emitter 2>&1 || pnpm add @nestjs/event-emitter`

**Step 7: Build BFF**

Run: `cd packages/bff && pnpm build 2>&1`

**Step 8: Commit**

```bash
git add packages/bff/src/webhook/ packages/bff/src/app.module.ts
git commit -m "feat(bff): add webhook receiver for indexer events with event emitter interface"
```

---

## Task 7: Integration Test Setup (Docker test DB)

**Files:**
- Create: `packages/indexer/tests/integration_test.rs`
- Create: `packages/indexer/tests/fixtures/checkpoint_events.json`
- Modify: `packages/indexer/Cargo.toml` (add integration feature)

**Step 1: Add integration feature to Cargo.toml**

```toml
[features]
default = []
integration = []
```

**Step 2: Create test fixtures**

```json
// packages/indexer/tests/fixtures/checkpoint_events.json
{
  "events": [
    {
      "type": "0xabc::nft::MintEvent",
      "parsedJson": {
        "sender": "0x00000000000000000000000000000000000000000000000000000000e2e00001",
        "objectId": "0x00000000000000000000000000000000000000000000000000000000e2e0nft1",
        "collection": "0x00000000000000000000000000000000000000000000000000000000e2ecol01"
      },
      "txDigest": "IntTestNftDigest001",
      "timestampMs": "1709827200000"
    },
    {
      "type": "0xdef::defi::SwapEvent",
      "parsedJson": {
        "sender": "0x00000000000000000000000000000000000000000000000000000000e2e00001",
        "pool": "0xpool1",
        "token": "SUI",
        "amount": "15000000000",
        "protocol": "cetus"
      },
      "txDigest": "IntTestDefiDigest001",
      "timestampMs": "1709827300000"
    },
    {
      "type": "0x999::governance::VoteEvent",
      "parsedJson": {
        "voter": "0x00000000000000000000000000000000000000000000000000000000e2e00001",
        "proposal_id": "prop-int-001",
        "vote_type": "for",
        "weight": 500,
        "protocol": "generic"
      },
      "txDigest": "IntTestGovDigest001",
      "timestampMs": "1709827400000"
    }
  ]
}
```

**Step 3: Create integration test**

```rust
// packages/indexer/tests/integration_test.rs
//! Integration tests — require DATABASE_URL pointing to test DB.
//! Run: cargo test --features integration -- --test-threads=1

#[cfg(feature = "integration")]
mod tests {
    use sqlx::PgPool;
    use std::sync::Arc;

    #[tokio::test]
    async fn test_full_event_pipeline() {
        dotenvy::dotenv().ok();
        let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL required");
        let pool = PgPool::connect(&db_url).await.expect("DB connect failed");

        // Clean test data
        sqlx::query("DELETE FROM wallet_events WHERE tx_digest LIKE 'IntTest%'")
            .execute(&pool).await.unwrap();

        // Load fixtures
        let fixtures: serde_json::Value = serde_json::from_str(
            include_str!("fixtures/checkpoint_events.json")
        ).unwrap();

        let events = fixtures["events"].as_array().unwrap();

        // Process each event through handlers
        for event in events {
            let event_type = event["type"].as_str().unwrap_or("");
            let lower = event_type.to_lowercase();

            if lower.contains("nft") {
                indexer::handlers::handle_nft_event(event, &pool).await.unwrap();
            } else if lower.contains("defi") || lower.contains("swap") {
                indexer::handlers::handle_defi_event(event, &pool).await.unwrap();
            } else if lower.contains("governance") || lower.contains("vote") {
                indexer::handlers::handle_governance_event(event, &pool).await.unwrap();
            }
        }

        // Verify DB rows
        let nft_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM wallet_events WHERE tx_digest = 'IntTestNftDigest001'"
        ).fetch_one(&pool).await.unwrap();
        assert_eq!(nft_count.0, 1, "NFT event should be inserted");

        let defi_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM wallet_events WHERE tx_digest = 'IntTestDefiDigest001'"
        ).fetch_one(&pool).await.unwrap();
        assert_eq!(defi_count.0, 1, "DeFi event should be inserted");

        let gov_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM wallet_events WHERE tx_digest = 'IntTestGovDigest001'"
        ).fetch_one(&pool).await.unwrap();
        assert_eq!(gov_count.0, 1, "Governance event should be inserted");

        // Verify governance raw_data
        let gov_raw: (serde_json::Value,) = sqlx::query_as(
            "SELECT raw_data FROM wallet_events WHERE tx_digest = 'IntTestGovDigest001'"
        ).fetch_one(&pool).await.unwrap();
        assert_eq!(gov_raw.0["vote_type"], "for");
        assert_eq!(gov_raw.0["protocol"], "generic");

        // Verify idempotency — re-insert should not duplicate
        for event in events {
            let event_type = event["type"].as_str().unwrap_or("");
            let lower = event_type.to_lowercase();
            if lower.contains("nft") {
                indexer::handlers::handle_nft_event(event, &pool).await.unwrap();
            }
        }
        let nft_count2: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM wallet_events WHERE tx_digest = 'IntTestNftDigest001'"
        ).fetch_one(&pool).await.unwrap();
        assert_eq!(nft_count2.0, 1, "Should still be 1 (idempotent)");

        // Cleanup
        sqlx::query("DELETE FROM wallet_events WHERE tx_digest LIKE 'IntTest%'")
            .execute(&pool).await.unwrap();
    }
}
```

**Step 4: Build test (dry run)**

Run: `cd packages/indexer && cargo test --features integration --no-run 2>&1`
Expected: Compiles

**Step 5: Commit**

```bash
git add packages/indexer/tests/ packages/indexer/Cargo.toml
git commit -m "test(indexer): add integration test with fixtures for full event pipeline"
```

---

## Task 8: Run Integration Tests with Docker DB

**Step 1: Start test DB**

Run: `docker compose up -d timescaledb 2>&1`

**Step 2: Ensure schema exists**

Run: `cd packages/indexer && sqlx database create --database-url "$DATABASE_URL" 2>&1 || true`

Then check if `wallet_events` table exists. If not, run the migration SQL from the indexer's schema file.

**Step 3: Run integration tests**

Run: `cd packages/indexer && cargo test --features integration -- --test-threads=1 2>&1`
Expected: All tests pass

**Step 4: Run all unit tests too**

Run: `cd packages/indexer && cargo test 2>&1`
Expected: Unit tests pass (integration tests skipped without feature flag)

**Step 5: Commit (if any test fixes needed)**

---

## Summary: P2-1 Task Order

| Task | Description | Depends on |
|------|-------------|------------|
| 1 | Wire Consumer -> Router | — |
| 2 | Integrate Enricher into Router | Task 1 |
| 3 | Add governance handler | Task 2 |
| 4 | Add WebhookDispatcher | Task 2 |
| 5 | Integrate AlertEngine | Task 4 |
| 6 | BFF webhook receiver | — (independent) |
| 7 | Integration test setup | Tasks 1-5 |
| 8 | Run integration tests | Tasks 6-7 |

Tasks 1-5 are sequential (Rust side). Task 6 is independent (BFF side, can be parallel).
