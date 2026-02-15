use serde_json::Value;
use sqlx::PgPool;

/// Handle CRM AuditEventV1 events
pub async fn handle_audit_event(
    pool: &PgPool,
    event: &Value,
) -> Result<(), Box<dyn std::error::Error>> {
    tracing::debug!("Processing AuditEventV1");

    // Extract event data
    let data = event.get("parsedJson").unwrap_or(event);

    // Check version field
    let version = data
        .get("version")
        .and_then(|v| v.as_u64())
        .unwrap_or(1);

    if version != 1 {
        tracing::warn!("Unsupported AuditEvent version: {}", version);
        return Ok(());
    }

    // Extract fields
    let workspace_id = data
        .get("workspace_id")
        .and_then(|w| w.as_str())
        .ok_or("Missing workspace_id")?;

    let actor_address = data
        .get("actor")
        .and_then(|a| a.as_str())
        .ok_or("Missing actor")?;

    let action = data
        .get("action")
        .and_then(|a| a.as_u64())
        .ok_or("Missing action")? as i16;

    let object_type = data
        .get("object_type")
        .and_then(|o| o.as_u64())
        .ok_or("Missing object_type")? as i16;

    let object_id = data
        .get("object_id")
        .and_then(|o| o.as_str())
        .ok_or("Missing object_id")?;

    let tx_digest = event
        .get("id")
        .and_then(|id| id.get("txDigest"))
        .and_then(|d| d.as_str())
        .unwrap_or("unknown");

    let timestamp_ms = data
        .get("timestamp")
        .and_then(|t| t.as_u64())
        .or_else(|| {
            event
                .get("timestampMs")
                .and_then(|t| t.as_str())
                .and_then(|s| s.parse::<u64>().ok())
        })
        .unwrap_or_else(|| chrono::Utc::now().timestamp_millis() as u64);

    // Parse workspace_id as UUID
    let workspace_uuid = uuid::Uuid::parse_str(workspace_id)
        .or_else(|_| {
            // If not a valid UUID, try to lookup by sui_object_id
            Ok::<uuid::Uuid, uuid::Error>(uuid::Uuid::nil())
        })
        .unwrap_or(uuid::Uuid::nil());

    // Insert into audit_logs
    sqlx::query(
        "INSERT INTO audit_logs
         (workspace_id, actor_address, action, object_type, object_id, tx_hash, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8::double precision / 1000))
         ON CONFLICT DO NOTHING"
    )
    .bind(workspace_uuid)
    .bind(actor_address)
    .bind(action)
    .bind(object_type)
    .bind(object_id)
    .bind(tx_digest)
    .bind(event)
    .bind(timestamp_ms as i64)
    .execute(pool)
    .await?;

    tracing::debug!(
        "Inserted audit log: action={} object_type={} object_id={} (tx: {})",
        action,
        object_type,
        object_id,
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

        handle_audit_event(&pool, &event).await.unwrap();
    }
}
