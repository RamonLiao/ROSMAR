use crate::handlers::WalletEvent;
use serde_json::Value;

/// Handle NFT-related events (mint, transfer, burn)
/// Returns WalletEvent instead of direct DB insert
pub fn handle_nft_event(
    event: &Value,
) -> Result<WalletEvent, Box<dyn std::error::Error>> {
    let event_type = event
        .get("type")
        .and_then(|t| t.as_str())
        .unwrap_or("unknown");

    tracing::debug!("Processing NFT event: {}", event_type);

    let data = event.get("parsedJson").unwrap_or(event);

    let address = WalletEvent::extract_address(event);
    let tx_digest = WalletEvent::extract_tx_digest(event);

    let collection = data
        .get("collection")
        .or_else(|| data.get("packageId"))
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());

    let contract_address = data
        .get("objectId")
        .or_else(|| data.get("nftId"))
        .and_then(|t| t.as_str())
        .map(|s| s.to_string());

    // Determine event category
    let event_category = if event_type.contains("Mint") {
        "mint"
    } else if event_type.contains("Burn") {
        "burn"
    } else if event_type.contains("Transfer") {
        "transfer"
    } else {
        "nft_event"
    };

    Ok(WalletEvent {
        address,
        event_type: event_category.to_string(),
        contract_address,
        collection,
        token: None,
        amount: 1, // NFT count = 1
        tx_digest,
        raw_data: event.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_handle_nft_mint() {
        let event = json!({
            "type": "0x2::nft::MintNFTEvent",
            "id": { "txDigest": "test_tx_123" },
            "timestampMs": "1234567890000",
            "parsedJson": {
                "sender": "0x123",
                "collection": "0xabc",
                "objectId": "0xdef"
            }
        });

        let wallet_event = handle_nft_event(&event).unwrap();
        assert_eq!(wallet_event.address, "0x123");
        assert_eq!(wallet_event.event_type, "mint");
        assert_eq!(wallet_event.collection, Some("0xabc".to_string()));
        assert_eq!(wallet_event.contract_address, Some("0xdef".to_string()));
        assert_eq!(wallet_event.amount, 1);
    }

    #[test]
    fn test_handle_nft_transfer() {
        let event = json!({
            "type": "0x2::nft::TransferObject",
            "id": { "txDigest": "test_tx_456" },
            "parsedJson": {
                "recipient": "0x999"
            }
        });

        let wallet_event = handle_nft_event(&event).unwrap();
        assert_eq!(wallet_event.address, "0x999");
        assert_eq!(wallet_event.event_type, "transfer");
    }
}
