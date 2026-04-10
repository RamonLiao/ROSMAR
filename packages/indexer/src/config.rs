use serde::Deserialize;
use std::env;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub database_url: String,
    pub sui_network: String,

    // Checkpoint store (replaces SUI_RPC_URL for indexer)
    pub checkpoint_store_url: String,

    // Package IDs (deployed contract addresses)
    pub crm_core_package_id: String,
    pub crm_data_package_id: String,
    pub crm_vault_package_id: String,
    pub crm_action_package_id: String,

    // Whale alert threshold (SUI only, in MIST)
    pub whale_alert_threshold_sui: u64,

    // BFF webhook
    pub bff_webhook_url: String,
    pub webhook_hmac_secret: String,

    // Enricher
    pub enricher_cache_ttl_secs: u64,

    // Batch writer
    pub batch_size: usize,
    pub batch_timeout_ms: u64,

    // Retry
    pub max_retries: u32,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        dotenvy::dotenv().ok();

        let hmac_secret = env::var("WEBHOOK_HMAC_SECRET")
            .map_err(|_| "WEBHOOK_HMAC_SECRET must be set".to_string())?;
        if hmac_secret.len() < 32 {
            return Err("WEBHOOK_HMAC_SECRET must be at least 32 characters".to_string());
        }

        Ok(Config {
            database_url: env::var("DATABASE_URL")
                .map_err(|_| "DATABASE_URL must be set".to_string())?,
            sui_network: env::var("SUI_NETWORK")
                .unwrap_or_else(|_| "testnet".to_string()),

            checkpoint_store_url: env::var("CHECKPOINT_STORE_URL")
                .unwrap_or_else(|_| "https://checkpoints.testnet.sui.io".to_string()),

            crm_core_package_id: env::var("CRM_CORE_PACKAGE_ID")
                .unwrap_or_else(|_| "0x0".to_string()),
            crm_data_package_id: env::var("CRM_DATA_PACKAGE_ID")
                .unwrap_or_else(|_| "0x0".to_string()),
            crm_vault_package_id: env::var("CRM_VAULT_PACKAGE_ID")
                .unwrap_or_else(|_| "0x0".to_string()),
            crm_action_package_id: env::var("CRM_ACTION_PACKAGE_ID")
                .unwrap_or_else(|_| "0x0".to_string()),

            whale_alert_threshold_sui: env::var("WHALE_ALERT_THRESHOLD_SUI")
                .unwrap_or_else(|_| "10000000000".to_string())
                .parse()
                .map_err(|_| "Invalid WHALE_ALERT_THRESHOLD_SUI".to_string())?,

            bff_webhook_url: env::var("BFF_WEBHOOK_URL")
                .unwrap_or_else(|_| "http://localhost:4000/webhooks/indexer-event".to_string()),
            webhook_hmac_secret: hmac_secret,

            enricher_cache_ttl_secs: env::var("ENRICHER_CACHE_TTL_SECS")
                .unwrap_or_else(|_| "300".to_string())
                .parse()
                .unwrap_or(300),

            batch_size: env::var("BATCH_SIZE")
                .unwrap_or_else(|_| "50".to_string())
                .parse()
                .unwrap_or(50),
            batch_timeout_ms: env::var("BATCH_TIMEOUT_MS")
                .unwrap_or_else(|_| "2000".to_string())
                .parse()
                .unwrap_or(2000),
            max_retries: env::var("MAX_RETRIES")
                .unwrap_or_else(|_| "3".to_string())
                .parse()
                .unwrap_or(3),
        })
    }
}
