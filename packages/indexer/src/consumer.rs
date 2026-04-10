use crate::router::EventRouter;
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;
use sui_data_ingestion_core::Worker;
use sui_types::full_checkpoint_content::CheckpointData;

/// CRM event processor — implements Worker trait for sui-data-ingestion-core.
/// Processes checkpoints and routes events through our pipeline.
pub struct CrmWorker {
    router: Arc<EventRouter>,
}

impl CrmWorker {
    pub fn new(router: Arc<EventRouter>) -> Self {
        Self { router }
    }
}

#[async_trait]
impl Worker for CrmWorker {
    type Result = ();

    async fn process_checkpoint(&self, checkpoint: &CheckpointData) -> Result<()> {
        let seq = checkpoint.checkpoint_summary.sequence_number;
        tracing::debug!("Processing checkpoint {}", seq);

        for tx in &checkpoint.transactions {
            let tx_digest = tx.transaction.digest().to_string();

            if let Some(events) = &tx.events {
                for event in &events.data {
                    let event_json = event_to_json(event, &tx_digest);

                    if let Err(e) = self.router.route_event(&event_json).await {
                        tracing::error!(
                            "Error routing event in checkpoint {} tx {}: {}",
                            seq,
                            tx_digest,
                            e
                        );
                    }
                }
            }
        }

        tracing::info!(
            "Checkpoint {} processed ({} transactions)",
            seq,
            checkpoint.transactions.len()
        );
        Ok(())
    }
}

/// Convert a sui_types::event::Event to JSON Value matching the old JSON-RPC format.
/// This bridge lets us migrate the consumer without rewriting all handlers.
fn event_to_json(event: &sui_types::event::Event, tx_digest: &str) -> Value {
    serde_json::json!({
        "type": event.type_.to_canonical_string(/* with_prefix */ true),
        "id": {
            "txDigest": tx_digest,
            "eventSeq": "0"
        },
        "packageId": event.package_id.to_string(),
        "transactionModule": event.transaction_module.as_str(),
        "sender": event.sender.to_string(),
        "parsedJson": serde_json::from_slice::<Value>(&event.contents)
            .unwrap_or_else(|_| Value::Object(Default::default())),
        "timestampMs": chrono::Utc::now().timestamp_millis().to_string()
    })
}
