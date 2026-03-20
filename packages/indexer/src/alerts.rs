use crate::config::Config;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Debug, Serialize, Deserialize)]
pub struct WhaleAlert {
    pub profile_id: Option<uuid::Uuid>,
    pub address: String,
    pub event_type: String,
    pub amount: i64,
    pub token: Option<String>,
    pub tx_digest: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

pub struct AlertEngine {
    config: Config,
    client: Client,
    pool: PgPool,
}

impl AlertEngine {
    pub fn new(config: Config, pool: PgPool) -> Self {
        Self {
            config,
            client: Client::new(),
            pool,
        }
    }

    /// Check if event exceeds whale alert threshold
    pub fn is_whale_alert(&self, event_type: &str, amount: i64, token: Option<&str>) -> bool {
        // SUI token threshold
        if let Some(t) = token {
            if t.contains("SUI") && amount >= self.config.whale_alert_threshold_sui as i64 {
                return true;
            }
        }

        // For other tokens, would need price oracle integration
        // For now, just check large SUI amounts

        false
    }

    /// Create and send whale alert
    pub async fn send_alert(
        &self,
        address: &str,
        event_type: &str,
        amount: i64,
        token: Option<&str>,
        tx_digest: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Resolve address to profile_id
        let profile_id: Option<(uuid::Uuid,)> = sqlx::query_as(
            "SELECT id FROM profiles WHERE primary_address = $1
             UNION
             SELECT profile_id FROM wallet_bindings WHERE address = $1
             LIMIT 1"
        )
        .bind(address)
        .fetch_optional(&self.pool)
        .await?;

        let alert = WhaleAlert {
            profile_id: profile_id.map(|(id,)| id),
            address: address.to_string(),
            event_type: event_type.to_string(),
            amount,
            token: token.map(|s| s.to_string()),
            tx_digest: tx_digest.to_string(),
            timestamp: chrono::Utc::now(),
        };

        tracing::info!(
            "Whale alert: {} performed {} with amount {} (tx: {})",
            address,
            event_type,
            amount,
            tx_digest
        );

        // Send webhook to BFF
        let webhook_url = format!("{}/whale-alert", self.config.bff_webhook_url);

        match self
            .client
            .post(&webhook_url)
            .json(&alert)
            .send()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    tracing::info!("Whale alert sent successfully");
                } else {
                    tracing::error!(
                        "Failed to send whale alert: status {}",
                        response.status()
                    );
                }
            }
            Err(e) => {
                tracing::error!("Error sending whale alert webhook: {}", e);
            }
        }

        Ok(())
    }

    /// Check event and send alert if threshold exceeded
    pub async fn check_and_alert(
        &self,
        address: &str,
        event_type: &str,
        amount: i64,
        token: Option<&str>,
        tx_digest: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if self.is_whale_alert(event_type, amount, token) {
            self.send_alert(address, event_type, amount, token, tx_digest)
                .await?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_is_whale_alert() {
        // Use a dummy config for unit testing (no real DB needed)
        let config = Config {
            database_url: "postgresql://test:test@localhost/test".to_string(),
            sui_rpc_url: "https://fullnode.testnet.sui.io:443".to_string(),
            sui_network: "testnet".to_string(),
            crm_core_package_id: "0x0".to_string(),
            crm_data_package_id: "0x0".to_string(),
            crm_vault_package_id: "0x0".to_string(),
            crm_action_package_id: "0x0".to_string(),
            whale_alert_threshold_sui: 10_000_000_000,
            whale_alert_threshold_usd: 10_000,
            bff_webhook_url: "http://localhost:4000".to_string(),
            batch_size: 50,
            batch_timeout_ms: 2000,
            poll_interval_ms: 2000,
            checkpoint_batch_size: 10,
            max_retries: 3,
        };
        let pool = sqlx::PgPool::connect_lazy(&config.database_url).unwrap();
        let engine = AlertEngine::new(config, pool);

        // Above threshold
        assert!(engine.is_whale_alert("swap", 20_000_000_000, Some("0x2::sui::SUI")));

        // Below threshold
        assert!(!engine.is_whale_alert("swap", 1_000_000_000, Some("0x2::sui::SUI")));

        // Non-SUI token
        assert!(!engine.is_whale_alert("swap", 20_000_000_000, Some("0x2::usdc::USDC")));
    }
}
