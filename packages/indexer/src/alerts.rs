use crate::config::Config;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pool: PgPool,
}

impl AlertEngine {
    pub fn new(config: Config, pool: PgPool) -> Self {
        Self { config, pool }
    }

    pub fn is_whale_alert(&self, _event_type: &str, amount: i64, token: Option<&str>) -> bool {
        if let Some(t) = token {
            if t.contains("SUI") && amount >= self.config.whale_alert_threshold_sui as i64 {
                return true;
            }
        }
        false
    }

    pub async fn check_and_alert(
        &self,
        address: &str,
        event_type: &str,
        amount: i64,
        token: Option<&str>,
        tx_digest: &str,
    ) -> Result<Option<WhaleAlert>, Box<dyn std::error::Error>> {
        if !self.is_whale_alert(event_type, amount, token) {
            return Ok(None);
        }

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
            address, event_type, amount, tx_digest
        );

        Ok(Some(alert))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> Config {
        Config {
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
        }
    }

    #[tokio::test]
    async fn test_is_whale_alert() {
        let config = test_config();
        let pool = sqlx::PgPool::connect_lazy(&config.database_url).unwrap();
        let engine = AlertEngine::new(config, pool);

        assert!(engine.is_whale_alert("swap", 20_000_000_000, Some("0x2::sui::SUI")));
        assert!(!engine.is_whale_alert("swap", 1_000_000_000, Some("0x2::sui::SUI")));
        assert!(!engine.is_whale_alert("swap", 20_000_000_000, Some("0x2::usdc::USDC")));
    }
}
