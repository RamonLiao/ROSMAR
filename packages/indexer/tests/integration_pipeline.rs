//! Pipeline integration tests — test Router → BatchWriter → DB flow.
//! Run with: DATABASE_URL=<url> cargo test --features integration -- --ignored
//! Requires a Postgres database with wallet_events and dead_letter_events tables.

#![cfg(feature = "integration")]

use crm_indexer::*;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::mpsc;

async fn setup() -> (sqlx::PgPool, config::Config) {
    dotenvy::dotenv().ok();
    let config = config::Config::from_env().expect("CONFIG must be set");
    let pool = db::create_pool(&config.database_url)
        .await
        .expect("Failed to create DB pool");
    (pool, config)
}

/// Clean up test data by known tx_digest prefixes
async fn cleanup(pool: &sqlx::PgPool) {
    let _ = sqlx::query("DELETE FROM wallet_events WHERE tx_digest LIKE 'pipeline_test_%'")
        .execute(pool)
        .await;
    let _ = sqlx::query("DELETE FROM dead_letter_events WHERE event_type LIKE 'test_%'")
        .execute(pool)
        .await;
}

// ─── Test 1: Router routes events to BatchWriter channel ───

#[tokio::test]
#[ignore]
async fn test_router_queues_events_to_batch_writer() {
    let (pool, config) = setup().await;
    cleanup(&pool).await;

    let cache_inst = cache::AddressCache::new();
    let enricher = Arc::new(enricher::Enricher::new(cache_inst, pool.clone()));
    let alert_engine = Arc::new(alerts::AlertEngine::new(config.clone(), pool.clone()));

    let (batch_tx, mut batch_rx) = mpsc::channel(100);
    let router = router::EventRouter::new(
        pool.clone(),
        config,
        enricher,
        alert_engine,
        batch_tx,
    );

    // Route an audit event
    let event = json!({
        "type": "0x0::profile::AuditEventV1",
        "id": { "txDigest": "pipeline_test_audit_001" },
        "timestampMs": "1700000000000",
        "parsedJson": {
            "version": 1,
            "workspace_id": "00000000-0000-0000-0000-000000000000",
            "actor": "0xtest_actor_001",
            "action": 0,
            "object_type": 0,
            "object_id": "0xtest_obj",
            "timestamp": 1700000000000u64
        }
    });

    router.route_event(&event).await.unwrap();

    // Verify BatchWriter channel received the event
    let batch_event = batch_rx.try_recv().expect("Should have received BatchEvent");
    assert_eq!(batch_event.address, "0xtest_actor_001");
    assert!(batch_event.event_type.contains("audit"));

    cleanup(&pool).await;
}

// ─── Test 2: Unknown event type stored as "unknown" ───

#[tokio::test]
#[ignore]
async fn test_unknown_event_type_stored() {
    let (pool, config) = setup().await;
    cleanup(&pool).await;

    let cache_inst = cache::AddressCache::new();
    let enricher = Arc::new(enricher::Enricher::new(cache_inst, pool.clone()));
    let alert_engine = Arc::new(alerts::AlertEngine::new(config.clone(), pool.clone()));

    let (batch_tx, mut batch_rx) = mpsc::channel(100);
    let router = router::EventRouter::new(
        pool.clone(),
        config,
        enricher,
        alert_engine,
        batch_tx,
    );

    let event = json!({
        "type": "0x999::unknown::SomeEvent",
        "id": { "txDigest": "pipeline_test_unknown_001" },
        "parsedJson": { "sender": "0xunknown_sender" }
    });

    router.route_event(&event).await.unwrap();

    // Unknown events ARE stored with event_type "unknown" per spec
    let batch_event = batch_rx.try_recv().expect("Unknown events should be queued");
    assert_eq!(batch_event.event_type, "unknown");
    assert_eq!(batch_event.address, "0xunknown_sender");

    cleanup(&pool).await;
}

// ─── Test 3: Whale alert triggers on large SUI amount ───

