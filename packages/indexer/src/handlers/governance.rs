use crate::handlers::WalletEvent;
use serde_json::Value;

/// Handle governance events (voting, proposals, DAO participation)
/// Returns WalletEvent instead of direct DB insert
pub fn handle_governance_event(
    event: &Value,
) -> Result<WalletEvent, Box<dyn std::error::Error>> {
    let event_type = event
        .get("type")
        .and_then(|t| t.as_str())
        .unwrap_or("unknown");

    tracing::debug!("Processing governance event: {}", event_type);

    let data = event.get("parsedJson").unwrap_or(event);

    let address = data
        .get("voter")
        .or_else(|| data.get("sender"))
        .or_else(|| data.get("user"))
        .and_then(|a| a.as_str())
        .unwrap_or("0x0")
        .to_string();

    let tx_digest = WalletEvent::extract_tx_digest(event);

    let protocol = data
        .get("protocol")
        .or_else(|| data.get("dao"))
        .and_then(|p| p.as_str())
        .map(|s| s.to_string());

    let dao_id = data
        .get("dao_id")
        .or_else(|| data.get("daoId"))
        .and_then(|d| d.as_str())
        .map(|s| s.to_string());

    let weight = data
        .get("weight")
        .or_else(|| data.get("votingPower"))
        .or_else(|| data.get("amount"))
        .and_then(|w| w.as_str().and_then(|s| s.parse::<i64>().ok()).or_else(|| w.as_i64()))
        .unwrap_or(1);

    // Determine event category
    let event_category = if event_type.contains("Vote") || event_type.contains("vote") {
        "vote"
    } else if event_type.contains("Proposal") || event_type.contains("proposal") {
        "proposal"
    } else if event_type.contains("Delegate") || event_type.contains("delegate") {
        "delegate"
    } else {
        "governance_event"
    };

    // Build extended data with governance-specific fields
    let proposal_id = data
        .get("proposal_id")
        .or_else(|| data.get("proposalId"))
        .and_then(|p| p.as_str())
        .unwrap_or("unknown");

    let vote_type = data
        .get("vote_type")
        .or_else(|| data.get("voteType"))
        .or_else(|| data.get("vote"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    let extended_data = serde_json::json!({
        "voter": address,
        "proposal_id": proposal_id,
        "vote_type": vote_type,
        "weight": weight,
        "protocol": protocol,
        "dao_id": dao_id,
        "original_event": event,
    });

    Ok(WalletEvent {
        address,
        event_type: event_category.to_string(),
        contract_address: protocol,  // contract_address = protocol
        collection: None,
        token: dao_id,               // token = dao_id (repurposed)
        amount: weight,
        tx_digest,
        raw_data: extended_data,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_handle_governance_vote() {
        let event = json!({
            "type": "0x2::dao::VoteEvent",
            "id": { "txDigest": "test_tx_gov_123" },
            "timestampMs": "1234567890000",
            "parsedJson": {
                "voter": "0xvoter123",
                "proposal_id": "prop_001",
                "vote_type": "for",
                "weight": "1000",
                "protocol": "0xdao_protocol",
                "dao_id": "dao_001"
            }
        });

        let wallet_event = handle_governance_event(&event).unwrap();
        assert_eq!(wallet_event.address, "0xvoter123");
        assert_eq!(wallet_event.event_type, "vote");
        assert_eq!(wallet_event.contract_address, Some("0xdao_protocol".to_string()));
        assert_eq!(wallet_event.token, Some("dao_001".to_string()));
        assert_eq!(wallet_event.amount, 1000);
    }
}
