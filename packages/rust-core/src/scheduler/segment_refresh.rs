use crate::engine::segment_engine::SegmentEngine;
use crate::repo::segment_repo::SegmentRepo;
use sqlx::PgPool;
use uuid::Uuid;

/// Run segment refresh for all dynamic segments
pub async fn run(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    let engine = SegmentEngine::new(pool.clone());
    let repo = SegmentRepo::new(pool.clone());

    // Get all dynamic segments
    let segments: Vec<(Uuid, Uuid, serde_json::Value)> = sqlx::query_as(
        "SELECT id, workspace_id, rules
         FROM segments
         WHERE is_dynamic = true"
    )
    .fetch_all(pool)
    .await?;

    let mut total_refreshed = 0;

    for (segment_id, workspace_id, rules) in segments {
        match engine.evaluate_segment(workspace_id, &rules).await {
            Ok(profile_ids) => {
                if let Err(e) = repo.update_segment_members(segment_id, &profile_ids).await {
                    tracing::error!("Error updating segment {} members: {}", segment_id, e);
                } else {
                    tracing::debug!(
                        "Refreshed segment {}: {} members",
                        segment_id,
                        profile_ids.len()
                    );
                    total_refreshed += 1;
                }
            }
            Err(e) => {
                tracing::error!("Error evaluating segment {}: {}", segment_id, e);
            }
        }
    }

    tracing::info!("Segment refresh complete: {} segments refreshed", total_refreshed);

    Ok(())
}
