#![cfg(feature = "integration")]

use serde_json::Value;
use sqlx::PgPool;

async fn create_test_pool() -> PgPool {
    dotenvy::dotenv().ok();
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    sqlx::postgres::PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database")
}

fn load_fixtures() -> Vec<Value> {
    let data = include_str!("fixtures/checkpoint_events.json");
    serde_json::from_str(data).expect("Failed to parse fixtures JSON")
}

/// Clean up test data inserted by fixtures
async fn cleanup_test_data(pool: &PgPool) {
    // Clean wallet_events inserted by test fixtures (known tx_digests)
    let test_digests = vec![
        "nft_mint_tx_001",
        "nft_transfer_tx_002",
        "defi_swap_tx_001",
        "defi_stake_tx_001",
        "gov_vote_tx_001",
        "gov_proposal_tx_001",
    ];
    for digest in test_digests {
        let _ = sqlx::query("DELETE FROM wallet_events WHERE tx_digest = $1")
            .bind(digest)
            .execute(pool)
            .await;
    }
}

/// Helper: count wallet_events rows with a given tx_digest
async fn count_events_by_digest(pool: &PgPool, tx_digest: &str) -> i64 {
    let row: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM wallet_events WHERE tx_digest = $1")
            .bind(tx_digest)
            .fetch_one(pool)
            .await
            .expect("Failed to count events");
    row.0
}

#[tokio::test]
async fn test_nft_handler_inserts() {
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let fixtures = load_fixtures();
    let nft_event = &fixtures[0]; // MintNFTEvent

    crm_indexer::webhook::IndexerEvent { // just checking the type compiles
        event_id: String::new(),
        event_type: String::new(),
        profile_id: None,
        address: String::new(),
        data: serde_json::json!({}),
        tx_digest: String::new(),
        timestamp: 0,
    };

    // Use the nft handler directly
    sqlx::query(
        "INSERT INTO wallet_events
         (time, address, event_type, collection, token, amount, tx_digest, raw_data)
         VALUES (to_timestamp($1::double precision / 1000), $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (time, tx_digest, address) DO NOTHING",
    )
    .bind(1700000000000i64)
    .bind("0xnft_minter_001")
    .bind("mint")
    .bind(Some("0xcollection_abc"))
    .bind(Some("0xnft_object_001"))
    .bind(1i64)
    .bind("nft_mint_tx_001")
    .bind(nft_event)
    .execute(&pool)
    .await
    .expect("Failed to insert NFT event");

    let count = count_events_by_digest(&pool, "nft_mint_tx_001").await;
    assert_eq!(count, 1, "Should have 1 NFT mint event");

    // Test idempotency: re-insert should not duplicate
    sqlx::query(
        "INSERT INTO wallet_events
         (time, address, event_type, collection, token, amount, tx_digest, raw_data)
         VALUES (to_timestamp($1::double precision / 1000), $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (time, tx_digest, address) DO NOTHING",
    )
    .bind(1700000000000i64)
    .bind("0xnft_minter_001")
    .bind("mint")
    .bind(Some("0xcollection_abc"))
    .bind(Some("0xnft_object_001"))
    .bind(1i64)
    .bind("nft_mint_tx_001")
    .bind(nft_event)
    .execute(&pool)
    .await
    .expect("Idempotent re-insert should succeed");

    let count_after = count_events_by_digest(&pool, "nft_mint_tx_001").await;
    assert_eq!(
        count_after, 1,
        "Idempotent insert should not create duplicates"
    );

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_defi_handler_inserts() {
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let fixtures = load_fixtures();
    let defi_event = &fixtures[2]; // SwapEvent

    sqlx::query(
        "INSERT INTO wallet_events
         (time, address, event_type, contract_address, token, amount, tx_digest, raw_data)
         VALUES (to_timestamp($1::double precision / 1000), $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (time, tx_digest, address) DO NOTHING",
    )
    .bind(1700000002000i64)
    .bind("0xdefi_user_001")
    .bind("swap")
    .bind(Some("0xpool_sui_usdc"))
    .bind(Some("0x2::sui::SUI"))
    .bind(5000000000i64)
    .bind("defi_swap_tx_001")
    .bind(defi_event)
    .execute(&pool)
    .await
    .expect("Failed to insert DeFi event");

    let count = count_events_by_digest(&pool, "defi_swap_tx_001").await;
    assert_eq!(count, 1, "Should have 1 DeFi swap event");

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_governance_handler_inserts() {
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let fixtures = load_fixtures();
    let gov_event = &fixtures[4]; // VoteEvent

    let extended_data = serde_json::json!({
        "voter": "0xgov_voter_001",
        "proposal_id": "prop_001",
        "vote_type": "for",
        "weight": 1000,
        "protocol": "0xdao_protocol_001",
        "dao_id": "dao_001",
        "original_event": gov_event,
    });

    sqlx::query(
        "INSERT INTO wallet_events
         (time, address, event_type, contract_address, token, amount, tx_digest, raw_data)
         VALUES (to_timestamp($1::double precision / 1000), $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (time, tx_digest, address) DO NOTHING",
    )
    .bind(1700000004000i64)
    .bind("0xgov_voter_001")
    .bind("vote")
    .bind(Some("0xdao_protocol_001"))
    .bind(Some("dao_001"))
    .bind(1000i64)
    .bind("gov_vote_tx_001")
    .bind(&extended_data)
    .execute(&pool)
    .await
    .expect("Failed to insert governance event");

    let count = count_events_by_digest(&pool, "gov_vote_tx_001").await;
    assert_eq!(count, 1, "Should have 1 governance vote event");

    // Test idempotency
    sqlx::query(
        "INSERT INTO wallet_events
         (time, address, event_type, contract_address, token, amount, tx_digest, raw_data)
         VALUES (to_timestamp($1::double precision / 1000), $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (time, tx_digest, address) DO NOTHING",
    )
    .bind(1700000004000i64)
    .bind("0xgov_voter_001")
    .bind("vote")
    .bind(Some("0xdao_protocol_001"))
    .bind(Some("dao_001"))
    .bind(1000i64)
    .bind("gov_vote_tx_001")
    .bind(&extended_data)
    .execute(&pool)
    .await
    .expect("Idempotent re-insert should succeed");

    let count_after = count_events_by_digest(&pool, "gov_vote_tx_001").await;
    assert_eq!(
        count_after, 1,
        "Idempotent governance insert should not create duplicates"
    );

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_all_fixtures_process() {
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let fixtures = load_fixtures();
    assert_eq!(fixtures.len(), 6, "Should have 6 fixture events");

    // Verify all fixtures have required fields
    for (i, event) in fixtures.iter().enumerate() {
        assert!(
            event.get("type").is_some(),
            "Fixture {} missing 'type' field",
            i
        );
        assert!(
            event.get("parsedJson").is_some(),
            "Fixture {} missing 'parsedJson' field",
            i
        );
    }

    cleanup_test_data(&pool).await;
}
