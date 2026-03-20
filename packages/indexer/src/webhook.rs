use crate::retry::RetryManager;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// Unified event payload sent to BFF via webhook
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexerEvent {
    pub event_id: String,
    pub event_type: String,
    pub profile_id: Option<Uuid>,
    pub address: String,
    pub data: Value,
    pub tx_digest: String,
    pub timestamp: i64,
}

/// WebhookDispatcher fires HTTP POST to BFF for every processed event
pub struct WebhookDispatcher {
    client: Client,
    webhook_url: String,
}

impl WebhookDispatcher {
    pub fn new(webhook_url: String) -> Self {
        Self {
            client: Client::new(),
            webhook_url,
        }
    }

    /// Build an IndexerEvent from raw event data + enrichment results
    pub fn build_event(
        event: &Value,
        event_type: &str,
        address: &str,
        profile_id: Option<Uuid>,
    ) -> IndexerEvent {
        let tx_digest = event
            .get("id")
            .and_then(|id| id.get("txDigest"))
            .and_then(|d| d.as_str())
            .unwrap_or("unknown")
            .to_string();

        let timestamp = event
            .get("timestampMs")
            .and_then(|t| t.as_str())
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or_else(|| chrono::Utc::now().timestamp_millis());

        IndexerEvent {
            event_id: Uuid::new_v4().to_string(),
            event_type: event_type.to_string(),
            profile_id,
            address: address.to_string(),
            data: event.clone(),
            tx_digest,
            timestamp,
        }
    }

    /// Dispatch an IndexerEvent to the BFF webhook endpoint
    pub async fn dispatch(&self, event: &IndexerEvent) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/webhooks/indexer-event", self.webhook_url);

        let response = self
            .client
            .post(&url)
            .json(event)
            .send()
            .await?;

        if response.status().is_success() {
            tracing::debug!(
                "Webhook dispatched: {} (tx: {})",
                event.event_type,
                event.tx_digest
            );
        } else {
            tracing::warn!(
                "Webhook failed with status {}: {} (tx: {})",
                response.status(),
                event.event_type,
                event.tx_digest
            );
        }

        Ok(())
    }

    /// Dispatch an IndexerEvent with retry and dead-letter on exhaustion
    pub async fn dispatch_with_retry(
        &self,
        event: &IndexerEvent,
        retry: &RetryManager,
        pool: &sqlx::PgPool,
        source: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let event_clone = event.clone();
        let result = retry
            .execute(|| {
                let e = event_clone.clone();
                let url = format!("{}/webhooks/indexer-event", self.webhook_url);
                let client = self.client.clone();
                async move {
                    let response = client
                        .post(&url)
                        .json(&e)
                        .timeout(std::time::Duration::from_secs(10))
                        .send()
                        .await
                        .map_err(|e| format!("HTTP error: {}", e))?;
                    if response.status().is_success() {
                        Ok(())
                    } else {
                        Err(format!("HTTP {}", response.status()))
                    }
                }
            })
            .await;

        if let Err(e) = result {
            tracing::error!("Webhook exhausted retries for {}: {}", event.event_type, e);
            crate::db::insert_dead_letter(
                pool,
                &event.event_type,
                &event.data,
                &e,
                source,
                retry.max_retries() as i32,
            )
            .await
            .map_err(|e| -> Box<dyn std::error::Error + Send + Sync> {
                format!("Dead-letter insert failed: {}", e).into()
            })?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_build_event() {
        let raw_event = json!({
            "type": "0x2::dex::SwapEvent",
            "id": {
                "txDigest": "abc123"
            },
            "timestampMs": "1700000000000",
            "parsedJson": {
                "sender": "0xuser1",
                "amount": "1000"
            }
        });

        let profile_id = Uuid::new_v4();
        let event = WebhookDispatcher::build_event(
            &raw_event,
            "swap",
            "0xuser1",
            Some(profile_id),
        );

        assert_eq!(event.event_type, "swap");
        assert_eq!(event.address, "0xuser1");
        assert_eq!(event.profile_id, Some(profile_id));
        assert_eq!(event.tx_digest, "abc123");
        assert_eq!(event.timestamp, 1700000000000);
        assert!(!event.event_id.is_empty());
    }

    #[test]
    fn test_build_event_defaults() {
        let raw_event = json!({
            "type": "0x2::nft::MintNFTEvent",
            "parsedJson": {}
        });

        let event = WebhookDispatcher::build_event(
            &raw_event,
            "mint",
            "0x0",
            None,
        );

        assert_eq!(event.tx_digest, "unknown");
        assert!(event.profile_id.is_none());
        // timestamp should be a recent epoch ms
        assert!(event.timestamp > 0);
    }
}
