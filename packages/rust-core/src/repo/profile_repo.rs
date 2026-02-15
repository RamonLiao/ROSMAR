use sqlx::PgPool;
use uuid::Uuid;

pub struct ProfileRepo {
    pool: PgPool,
}

#[derive(Debug, sqlx::FromRow)]
pub struct ProfileRow {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub sui_object_id: Option<String>,
    pub primary_address: String,
    pub suins_name: Option<String>,
    pub tier: i16,
    pub engagement_score: i64,
    pub tags: Vec<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub last_active_at: Option<chrono::DateTime<chrono::Utc>>,
    pub source: Option<String>,
    pub version: i64,
    pub is_archived: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct ActivityEventRow {
    pub time: chrono::DateTime<chrono::Utc>,
    pub event_type: String,
    pub contract_address: Option<String>,
    pub collection: Option<String>,
    pub token: Option<String>,
    pub amount: i64,
    pub tx_digest: String,
}

impl ProfileRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// List profiles with pagination, filtering, and sorting
    pub async fn list_profiles(
        &self,
        workspace_id: Uuid,
        page: i32,
        page_size: i32,
        sort_by: &str,
        sort_order: &str,
        filter_tiers: &[i32],
        filter_tags: &[String],
        min_score: Option<i64>,
        max_score: Option<i64>,
        search_query: Option<&str>,
    ) -> Result<(Vec<ProfileRow>, i64), sqlx::Error> {
        let offset = (page - 1) * page_size;

        // Build WHERE clause
        let mut where_conditions = vec!["workspace_id = $1", "NOT is_archived"];

        let tier_filter = if !filter_tiers.is_empty() {
            "tier = ANY($2)"
        } else {
            "TRUE"
        };
        where_conditions.push(tier_filter);

        let tag_filter = if !filter_tags.is_empty() {
            "tags && $3"
        } else {
            "TRUE"
        };
        where_conditions.push(tag_filter);

        let score_min_filter = if min_score.is_some() {
            "engagement_score >= $4"
        } else {
            "TRUE"
        };
        where_conditions.push(score_min_filter);

        let score_max_filter = if max_score.is_some() {
            "engagement_score <= $5"
        } else {
            "TRUE"
        };
        where_conditions.push(score_max_filter);

        let search_filter = if search_query.is_some() {
            "search_vector @@ plainto_tsquery('simple', $6)"
        } else {
            "TRUE"
        };
        where_conditions.push(search_filter);

        let where_clause = where_conditions.join(" AND ");

        // Build ORDER BY clause
        let order_by = match sort_by {
            "engagement_score" => "engagement_score",
            "tier" => "tier",
            "created_at" => "created_at",
            "last_active_at" => "last_active_at",
            _ => "created_at",
        };

        let order_direction = if sort_order.eq_ignore_ascii_case("asc") {
            "ASC"
        } else {
            "DESC"
        };

        // Count query
        let count_query = format!("SELECT COUNT(*) FROM profiles WHERE {}", where_clause);

        // List query
        let list_query = format!(
            "SELECT * FROM profiles WHERE {} ORDER BY {} {} LIMIT $7 OFFSET $8",
            where_clause, order_by, order_direction
        );

        // Execute count
        let total: (i64,) = sqlx::query_as(&count_query)
            .bind(workspace_id)
            .bind(filter_tiers)
            .bind(filter_tags)
            .bind(min_score)
            .bind(max_score)
            .bind(search_query)
            .fetch_one(&self.pool)
            .await?;

        // Execute list
        let profiles: Vec<ProfileRow> = sqlx::query_as(&list_query)
            .bind(workspace_id)
            .bind(filter_tiers)
            .bind(filter_tags)
            .bind(min_score)
            .bind(max_score)
            .bind(search_query)
            .bind(page_size)
            .bind(offset)
            .fetch_all(&self.pool)
            .await?;

        Ok((profiles, total.0))
    }

    /// Get single profile by ID
    pub async fn get_profile(&self, id: Uuid) -> Result<Option<ProfileRow>, sqlx::Error> {
        sqlx::query_as(
            "SELECT * FROM profiles WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
    }

    /// Get activity feed for profile
    pub async fn get_activity_feed(
        &self,
        profile_id: Uuid,
        limit: i32,
        before: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<Vec<ActivityEventRow>, sqlx::Error> {
        let query = if let Some(before_time) = before {
            sqlx::query_as(
                "SELECT time, event_type, contract_address, collection, token, amount, tx_digest
                 FROM wallet_events
                 WHERE profile_id = $1 AND time < $2
                 ORDER BY time DESC
                 LIMIT $3"
            )
            .bind(profile_id)
            .bind(before_time)
            .bind(limit)
        } else {
            sqlx::query_as(
                "SELECT time, event_type, contract_address, collection, token, amount, tx_digest
                 FROM wallet_events
                 WHERE profile_id = $1
                 ORDER BY time DESC
                 LIMIT $2"
            )
            .bind(profile_id)
            .bind(limit)
        };

        query.fetch_all(&self.pool).await
    }

    /// Full-text search across profiles
    pub async fn search(
        &self,
        workspace_id: Uuid,
        query: &str,
        limit: i32,
    ) -> Result<Vec<ProfileRow>, sqlx::Error> {
        sqlx::query_as(
            "SELECT *
             FROM profiles
             WHERE workspace_id = $1
               AND NOT is_archived
               AND search_vector @@ plainto_tsquery('simple', $2)
             ORDER BY ts_rank(search_vector, plainto_tsquery('simple', $2)) DESC
             LIMIT $3"
        )
        .bind(workspace_id)
        .bind(query)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }
}
