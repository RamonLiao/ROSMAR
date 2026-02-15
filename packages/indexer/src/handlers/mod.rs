pub mod audit;
pub mod defi;
pub mod nft;

/// Common event data structure
#[derive(Debug)]
pub struct WalletEvent {
    pub address: String,
    pub event_type: String,
    pub contract_address: Option<String>,
    pub collection: Option<String>,
    pub token: Option<String>,
    pub amount: i64,
    pub tx_digest: String,
    pub raw_data: serde_json::Value,
}
