use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhaleAlert {
    pub event_id: String,
    pub event_type: String,
    pub address: String,
    pub profile_id: Option<Uuid>,
    pub workspace_id: Option<Uuid>,
    pub amount: i64,
    pub token: Option<String>,
    pub tx_digest: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Pure-logic alert engine — no database access.
/// Receives enrichment from Router and produces WhaleAlert if threshold exceeded.
pub struct AlertEngine {
    threshold_sui: u64,
}

impl AlertEngine {
    pub fn new(threshold_sui: u64) -> Self {
        Self { threshold_sui }
    }

    /// Check if an event triggers a whale alert.
    /// Returns Some(WhaleAlert) if amount exceeds threshold.
    pub fn check(
        &self,
        event_type: &str,
        address: &str,
        amount: i64,
        token: Option<&str>,
        tx_digest: &str,
        profile_id: Option<Uuid>,
        workspace_id: Option<Uuid>,
    ) -> Option<WhaleAlert> {
        if amount < 0 || (amount as u64) < self.threshold_sui {
            return None;
        }

        Some(WhaleAlert {
            event_id: format!("whale_{}_{}", tx_digest, address),
            event_type: "WhaleAlert".to_string(),
            address: address.to_string(),
            profile_id,
            workspace_id,
            amount,
            token: token.map(String::from),
            tx_digest: tx_digest.to_string(),
            timestamp: chrono::Utc::now(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_whale_alert_triggered() {
        let engine = AlertEngine::new(10_000_000_000); // 10 SUI
        let pid = Uuid::new_v4();
        let wid = Uuid::new_v4();

        let alert = engine.check(
            "Transfer", "0xabc", 50_000_000_000, Some("SUI"), "tx123",
            Some(pid), Some(wid),
        );
        assert!(alert.is_some());
        let alert = alert.unwrap();
        assert_eq!(alert.address, "0xabc");
        assert_eq!(alert.profile_id, Some(pid));
        assert_eq!(alert.workspace_id, Some(wid));
    }

    #[test]
    fn test_whale_alert_below_threshold() {
        let engine = AlertEngine::new(10_000_000_000);
        let alert = engine.check(
            "Transfer", "0xabc", 1_000_000_000, Some("SUI"), "tx123",
            None, None,
        );
        assert!(alert.is_none());
    }

    #[test]
    fn test_whale_alert_negative_amount() {
        let engine = AlertEngine::new(10_000_000_000);
        let alert = engine.check(
            "Transfer", "0xabc", -100, Some("SUI"), "tx123",
            None, None,
        );
        assert!(alert.is_none());
    }
}
