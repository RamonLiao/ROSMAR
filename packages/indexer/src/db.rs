use serde_json::Value;
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;
use uuid::Uuid;

pub async fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(Duration::from_secs(10))
        .idle_timeout(Duration::from_secs(600))
        .connect(database_url)
        .await
}

pub async fn get_last_checkpoint(pool: &PgPool) -> Result<u64, sqlx::Error> {
    let row: (i64,) = sqlx::query_as(
        "SELECT last_checkpoint FROM indexer_checkpoints WHERE chain = 'sui'"
    )
    .fetch_one(pool)
    .await?;

    Ok(row.0 as u64)
}

pub async fn update_checkpoint(
    pool: &PgPool,
    checkpoint: u64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE indexer_checkpoints
         SET last_checkpoint = $1, last_processed_at = now()
         WHERE chain = 'sui'"
    )
    .bind(checkpoint as i64)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn insert_dead_letter(
    pool: &PgPool,
    event_type: &str,
    payload: &Value,
    error_msg: &str,
    source: &str,
    attempts: i32,
) -> Result<Uuid, sqlx::Error> {
    let row: (Uuid,) = sqlx::query_as(
        "INSERT INTO dead_letter_events (event_type, payload, error_msg, source, attempts)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id"
    )
    .bind(event_type)
    .bind(payload)
    .bind(error_msg)
    .bind(source)
    .bind(attempts)
    .fetch_one(pool)
    .await?;

    Ok(row.0)
}

pub async fn list_dead_letters(
    pool: &PgPool,
    since_hours: i64,
    source_filter: Option<&str>,
) -> Result<Vec<(Uuid, String, Value)>, sqlx::Error> {
    if let Some(source) = source_filter {
        sqlx::query_as(
            "SELECT id, event_type, payload FROM dead_letter_events
             WHERE created_at > now() - make_interval(hours => $1)
             AND replayed_at IS NULL AND source = $2
             ORDER BY created_at"
        )
        .bind(since_hours as i32)
        .bind(source)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as(
            "SELECT id, event_type, payload FROM dead_letter_events
             WHERE created_at > now() - make_interval(hours => $1)
             AND replayed_at IS NULL
             ORDER BY created_at"
        )
        .bind(since_hours as i32)
        .fetch_all(pool)
        .await
    }
}

pub async fn mark_replayed(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE dead_letter_events SET replayed_at = now() WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires database
    async fn test_checkpoint_operations() {
        let database_url = std::env::var("DATABASE_URL").unwrap();
        let pool = create_pool(&database_url).await.unwrap();

        let checkpoint = get_last_checkpoint(&pool).await.unwrap();
        assert!(checkpoint >= 0);

        update_checkpoint(&pool, checkpoint + 1).await.unwrap();
        let new_checkpoint = get_last_checkpoint(&pool).await.unwrap();
        assert_eq!(new_checkpoint, checkpoint + 1);
    }
}
