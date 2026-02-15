use crate::handlers::{audit, defi, nft};
use serde_json::Value;
use sqlx::PgPool;

/// Event router dispatches events to appropriate handlers based on event type
pub struct EventRouter {
    pool: PgPool,
}

impl EventRouter {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Route event to appropriate handler
    pub async fn route_event(&self, event: &Value) -> Result<(), Box<dyn std::error::Error>> {
        // Extract event type
        let event_type = event
            .get("type")
            .and_then(|t| t.as_str())
            .ok_or("Missing event type")?;

        tracing::debug!("Routing event type: {}", event_type);

        // Match event type and dispatch to handler
        match event_type {
            // CRM audit events
            t if t.contains("AuditEventV1") => {
                audit::handle_audit_event(&self.pool, event).await?;
            }

            // NFT events
            t if t.contains("MintNFTEvent")
                || t.contains("TransferObject")
                || t.contains("BurnEvent") => {
                nft::handle_nft_event(&self.pool, event).await?;
            }

            // DeFi events
            t if t.contains("SwapEvent")
                || t.contains("AddLiquidityEvent")
                || t.contains("StakeEvent")
                || t.contains("UnstakeEvent") => {
                defi::handle_defi_event(&self.pool, event).await?;
            }

            // Unknown event type - log and skip
            _ => {
                tracing::trace!("Unhandled event type: {}", event_type);
            }
        }

        Ok(())
    }

    /// Batch route multiple events
    pub async fn route_batch(&self, events: &[Value]) -> Result<(), Box<dyn std::error::Error>> {
        for event in events {
            if let Err(e) = self.route_event(event).await {
                tracing::error!("Error routing event: {}", e);
                // Continue processing other events
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    #[ignore] // Requires database
    async fn test_route_event() {
        let database_url = std::env::var("DATABASE_URL").unwrap();
        let pool = crate::db::create_pool(&database_url).await.unwrap();
        let router = EventRouter::new(pool);

        let event = json!({
            "type": "0x123::profile::AuditEventV1",
            "data": {}
        });

        router.route_event(&event).await.unwrap();
    }
}
