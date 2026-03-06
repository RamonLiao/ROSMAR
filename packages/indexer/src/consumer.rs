use crate::config::Config;
use crate::router::EventRouter;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use std::sync::Arc;

/// Checkpoint consumer — polls Sui fullnode for new checkpoints
pub struct CheckpointConsumer {
    client: Client,
    rpc_url: String,
    pool: PgPool,
    config: Config,
    router: Arc<EventRouter>,
}

#[derive(Debug, Deserialize)]
struct CheckpointResponse {
    result: Option<CheckpointData>,
}

#[derive(Debug, Deserialize)]
struct CheckpointData {
    #[serde(rename = "sequenceNumber")]
    sequence_number: String,
    transactions: Vec<String>,
}

#[derive(Debug, Serialize)]
struct RpcRequest {
    jsonrpc: String,
    id: u64,
    method: String,
    params: Vec<Value>,
}

impl CheckpointConsumer {
    pub fn new(config: Config, pool: PgPool, router: Arc<EventRouter>) -> Self {
        Self {
            client: Client::new(),
            rpc_url: config.sui_rpc_url.clone(),
            pool,
            config,
            router,
        }
    }

    /// Start consuming checkpoints from last known position
    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut current_checkpoint = crate::db::get_last_checkpoint(&self.pool).await?;

        tracing::info!(
            "Starting checkpoint consumer from checkpoint {}",
            current_checkpoint
        );

        loop {
            match self.fetch_checkpoint(current_checkpoint).await {
                Ok(Some(checkpoint_data)) => {
                    tracing::debug!(
                        "Processing checkpoint {} with {} transactions",
                        checkpoint_data.sequence_number,
                        checkpoint_data.transactions.len()
                    );

                    // Process transactions in this checkpoint
                    for tx_digest in &checkpoint_data.transactions {
                        if let Err(e) = self.process_transaction(tx_digest).await {
                            tracing::error!(
                                "Error processing transaction {}: {}",
                                tx_digest,
                                e
                            );
                        }
                    }

                    // Update checkpoint progress
                    current_checkpoint = checkpoint_data.sequence_number.parse()?;
                    crate::db::update_checkpoint(&self.pool, current_checkpoint).await?;

                    tracing::info!("Checkpoint {} processed successfully", current_checkpoint);
                }
                Ok(None) => {
                    // No new checkpoint yet, wait and retry
                    tracing::trace!("No new checkpoint, waiting...");
                    tokio::time::sleep(tokio::time::Duration::from_millis(
                        self.config.poll_interval_ms,
                    ))
                    .await;
                }
                Err(e) => {
                    tracing::error!("Error fetching checkpoint {}: {}", current_checkpoint, e);
                    tokio::time::sleep(tokio::time::Duration::from_millis(
                        self.config.poll_interval_ms,
                    ))
                    .await;
                }
            }
        }
    }

    /// Fetch checkpoint data from Sui RPC
    async fn fetch_checkpoint(
        &self,
        sequence_number: u64,
    ) -> Result<Option<CheckpointData>, Box<dyn std::error::Error>> {
        let request = RpcRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "sui_getCheckpoint".to_string(),
            params: vec![Value::String(sequence_number.to_string())],
        };

        let response = self
            .client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            return Ok(None);
        }

        let checkpoint_response: CheckpointResponse = response.json().await?;
        Ok(checkpoint_response.result)
    }

    /// Process a single transaction
    async fn process_transaction(
        &self,
        tx_digest: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Fetch transaction details
        let tx_data = self.fetch_transaction(tx_digest).await?;

        // Extract events from transaction
        let events = self.extract_events(&tx_data)?;

        // Route events to appropriate handlers via EventRouter
        for event in events {
            if let Err(e) = self.router.route_event(&event).await {
                tracing::error!("Error routing event: {}", e);
            }
        }

        Ok(())
    }

    /// Fetch transaction details from Sui RPC
    async fn fetch_transaction(
        &self,
        tx_digest: &str,
    ) -> Result<Value, Box<dyn std::error::Error>> {
        let request = RpcRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "sui_getTransactionBlock".to_string(),
            params: vec![
                Value::String(tx_digest.to_string()),
                Value::Object({
                    let mut map = serde_json::Map::new();
                    map.insert("showEvents".to_string(), Value::Bool(true));
                    map.insert("showEffects".to_string(), Value::Bool(true));
                    map
                }),
            ],
        };

        let response = self
            .client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await?;

        let tx_response: Value = response.json().await?;
        Ok(tx_response)
    }

    /// Extract events from transaction data
    fn extract_events(&self, tx_data: &Value) -> Result<Vec<Value>, Box<dyn std::error::Error>> {
        let events = tx_data
            .get("result")
            .and_then(|r| r.get("events"))
            .and_then(|e| e.as_array())
            .map(|arr| arr.clone())
            .unwrap_or_default();

        Ok(events)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires running Sui node
    async fn test_fetch_checkpoint() {
        let config = Config::from_env().unwrap();
        let pool = crate::db::create_pool(&config.database_url).await.unwrap();
        let cache = crate::cache::AddressCache::new();
        let enricher = Arc::new(crate::enricher::Enricher::new(cache, pool.clone()));
        let alert_engine = Arc::new(crate::alerts::AlertEngine::new(config.clone(), pool.clone()));
        let router = Arc::new(crate::router::EventRouter::new(pool.clone(), enricher, alert_engine));
        let consumer = CheckpointConsumer::new(config, pool, router);

        let checkpoint = consumer.fetch_checkpoint(0).await.unwrap();
        assert!(checkpoint.is_some());
    }
}
