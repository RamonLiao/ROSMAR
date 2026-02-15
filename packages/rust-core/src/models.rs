use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub primary_address: String,
    pub display_name: String,
    pub tier: i32,
    pub engagement_score: i64,
}