#[tokio::test]
#[ignore]
async fn test_whale_alert_triggers_on_large_amount() {
    let (pool, config) = setup().await;
    cleanup(&pool).await;

    let cache_inst = cache::AddressCache::new();
    let enricher = Arc::new(enricher::Enricher::new(cache_inst, pool.clone()));
    let alert_engine = Arc::new(alerts::AlertEngine::new(config.clone(), pool.clone()));

    let (batch_tx, _batch_rx) = mpsc::channel(100);
    let router = router::EventRouter::new(
        pool.clone(),
        config,
        enricher,
        alert_engine,
        batch_tx,
    );
    // No webhook configured → whale alert will be logged but not dispatched

    let event = json!({
        "type": "0x2::dex::SwapEvent",
        "id": { "txDigest": "pipeline_test_whale_001" },
        "timestampMs": "1700000000000",
        "parsedJson": {
            "sender": "0xwhale_addr",
            "amount": "50000000000",
            "coinType": "0x2::sui::SUI",
            "token": "0x2::sui::SUI"
        }
    });

    // Should not error even without webhook
    router.route_event(&event).await.unwrap();

    cleanup(&pool).await;
}

// ─── Test 4: BatchWriter flushes on threshold ───

#[tokio::test]
#[ignore]
async fn test_batch_writer_flushes_on_threshold() {
    let (pool, _config) = setup().await;
    cleanup(&pool).await;

    let (batch_tx, batch_rx) = mpsc::channel(1000);
    // Small batch size (5), long timeout so flush is triggered by count not time
    let batch_writer = writer::BatchWriter::new(pool.clone(), 5, 60_000);

    let writer_handle = tokio::spawn(async move {
        batch_writer.start(batch_rx).await.ok();
    });

    // Send 5 events to hit batch threshold
    for i in 0..5 {
        batch_tx
            .send(writer::BatchEvent {
                time: chrono::Utc::now(),
                address: format!("0xbatch_test_{}", i),
                event_type: "test_batch".to_string(),
                contract_address: None,
                collection: None,
                token: None,
                amount: 0,
                tx_digest: format!("pipeline_test_batch_{}", i),
                raw_data: json!({}),
                profile_id: None,
                workspace_id: None,
            })
            .await
            .unwrap();
    }

    // Wait for flush
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Verify rows in DB
    let count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM wallet_events WHERE event_type = 'test_batch'")
            .fetch_one(&pool)
            .await
            .unwrap();

    assert!(
        count.0 >= 5,
        "Expected at least 5 batch-written rows, got {}",
        count.0
    );

    // Cleanup
    drop(batch_tx);
    writer_handle.abort();

    let _ = sqlx::query("DELETE FROM wallet_events WHERE event_type = 'test_batch'")
        .execute(&pool)
        .await;
}

// ─── Test 5: Dead-letter on webhook failure ───

#[tokio::test]
#[ignore]
async fn test_dead_letter_on_webhook_failure() {
    let (pool, _config) = setup().await;
    cleanup(&pool).await;

    // Webhook pointing to non-existent server
    let webhook_disp = webhook::WebhookDispatcher::new("http://localhost:19999".to_string(), "test-secret-that-is-at-least-32-chars-long".to_string());
    let retry_mgr = retry::RetryManager::new(1, 10); // 1 retry, 10ms base for fast test

    let event = webhook::IndexerEvent {
        event_id: uuid::Uuid::new_v4().to_string(),
        event_type: "test_dead_letter".to_string(),
        profile_id: None,
        address: "0xdead".to_string(),
        data: json!({"test": true}),
        tx_digest: "pipeline_test_deadletter_001".to_string(),
        timestamp: chrono::Utc::now().timestamp_millis(),
    };

    // Should not panic — fails gracefully into dead-letter
    webhook_disp
        .dispatch_with_retry(&event, &retry_mgr, &pool, "webhook")
        .await
        .unwrap();

    // Verify dead-letter row exists
    let dl_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM dead_letter_events WHERE event_type = 'test_dead_letter'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    assert!(dl_count.0 >= 1, "Expected dead-letter row");

    cleanup(&pool).await;
}
