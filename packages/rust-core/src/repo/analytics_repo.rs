use sqlx::PgPool;
use uuid::Uuid;

pub struct AnalyticsRepo {
    pool: PgPool,
}

#[derive(Debug, sqlx::FromRow)]
pub struct TierDistribution {
    pub tier: i16,
    pub count: i64,
}

impl AnalyticsRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Get dashboard overview stats
    pub async fn get_dashboard_overview(
        &self,
        workspace_id: Uuid,
    ) -> Result<DashboardStats, sqlx::Error> {
        // Total profiles
        let total_profiles: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM profiles WHERE workspace_id = $1 AND NOT is_archived"
        )
        .bind(workspace_id)
        .fetch_one(&self.pool)
        .await?;

        // Active profiles (30 days)
        let active_profiles_30d: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM profiles
             WHERE workspace_id = $1
               AND NOT is_archived
               AND last_active_at > now() - interval '30 days'"
        )
        .bind(workspace_id)
        .fetch_one(&self.pool)
        .await?;

        // Total deals value
        let total_deals_value: (Option<i64>,) = sqlx::query_as(
            "SELECT COALESCE(SUM(value_amount), 0)
             FROM deals
             WHERE workspace_id = $1 AND NOT is_archived"
        )
        .bind(workspace_id)
        .fetch_one(&self.pool)
        .await?;

        // Open tickets
        let open_tickets: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tickets
             WHERE workspace_id = $1 AND status < 2"
        )
        .bind(workspace_id)
        .fetch_one(&self.pool)
        .await?;

        // Tier distribution
        let tier_distribution: Vec<TierDistribution> = sqlx::query_as(
            "SELECT tier, COUNT(*) as count
             FROM profiles
             WHERE workspace_id = $1 AND NOT is_archived
             GROUP BY tier
             ORDER BY tier DESC"
        )
        .bind(workspace_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(DashboardStats {
            total_profiles: total_profiles.0,
            active_profiles_30d: active_profiles_30d.0,
            total_deals_value: total_deals_value.0.unwrap_or(0),
            open_tickets: open_tickets.0 as i32,
            tier_distribution,
        })
    }
}

pub struct DashboardStats {
    pub total_profiles: i64,
    pub active_profiles_30d: i64,
    pub total_deals_value: i64,
    pub open_tickets: i32,
    pub tier_distribution: Vec<TierDistribution>,
}
