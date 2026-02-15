pub mod score_recalc;
pub mod segment_refresh;
pub mod snapshot;

use sqlx::PgPool;
use std::time::Duration;
use tokio::time::interval;

pub struct Scheduler {
    pool: PgPool,
}

impl Scheduler {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Start all scheduled tasks
    pub async fn start(&self) {
        let pool = self.pool.clone();

        // Score recalculation - every 5 minutes
        let score_pool = pool.clone();
        tokio::spawn(async move {
            let mut timer = interval(Duration::from_secs(300)); // 5 min
            loop {
                timer.tick().await;
                tracing::info!("Running scheduled score recalculation");
                if let Err(e) = score_recalc::run(&score_pool).await {
                    tracing::error!("Score recalculation error: {}", e);
                }
            }
        });

        // Segment refresh - every 10 minutes
        let segment_pool = pool.clone();
        tokio::spawn(async move {
            let mut timer = interval(Duration::from_secs(600)); // 10 min
            loop {
                timer.tick().await;
                tracing::info!("Running scheduled segment refresh");
                if let Err(e) = segment_refresh::run(&segment_pool).await {
                    tracing::error!("Segment refresh error: {}", e);
                }
            }
        });

        // Engagement snapshots - every hour
        let snapshot_pool = pool.clone();
        tokio::spawn(async move {
            let mut timer = interval(Duration::from_secs(3600)); // 1 hour
            loop {
                timer.tick().await;
                tracing::info!("Running scheduled engagement snapshots");
                if let Err(e) = snapshot::run(&snapshot_pool).await {
                    tracing::error!("Snapshot error: {}", e);
                }
            }
        });

        tracing::info!("Scheduler started: score (5min), segment (10min), snapshot (1hr)");
    }
}
