use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct ScoreWeights {
    pub tx_count_30d: f64,
    pub hold_days: f64,
    pub vote_count: f64,
    pub nft_count: f64,
    pub total_value_usd: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TierThresholds {
    pub whale: i64,
    pub vip: i64,
    pub core: i64,
    pub active: i64,
    pub dormant: i64,
}

impl Default for ScoreWeights {
    fn default() -> Self {
        Self {
            tx_count_30d: 1.0,
            hold_days: 0.5,
            vote_count: 2.0,
            nft_count: 0.3,
            total_value_usd: 0.1,
        }
    }
}

impl Default for TierThresholds {
    fn default() -> Self {
        Self {
            whale: 10000,
            vip: 5000,
            core: 1000,
            active: 100,
            dormant: 0,
        }
    }
}

pub struct ScoreEngine {
    pool: PgPool,
}

impl ScoreEngine {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Recalculate engagement scores for all profiles in workspace
    pub async fn recalculate_scores(
        &self,
        workspace_id: Uuid,
    ) -> Result<(usize, usize), Box<dyn std::error::Error>> {
        let weights = ScoreWeights::default();
        let thresholds = TierThresholds::default();

        // Get all active profiles
        let profiles: Vec<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM profiles WHERE workspace_id = $1 AND NOT is_archived"
        )
        .bind(workspace_id)
        .fetch_all(&self.pool)
        .await?;

        let mut profiles_updated = 0;
        let mut tier_changes = 0;

        for (profile_id,) in profiles {
            let (new_score, new_tier) = self.calculate_profile_score(profile_id, &weights, &thresholds).await?;

            // Get current tier
            let current: Option<(i16,)> = sqlx::query_as(
                "SELECT tier FROM profiles WHERE id = $1"
            )
            .bind(profile_id)
            .fetch_optional(&self.pool)
            .await?;

            let tier_changed = current.map(|(t,)| t != new_tier).unwrap_or(true);
            if tier_changed {
                tier_changes += 1;
            }

            // Update profile
            sqlx::query(
                "UPDATE profiles
                 SET engagement_score = $1, tier = $2, updated_at = now()
                 WHERE id = $3"
            )
            .bind(new_score)
            .bind(new_tier)
            .bind(profile_id)
            .execute(&self.pool)
            .await?;

            profiles_updated += 1;
        }

        Ok((profiles_updated, tier_changes))
    }

    /// Calculate engagement score for a single profile
    async fn calculate_profile_score(
        &self,
        profile_id: Uuid,
        weights: &ScoreWeights,
        thresholds: &TierThresholds,
    ) -> Result<(i64, i16), Box<dyn std::error::Error>> {
        // Get activity metrics from last 30 days
        let metrics: Option<(i64, i64, i64)> = sqlx::query_as(
            "SELECT
                COUNT(*) as tx_count,
                COUNT(DISTINCT DATE(time)) as active_days,
                COALESCE(SUM(amount), 0) as total_amount
             FROM wallet_events
             WHERE profile_id = $1
               AND time > now() - interval '30 days'"
        )
        .bind(profile_id)
        .fetch_optional(&self.pool)
        .await?;

        let (tx_count, active_days, _total_amount) = metrics.unwrap_or((0, 0, 0));

        // Get NFT count
        let nft_count: Option<(i64,)> = sqlx::query_as(
            "SELECT COUNT(DISTINCT token)
             FROM wallet_events
             WHERE profile_id = $1
               AND event_type IN ('mint', 'transfer')
               AND token IS NOT NULL"
        )
        .bind(profile_id)
        .fetch_optional(&self.pool)
        .await?;

        let nft_count = nft_count.map(|(c,)| c).unwrap_or(0);

        // Calculate weighted score
        let score = (tx_count as f64 * weights.tx_count_30d)
            + (active_days as f64 * weights.hold_days)
            + (nft_count as f64 * weights.nft_count);

        let score = score as i64;

        // Determine tier
        let tier = if score >= thresholds.whale {
            4 // whale
        } else if score >= thresholds.vip {
            3 // vip
        } else if score >= thresholds.core {
            2 // core
        } else if score >= thresholds.active {
            1 // active
        } else {
            0 // dormant
        };

        Ok((score, tier))
    }
}
