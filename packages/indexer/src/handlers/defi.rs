use serde_json::Value;
use sqlx::PgPool;

/// Handle DeFi events (swap, stake, add liquidity, etc.)
pub async fn handle_defi_event(
    pool: &PgPool,
    event: &Value,
) -> Result<(), Box<dyn std::error::Error>> {
    let event_type = event
        .get("type")
        .and_then(|t| t.as_str())
        .unwrap_or("unknown");

    tracing::debug!("Processing DeFi event: {}", event_type);

    // Extract event data
    let data = event.get("parsedJson").unwrap_or(event);

    // Extract common fields
    let address = data
        .get("sender")
        .or_else(|| data.get("user"))
        .and_then(|a| a.as_str())
        .unwrap_or("0x0");

    let contract_address = data
        .get("pool")
        .or_else(|| data.get("protocol"))
        .and_then(|c| c.as_str());

    let token = data
        .get("coinType")
        .or_else(|| data.get("token"))
        .and_then(|t| t.as_str());

    let amount = data
        .get("amount")
        .or_else(|| data.get("value"))
        .and_then(|a| a.as_str())
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(0);

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

    // Determine event category
    let event_category = if event_type.contains("Swap") {
        "swap"
    } else if event_type.contains("Stake") {
        "stake"
    } else if event_type.contains("Unstake") {
        "unstake"
    } else if event_type.contains("Liquidity") {
        "add_liquidity"
    } else {
        "defi_event"
    };

    // Insert into wallet_events
    sqlx::query(
        "INSERT INTO wallet_events
         (time, address, event_type, contract_address, token, amount, tx_digest, raw_data)
         VALUES (to_timestamp($1::double precision / 1000), $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (time, tx_digest, address) DO NOTHING"
    )
    .bind(timestamp_ms)
    .bind(address)
    .bind(event_category)
    .bind(contract_address)
    .bind(token)
    .bind(amount)
    .bind(tx_digest)
    .bind(event)
    .execute(pool)
    .await?;

    tracing::debug!(
        "Inserted DeFi event: {} for address {} (tx: {})",
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
    async fn test_handle_defi_event() {
        let database_url = std::env::var("DATABASE_URL").unwrap();
        let pool = crate::db::create_pool(&database_url).await.unwrap();

        let event = json!({
            "type": "0x2::dex::SwapEvent",
            "id": {
                "txDigest": "test_tx_456"
            },
            "timestampMs": "1234567890000",
            "parsedJson": {
                "sender": "0x456",
                "pool": "0xpool123",
                "coinType": "0x2::sui::SUI",
                "amount": "1000000000"
            }
        });

        handle_defi_event(&pool, &event).await.unwrap();
    }
}
