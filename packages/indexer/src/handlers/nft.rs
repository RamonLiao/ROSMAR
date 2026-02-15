use serde_json::Value;
use sqlx::PgPool;

/// Handle NFT-related events (mint, transfer, burn)
pub async fn handle_nft_event(
    pool: &PgPool,
    event: &Value,
) -> Result<(), Box<dyn std::error::Error>> {
    let event_type = event
        .get("type")
        .and_then(|t| t.as_str())
        .unwrap_or("unknown");

    tracing::debug!("Processing NFT event: {}", event_type);

    // Extract event data
    let data = event.get("parsedJson").unwrap_or(event);

    // Extract common fields
    let address = data
        .get("sender")
        .or_else(|| data.get("recipient"))
        .and_then(|a| a.as_str())
        .unwrap_or("0x0");

    let collection = data
        .get("collection")
        .or_else(|| data.get("packageId"))
        .and_then(|c| c.as_str());

    let token = data
        .get("objectId")
        .or_else(|| data.get("nftId"))
        .and_then(|t| t.as_str());

    let tx_digest = event
        .get("id")
        .and_then(|id| id.get("txDigest"))
        .and_then(|d| d.as_str())
        .unwrap_or("unknown");

    let timestamp_ms = event
        .get("timestampMs")
        .and_then(|t| t.as_str())
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or_else(|| chrono::Utc::now().timestamp_millis());

    // Determine event type
    let event_category = if event_type.contains("Mint") {
        "mint"
    } else if event_type.contains("Burn") {
        "burn"
    } else if event_type.contains("Transfer") {
        "transfer"
    } else {
        "nft_event"
    };

    // Insert into wallet_events
    sqlx::query(
        "INSERT INTO wallet_events
         (time, address, event_type, collection, token, amount, tx_digest, raw_data)
         VALUES (to_timestamp($1::double precision / 1000), $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (time, tx_digest, address) DO NOTHING"
    )
    .bind(timestamp_ms)
    .bind(address)
    .bind(event_category)
    .bind(collection)
    .bind(token)
    .bind(1i64) // NFT count = 1
    .bind(tx_digest)
    .bind(event)
    .execute(pool)
    .await?;

    tracing::debug!(
        "Inserted NFT event: {} for address {} (tx: {})",
        event_category,
        address,
        tx_digest
    );

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    #[ignore] // Requires database
    async fn test_handle_nft_event() {
        let database_url = std::env::var("DATABASE_URL").unwrap();
        let pool = crate::db::create_pool(&database_url).await.unwrap();

        let event = json!({
            "type": "0x2::nft::MintNFTEvent",
            "id": {
                "txDigest": "test_tx_123"
            },
            "timestampMs": "1234567890000",
            "parsedJson": {
                "sender": "0x123",
                "collection": "0xabc",
                "objectId": "0xdef"
            }
        });

        handle_nft_event(&pool, &event).await.unwrap();
    }
}
