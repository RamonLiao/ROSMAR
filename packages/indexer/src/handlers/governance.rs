use serde_json::Value;
use sqlx::PgPool;

/// Handle governance events (voting, proposals, DAO participation)
pub async fn handle_governance_event(
    pool: &PgPool,
    event: &Value,
) -> Result<(), Box<dyn std::error::Error>> {
    let event_type = event
        .get("type")
        .and_then(|t| t.as_str())
        .unwrap_or("unknown");

    tracing::debug!("Processing governance event: {}", event_type);

    // Extract event data
    let data = event.get("parsedJson").unwrap_or(event);

    // Extract common governance fields
    let voter = data
        .get("voter")
        .or_else(|| data.get("sender"))
        .or_else(|| data.get("user"))
        .and_then(|a| a.as_str())
        .unwrap_or("0x0");

    let proposal_id = data
        .get("proposal_id")
        .or_else(|| data.get("proposalId"))
        .and_then(|p| p.as_str())
        .unwrap_or("unknown");

    let vote_type = data
        .get("vote_type")
        .or_else(|| data.get("voteType"))
        .or_else(|| data.get("vote"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    let weight = data
        .get("weight")
        .or_else(|| data.get("votingPower"))
        .or_else(|| data.get("amount"))
        .and_then(|w| w.as_str().and_then(|s| s.parse::<i64>().ok()).or_else(|| w.as_i64()))
        .unwrap_or(1);

    let protocol = data
        .get("protocol")
        .or_else(|| data.get("dao"))
        .and_then(|p| p.as_str());

    let dao_id = data
        .get("dao_id")
        .or_else(|| data.get("daoId"))
        .and_then(|d| d.as_str());

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
    let event_category = if event_type.contains("Vote") || event_type.contains("vote") {
        "vote"
    } else if event_type.contains("Proposal") || event_type.contains("proposal") {
        "proposal"
    } else if event_type.contains("Delegate") || event_type.contains("delegate") {
        "delegate"
    } else {
        "governance_event"
    };

    // Build extended data JSON with governance-specific fields
    let extended_data = serde_json::json!({
        "voter": voter,
        "proposal_id": proposal_id,
        "vote_type": vote_type,
        "weight": weight,
        "protocol": protocol,
        "dao_id": dao_id,
        "original_event": event,
    });

    // Insert into wallet_events with ON CONFLICT idempotency
    sqlx::query(
        "INSERT INTO wallet_events
         (time, address, event_type, contract_address, token, amount, tx_digest, raw_data)
         VALUES (to_timestamp($1::double precision / 1000), $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (time, tx_digest, address) DO NOTHING"
    )
    .bind(timestamp_ms)
    .bind(voter)
    .bind(event_category)
    .bind(protocol)         // contract_address = protocol
    .bind(dao_id)           // token = dao_id (repurposed)
    .bind(weight)
    .bind(tx_digest)
    .bind(&extended_data)
    .execute(pool)
    .await?;

    tracing::debug!(
        "Inserted governance event: {} by {} on proposal {} (tx: {})",
        event_category,
        voter,
        proposal_id,
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
    async fn test_handle_governance_event() {
        let database_url = std::env::var("DATABASE_URL").unwrap();
        let pool = crate::db::create_pool(&database_url).await.unwrap();

        let event = json!({
            "type": "0x2::dao::VoteEvent",
            "id": {
                "txDigest": "test_tx_gov_123"
            },
            "timestampMs": "1234567890000",
            "parsedJson": {
                "voter": "0xvoter123",
                "proposal_id": "prop_001",
                "vote_type": "for",
                "weight": "1000",
                "protocol": "0xdao_protocol",
                "dao_id": "dao_001"
            }
        });

        handle_governance_event(&pool, &event).await.unwrap();
    }
}
