use crate::handlers::WalletEvent;
use serde_json::Value;

/// Handle DeFi events (swap, stake, add liquidity, etc.)
/// Returns WalletEvent instead of direct DB insert
pub fn handle_defi_event(
    event: &Value,
) -> Result<WalletEvent, Box<dyn std::error::Error>> {
    let event_type = event
        .get("type")
        .and_then(|t| t.as_str())
        .unwrap_or("unknown");

    tracing::debug!("Processing DeFi event: {}", event_type);

    let data = event.get("parsedJson").unwrap_or(event);

    let address = WalletEvent::extract_address(event);
    let tx_digest = WalletEvent::extract_tx_digest(event);

    let contract_address = data
        .get("pool")
        .or_else(|| data.get("protocol"))
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());

    let token = data
        .get("coinType")
        .or_else(|| data.get("token"))
        .and_then(|t| t.as_str())
        .map(|s| s.to_string());

    let amount = data
        .get("amount")
        .or_else(|| data.get("value"))
        .and_then(|a| a.as_str().and_then(|s| s.parse::<i64>().ok()).or_else(|| a.as_i64()))
        .unwrap_or(0);

    // Determine event category
    let event_category = if event_type.contains("Swap") {
        "swap"
    } else if event_type.contains("Stake") {
        "stake"
    } else if event_type.contains("Unstake") {
        "unstake"
    } else if event_type.contains("Liquidity") {
        "add_liquidity"
    } else {
        "defi_event"
    };

    Ok(WalletEvent {
        address,
        event_type: event_category.to_string(),
        contract_address,
        collection: None,
        token,
        amount,
        tx_digest,
        raw_data: event.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_handle_defi_swap() {
        let event = json!({
            "type": "0x2::dex::SwapEvent",
            "id": { "txDigest": "test_tx_456" },
            "timestampMs": "1234567890000",
            "parsedJson": {
                "sender": "0x456",
                "pool": "0xpool123",
                "coinType": "0x2::sui::SUI",
                "amount": "1000000000"
            }
        });

        let wallet_event = handle_defi_event(&event).unwrap();
        assert_eq!(wallet_event.address, "0x456");
        assert_eq!(wallet_event.event_type, "swap");
        assert_eq!(wallet_event.contract_address, Some("0xpool123".to_string()));
        assert_eq!(wallet_event.token, Some("0x2::sui::SUI".to_string()));
        assert_eq!(wallet_event.amount, 1000000000);
    }

    #[test]
    fn test_handle_defi_stake() {
        let event = json!({
            "type": "0x2::staking::StakeEvent",
            "id": { "txDigest": "test_tx_789" },
            "parsedJson": {
                "user": "0x789",
                "amount": "500"
            }
        });

        let wallet_event = handle_defi_event(&event).unwrap();
        assert_eq!(wallet_event.address, "0x789");
        assert_eq!(wallet_event.event_type, "stake");
        assert_eq!(wallet_event.amount, 500);
    }
}
