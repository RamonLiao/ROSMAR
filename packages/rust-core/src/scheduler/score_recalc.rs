use crate::engine::score_engine::ScoreEngine;
use sqlx::PgPool;
use uuid::Uuid;

/// Run score recalculation for all workspaces
pub async fn run(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    let engine = ScoreEngine::new(pool.clone());

    // Get all workspaces
    let workspaces: Vec<(Uuid,)> = sqlx::query_as("SELECT id FROM workspaces")
        .fetch_all(pool)
        .await?;

    let mut total_updated = 0;
    let mut total_tier_changes = 0;

    for (workspace_id,) in workspaces {
        match engine.recalculate_scores(workspace_id).await {
            Ok((updated, tier_changes)) => {
                tracing::debug!(
                    "Workspace {}: updated {} profiles, {} tier changes",
                    workspace_id,
                    updated,
                    tier_changes
                );
                total_updated += updated;
                total_tier_changes += tier_changes;
            }
            Err(e) => {
                tracing::error!("Error recalculating scores for workspace {}: {}", workspace_id, e);
            }
        }
    }

    tracing::info!(
        "Score recalculation complete: {} profiles updated, {} tier changes",
        total_updated,
        total_tier_changes
    );

    Ok(())
}
