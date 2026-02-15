use sqlx::PgPool;
use uuid::Uuid;

/// Create engagement snapshots for all active profiles
pub async fn run(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    // Get all active profiles with their current score and tier
    let profiles: Vec<(Uuid, Uuid, i64, i16)> = sqlx::query_as(
        "SELECT id, workspace_id, engagement_score, tier
         FROM profiles
         WHERE NOT is_archived"
    )
    .fetch_all(pool)
    .await?;

    let now = chrono::Utc::now();
    let mut inserted = 0;

    for (profile_id, workspace_id, score, tier) in profiles {
        sqlx::query(
            "INSERT INTO engagement_snapshots (time, profile_id, workspace_id, score, tier)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING"
        )
        .bind(now)
        .bind(profile_id)
        .bind(workspace_id)
        .bind(score)
        .bind(tier)
        .execute(pool)
        .await?;

        inserted += 1;
    }

    tracing::info!("Engagement snapshots created: {} profiles", inserted);

    Ok(())
}
