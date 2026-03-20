use serde::Deserialize;
use std::env;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub database_url: String,
    pub sui_rpc_url: String,
    pub sui_network: String,

    // Package IDs (deployed contract addresses)
    pub crm_core_package_id: String,
    pub crm_data_package_id: String,
    pub crm_vault_package_id: String,
    pub crm_action_package_id: String,

    // Whale alert thresholds
    pub whale_alert_threshold_sui: u64,
    pub whale_alert_threshold_usd: u64,

    // BFF webhook endpoint for alerts
    pub bff_webhook_url: String,

    // Indexer settings
    pub batch_size: usize,
    pub batch_timeout_ms: u64,
    pub poll_interval_ms: u64,
    pub checkpoint_batch_size: u64,

    // Retry settings
    pub max_retries: u32,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        dotenvy::dotenv().ok();

        Ok(Config {
            database_url: env::var("DATABASE_URL")
                .map_err(|_| "DATABASE_URL must be set".to_string())?,
            sui_rpc_url: env::var("SUI_RPC_URL")
                .unwrap_or_else(|_| "https://fullnode.testnet.sui.io:443".to_string()),
            sui_network: env::var("SUI_NETWORK")
                .unwrap_or_else(|_| "testnet".to_string()),

            crm_core_package_id: env::var("CRM_CORE_PACKAGE_ID")
                .unwrap_or_else(|_| "0x0".to_string()),
            crm_data_package_id: env::var("CRM_DATA_PACKAGE_ID")
                .unwrap_or_else(|_| "0x0".to_string()),
            crm_vault_package_id: env::var("CRM_VAULT_PACKAGE_ID")
                .unwrap_or_else(|_| "0x0".to_string()),
            crm_action_package_id: env::var("CRM_ACTION_PACKAGE_ID")
                .unwrap_or_else(|_| "0x0".to_string()),

            whale_alert_threshold_sui: env::var("WHALE_ALERT_THRESHOLD_SUI")
                .unwrap_or_else(|_| "10000000000".to_string()) // 10 SUI in MIST
                .parse()
                .map_err(|_| "Invalid WHALE_ALERT_THRESHOLD_SUI".to_string())?,
            whale_alert_threshold_usd: env::var("WHALE_ALERT_THRESHOLD_USD")
                .unwrap_or_else(|_| "10000".to_string()) // $10k
                .parse()
                .map_err(|_| "Invalid WHALE_ALERT_THRESHOLD_USD".to_string())?,

            bff_webhook_url: env::var("BFF_WEBHOOK_URL")
                .unwrap_or_else(|_| "http://localhost:4000/webhooks/indexer".to_string()),

            batch_size: env::var("BATCH_SIZE")
                .unwrap_or_else(|_| "50".to_string())
                .parse()
                .unwrap_or(50),
            batch_timeout_ms: env::var("BATCH_TIMEOUT_MS")
                .unwrap_or_else(|_| "2000".to_string())
                .parse()
                .unwrap_or(2000),
            poll_interval_ms: env::var("POLL_INTERVAL_MS")
                .unwrap_or_else(|_| "2000".to_string())
                .parse()
                .unwrap_or(2000),
            checkpoint_batch_size: env::var("CHECKPOINT_BATCH_SIZE")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .unwrap_or(10),
            max_retries: env::var("MAX_RETRIES")
                .unwrap_or_else(|_| "3".to_string())
                .parse()
                .unwrap_or(3),
        })
    }
}
