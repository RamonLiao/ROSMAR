use crate::alerts::AlertEngine;
use crate::config::Config;
use crate::enricher::Enricher;
use crate::handlers::{audit, defi, governance, nft, WalletEvent};
use crate::retry::RetryManager;
use crate::webhook::WebhookDispatcher;
use crate::writer::BatchEvent;
use serde_json::Value;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;

pub struct EventRouter {
    pool: PgPool,
    config: Config,
    enricher: Arc<Enricher>,
    webhook: Option<Arc<WebhookDispatcher>>,
    alert_engine: Arc<AlertEngine>,
    batch_tx: mpsc::Sender<BatchEvent>,
    retry: Arc<RetryManager>,
}

impl EventRouter {
    pub fn new(
        pool: PgPool,
        config: Config,
        enricher: Arc<Enricher>,
        alert_engine: Arc<AlertEngine>,
        batch_tx: mpsc::Sender<BatchEvent>,
    ) -> Self {
        let retry = Arc::new(RetryManager::new(config.max_retries, 1000));
        Self {
            pool,
            config,
            enricher,
            webhook: None,
            alert_engine,
            batch_tx,
            retry,
        }
    }

    pub fn with_webhook(mut self, webhook: Arc<WebhookDispatcher>) -> Self {
        self.webhook = Some(webhook);
        self
    }

    pub async fn route_event(&self, event: &Value) -> Result<(), Box<dyn std::error::Error>> {
        let event_type = event
            .get("type")
            .and_then(|t| t.as_str())
            .ok_or("Missing event type")?;

        tracing::debug!("Routing event type: {}", event_type);

        // Step 1: Handler → WalletEvent
        let wallet_event = match event_type {
            t if t.contains("AuditEventV1") => {
                audit::handle_audit_event(&self.pool, event).await?
            }
            t if t.contains("MintNFTEvent")
                || t.contains("TransferObject")
                || t.contains("BurnEvent") =>
            {
                nft::handle_nft_event(event)?
            }
            t if t.contains("SwapEvent")
                || t.contains("AddLiquidityEvent")
                || t.contains("StakeEvent")
                || t.contains("UnstakeEvent") =>
            {
                defi::handle_defi_event(event)?
            }
            t if self.is_governance_event(t) => {
                governance::handle_governance_event(event)?
            }
            _ => {
                tracing::warn!("Unknown event type: {}", event_type);
                WalletEvent {
                    address: WalletEvent::extract_address(event),
                    event_type: "unknown".to_string(),
                    contract_address: None,
                    collection: None,
                    token: None,
                    amount: 0,
                    tx_digest: WalletEvent::extract_tx_digest(event),
                    raw_data: event.clone(),
                }
            }
        };

        let address = wallet_event.address.clone();
        let tx_digest = wallet_event.tx_digest.clone();
        let amount = wallet_event.amount;
        let token = wallet_event.token.clone();
        let we_event_type = wallet_event.event_type.clone();

        // Step 2: Enrich (BEFORE batch write so we have profile_id/workspace_id)
        let (profile_id, workspace_id) = match self.enricher.resolve_full(&address).await {
            Ok(Some((pid, wid))) => {
                tracing::debug!("Enriched {} -> profile={}, workspace={}", address, pid, wid);
                (Some(pid), Some(wid))
            }
            Ok(None) => (None, None),
            Err(e) => {
                tracing::warn!("Enrichment failed for {}: {}", address, e);
                (None, None)
            }
        };

        // Step 3: Queue to BatchWriter (now with enrichment)
        let batch_event = BatchEvent {
            time: chrono::Utc::now(),
            address: wallet_event.address,
            event_type: wallet_event.event_type,
            contract_address: wallet_event.contract_address,
            collection: wallet_event.collection,
            token: wallet_event.token,
            amount: wallet_event.amount,
            tx_digest: wallet_event.tx_digest,
            raw_data: wallet_event.raw_data,
            profile_id,
            workspace_id,
        };

        if let Err(e) = self.batch_tx.send(batch_event).await {
            return Err(format!("BatchWriter channel closed: {}", e).into());
        }

        // Step 4: AlertEngine check (pure logic, receives enrichment)
        {
            let whale_alert = self.alert_engine.check(
                &we_event_type,
                &address,
                amount,
                token.as_deref(),
                &tx_digest,
                profile_id,
                workspace_id,
            );

            if let Some(alert) = whale_alert {
                if let Some(ref webhook) = self.webhook {
                    let alert_event = WebhookDispatcher::build_event(
                        event,
                        "WhaleAlert",
                        &alert.address,
                        alert.profile_id,
                        alert.workspace_id,
                    );
                    if let Err(e) = webhook
                        .dispatch_with_retry(&alert_event, &self.retry, &self.pool, "alert_webhook")
                        .await
                    {
                        tracing::error!("Whale alert webhook failed: {}", e);
                    }
                }
            }
        }

        // Step 5: General webhook with enrichment
        if let Some(ref webhook) = self.webhook {
            let indexer_event = WebhookDispatcher::build_event(
                event, event_type, &address, profile_id, workspace_id,
            );
            if let Err(e) = webhook
                .dispatch_with_retry(&indexer_event, &self.retry, &self.pool, "webhook")
                .await
            {
                tracing::error!("Webhook dispatch failed: {}", e);
            }
        }

        Ok(())
    }

    pub async fn route_batch(&self, events: &[Value]) -> Result<(), Box<dyn std::error::Error>> {
        for event in events {
            if let Err(e) = self.route_event(event).await {
                tracing::error!("Error routing event: {}", e);
            }
        }
        Ok(())
    }

    fn is_governance_event(&self, event_type: &str) -> bool {
        let pkg = &self.config.crm_core_package_id;
        event_type == format!("{}::governance::VoteEvent", pkg)
            || event_type == format!("{}::governance::ProposalEvent", pkg)
            || event_type == format!("{}::governance::DelegateEvent", pkg)
            || event_type.contains("VoteEvent")
            || event_type.contains("ProposalEvent")
            || event_type.contains("DelegateEvent")
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
        let cache = crate::cache::AddressCache::new(300);
        let enricher = Arc::new(crate::enricher::Enricher::new(cache, pool.clone()));
        let config = crate::config::Config::from_env().unwrap();
        let alert_engine = Arc::new(crate::alerts::AlertEngine::new(
            config.whale_alert_threshold_sui,
        ));
        let (batch_tx, _batch_rx) = mpsc::channel(1000);
        let router = EventRouter::new(pool, config, enricher, alert_engine, batch_tx);

        let event = json!({
            "type": "0x123::profile::AuditEventV1",
            "data": {}
        });

        router.route_event(&event).await.unwrap();
    }
}
