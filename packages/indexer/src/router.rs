use crate::enricher::Enricher;
use crate::handlers::{audit, defi, governance, nft};
use crate::webhook::WebhookDispatcher;
use serde_json::Value;
use sqlx::PgPool;
use std::sync::Arc;

/// Event router dispatches events to appropriate handlers based on event type
pub struct EventRouter {
    pool: PgPool,
    enricher: Arc<Enricher>,
    webhook: Option<Arc<WebhookDispatcher>>,
}

impl EventRouter {
    pub fn new(pool: PgPool, enricher: Arc<Enricher>) -> Self {
        Self { pool, enricher, webhook: None }
    }

    pub fn with_webhook(mut self, webhook: Arc<WebhookDispatcher>) -> Self {
        self.webhook = Some(webhook);
        self
    }

    /// Check if an event type is a governance event
    fn is_governance_event(event_type: &str) -> bool {
        event_type.contains("VoteEvent")
            || event_type.contains("ProposalEvent")
            || event_type.contains("DelegateEvent")
            || event_type.contains("GovernanceEvent")
            || event_type.contains("vote")
            || event_type.contains("proposal")
            || event_type.contains("delegate")
    }

    /// Extract the primary address from an event's parsedJson
    fn extract_address(event: &Value) -> Option<&str> {
        let data = event.get("parsedJson").unwrap_or(event);
        data.get("sender")
            .or_else(|| data.get("user"))
            .or_else(|| data.get("actor"))
            .or_else(|| data.get("recipient"))
            .and_then(|a| a.as_str())
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

            // Governance events
            t if Self::is_governance_event(t) => {
                governance::handle_governance_event(&self.pool, event).await?;
            }

            // Unknown event type - log and skip
            _ => {
                tracing::trace!("Unhandled event type: {}", event_type);
                return Ok(());
            }
        }

        // After handler writes, resolve address -> profile_id for enrichment
        let address = Self::extract_address(event)
            .unwrap_or("0x0")
            .to_string();
        let profile_id = match self.enricher.resolve_address(&address).await {
            Ok(Some(pid)) => {
                tracing::debug!("Enriched address {} -> profile {}", address, pid);
                Some(pid)
            }
            Ok(None) => {
                tracing::trace!("No profile found for address {}", address);
                None
            }
            Err(e) => {
                tracing::warn!("Enrichment failed for address {}: {}", address, e);
                None
            }
        };

        // Fire-and-forget webhook dispatch to BFF
        if let Some(ref webhook) = self.webhook {
            let indexer_event = WebhookDispatcher::build_event(
                event,
                event_type,
                &address,
                profile_id,
            );
            let wh = webhook.clone();
            tokio::spawn(async move {
                if let Err(e) = wh.dispatch(&indexer_event).await {
                    tracing::warn!("Webhook dispatch error: {}", e);
                }
            });
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
        let cache = crate::cache::AddressCache::new();
        let enricher = Arc::new(crate::enricher::Enricher::new(cache, pool.clone()));
        let router = EventRouter::new(pool, enricher);

        let event = json!({
            "type": "0x123::profile::AuditEventV1",
            "data": {}
        });

        router.route_event(&event).await.unwrap();
    }
}
