pub mod audit;
pub mod defi;
pub mod governance;
pub mod nft;

use serde_json::Value;

/// Common event data structure — returned by handlers for batch writing
#[derive(Debug)]
pub struct WalletEvent {
    pub address: String,
    pub event_type: String,
    pub contract_address: Option<String>,
    pub collection: Option<String>,
    pub token: Option<String>,
    pub amount: i64,
    pub tx_digest: String,
    pub raw_data: Value,
}

impl WalletEvent {
    pub fn extract_tx_digest(event: &Value) -> String {
        event
            .get("id")
            .and_then(|id| id.get("txDigest"))
            .and_then(|d| d.as_str())
            .unwrap_or("unknown")
            .to_string()
    }

    pub fn extract_address(event: &Value) -> String {
        let data = event.get("parsedJson").unwrap_or(event);
        data.get("sender")
            .or_else(|| data.get("user"))
            .or_else(|| data.get("actor"))
            .or_else(|| data.get("recipient"))
            .and_then(|a| a.as_str())
            .unwrap_or("0x0")
            .to_string()
    }
}
