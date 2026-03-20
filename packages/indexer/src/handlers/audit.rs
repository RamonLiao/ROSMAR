use crate::handlers::WalletEvent;
use serde_json::Value;
use sqlx::PgPool;

/// Handle CRM AuditEventV1 events
/// Keeps pool param for audit_logs side-effect INSERT, returns WalletEvent
pub async fn handle_audit_event(
    pool: &PgPool,
    event: &Value,
) -> Result<WalletEvent, Box<dyn std::error::Error>> {
    tracing::debug!("Processing AuditEventV1");

    let data = event.get("parsedJson").unwrap_or(event);

    let version = data.get("version").and_then(|v| v.as_u64()).unwrap_or(1);
    if version != 1 {
        return Err(format!("Unsupported AuditEvent version: {}", version).into());
    }

    let address = WalletEvent::extract_address(event);
    let tx_digest = WalletEvent::extract_tx_digest(event);

    let action = data.get("action").and_then(|a| a.as_u64()).unwrap_or(0) as i16;
    let object_type = data.get("object_type").and_then(|o| o.as_u64()).unwrap_or(0) as i16;
    let object_id = data.get("object_id").and_then(|o| o.as_str()).unwrap_or("unknown");
    let workspace_id = data.get("workspace_id").and_then(|w| w.as_str())
        .unwrap_or("00000000-0000-0000-0000-000000000000");
    let workspace_uuid = uuid::Uuid::parse_str(workspace_id).unwrap_or(uuid::Uuid::nil());
    let timestamp_ms = data.get("timestamp").and_then(|t| t.as_u64())
        .unwrap_or_else(|| chrono::Utc::now().timestamp_millis() as u64);

    // Side-effect: audit_logs INSERT (separate table, different schema)
    let _ = sqlx::query(
        "INSERT INTO audit_logs
         (workspace_id, actor_address, action, object_type, object_id, tx_hash, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8::double precision / 1000))
         ON CONFLICT DO NOTHING"
    )
    .bind(workspace_uuid)
    .bind(&address)
    .bind(action)
    .bind(object_type)
    .bind(object_id)
    .bind(&tx_digest)
    .bind(event)
    .bind(timestamp_ms as i64)
    .execute(pool)
    .await;

    Ok(WalletEvent {
        address,
        event_type: format!("audit_action_{}", action),
        contract_address: None,
        collection: None,
        token: None,
        amount: 0,
        tx_digest,
        raw_data: event.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    #[ignore] // Requires database
    async fn test_handle_audit_event() {
        let database_url = std::env::var("DATABASE_URL").unwrap();
        let pool = crate::db::create_pool(&database_url).await.unwrap();

        let event = json!({
            "type": "0x123::profile::AuditEventV1",
            "id": {
                "txDigest": "test_tx_audit"
            },
            "timestampMs": "1234567890000",
            "parsedJson": {
                "version": 1,
                "workspace_id": "00000000-0000-0000-0000-000000000000",
                "actor": "0x789",
                "action": 0,
                "object_type": 0,
                "object_id": "0xprofile123",
                "timestamp": 1234567890000u64
            }
        });

        let wallet_event = handle_audit_event(&pool, &event).await.unwrap();
        assert_eq!(wallet_event.address, "0x789");
        assert_eq!(wallet_event.event_type, "audit_action_0");
        assert_eq!(wallet_event.tx_digest, "test_tx_audit");
    }
}
