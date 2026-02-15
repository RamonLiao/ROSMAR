use sqlx::PgPool;
use uuid::Uuid;

pub struct SegmentRepo {
    pool: PgPool,
}

#[derive(Debug, sqlx::FromRow)]
pub struct SegmentRow {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub rules: serde_json::Value,
    pub rule_hash: String,
    pub is_dynamic: bool,
    pub member_count: i32,
    pub last_evaluated_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl SegmentRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Get segment by ID
    pub async fn get_segment(&self, id: Uuid) -> Result<Option<SegmentRow>, sqlx::Error> {
        sqlx::query_as("SELECT * FROM segments WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
    }

    /// Get segment members
    pub async fn get_segment_members(
        &self,
        segment_id: Uuid,
        page: i32,
        page_size: i32,
    ) -> Result<(Vec<Uuid>, i64), sqlx::Error> {
        let offset = (page - 1) * page_size;

        // Count
        let total: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM segment_members WHERE segment_id = $1"
        )
        .bind(segment_id)
        .fetch_one(&self.pool)
        .await?;

        // List
        let profile_ids: Vec<(Uuid,)> = sqlx::query_as(
            "SELECT profile_id FROM segment_members
             WHERE segment_id = $1
             ORDER BY added_at DESC
             LIMIT $2 OFFSET $3"
        )
        .bind(segment_id)
        .bind(page_size)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        Ok((profile_ids.into_iter().map(|(id,)| id).collect(), total.0))
    }

    /// Update segment member count
    pub async fn update_member_count(
        &self,
        segment_id: Uuid,
        count: i32,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE segments
             SET member_count = $1, last_evaluated_at = now()
             WHERE id = $2"
        )
        .bind(count)
        .bind(segment_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Clear and re-populate segment members
    pub async fn update_segment_members(
        &self,
        segment_id: Uuid,
        profile_ids: &[Uuid],
    ) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        // Clear existing members
        sqlx::query("DELETE FROM segment_members WHERE segment_id = $1")
            .bind(segment_id)
            .execute(&mut *tx)
            .await?;

        // Insert new members
        for profile_id in profile_ids {
            sqlx::query(
                "INSERT INTO segment_members (segment_id, profile_id)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING"
            )
            .bind(segment_id)
            .bind(profile_id)
            .execute(&mut *tx)
            .await?;
        }

        // Update count
        sqlx::query(
            "UPDATE segments
             SET member_count = $1, last_evaluated_at = now()
             WHERE id = $2"
        )
        .bind(profile_ids.len() as i32)
        .bind(segment_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(())
    }
}
