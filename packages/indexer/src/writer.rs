use crate::db;
use serde_json::Value;
use sqlx::PgPool;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::interval;
use uuid::Uuid;

pub struct BatchEvent {
    pub time: chrono::DateTime<chrono::Utc>,
    pub address: String,
    pub event_type: String,
    pub contract_address: Option<String>,
    pub collection: Option<String>,
    pub token: Option<String>,
    pub amount: i64,
    pub tx_digest: String,
    pub raw_data: Value,
    pub profile_id: Option<Uuid>,
    pub workspace_id: Option<Uuid>,
}

pub struct BatchWriter {
    pool: PgPool,
    batch_size: usize,
    batch_timeout: Duration,
}

impl BatchWriter {
    pub fn new(pool: PgPool, batch_size: usize, batch_timeout_ms: u64) -> Self {
        Self {
            pool,
            batch_size,
            batch_timeout: Duration::from_millis(batch_timeout_ms),
        }
    }

    pub async fn start(
        &self,
        mut rx: mpsc::Receiver<BatchEvent>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut batch: Vec<BatchEvent> = Vec::with_capacity(self.batch_size);
        let mut timer = interval(self.batch_timeout);

        loop {
            tokio::select! {
                maybe_event = rx.recv() => {
                    match maybe_event {
                        Some(event) => {
                            batch.push(event);
                            if batch.len() >= self.batch_size {
                                self.flush_batch(&mut batch).await;
                            }
                        }
                        None => {
                            if !batch.is_empty() {
                                self.flush_batch(&mut batch).await;
                            }
                            tracing::info!("BatchWriter channel closed, shutting down");
                            return Ok(());
                        }
                    }
                }
                _ = timer.tick() => {
                    if !batch.is_empty() {
                        self.flush_batch(&mut batch).await;
                    }
                }
            }
        }
    }

    async fn flush_batch(&self, batch: &mut Vec<BatchEvent>) {
        if batch.is_empty() {
            return;
        }
        let count = batch.len();
        tracing::debug!("Flushing batch of {} events", count);

        match self.multi_row_insert(batch).await {
            Ok(()) => {
                tracing::info!("Batch flushed: {} events", count);
                batch.clear();
            }
            Err(e) => {
                tracing::error!("Batch INSERT failed: {}. Falling back to individual inserts.", e);
                self.individual_insert_fallback(batch).await;
                batch.clear();
            }
        }
    }

    async fn multi_row_insert(&self, batch: &[BatchEvent]) -> Result<(), sqlx::Error> {
        let mut qb = sqlx::QueryBuilder::new(
            "INSERT INTO wallet_events (time, address, event_type, contract_address, collection, token, amount, tx_digest, raw_data, profile_id, workspace_id) "
        );

        qb.push_values(batch.iter(), |mut b, event| {
            b.push_bind(&event.time)
                .push_bind(&event.address)
                .push_bind(&event.event_type)
                .push_bind(&event.contract_address)
                .push_bind(&event.collection)
                .push_bind(&event.token)
                .push_bind(event.amount)
                .push_bind(&event.tx_digest)
                .push_bind(&event.raw_data)
                .push_bind(&event.profile_id)
                .push_bind(&event.workspace_id);
        });

        qb.push(" ON CONFLICT (time, tx_digest, address) DO NOTHING");
        qb.build().execute(&self.pool).await?;
        Ok(())
    }

    async fn individual_insert_fallback(&self, batch: &[BatchEvent]) {
        for event in batch {
            let result = sqlx::query(
                "INSERT INTO wallet_events
                 (time, address, event_type, contract_address, collection, token, amount, tx_digest, raw_data, profile_id, workspace_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 ON CONFLICT (time, tx_digest, address) DO NOTHING"
            )
            .bind(&event.time)
            .bind(&event.address)
            .bind(&event.event_type)
            .bind(&event.contract_address)
            .bind(&event.collection)
            .bind(&event.token)
            .bind(event.amount)
            .bind(&event.tx_digest)
            .bind(&event.raw_data)
            .bind(&event.profile_id)
            .bind(&event.workspace_id)
            .execute(&self.pool)
            .await;

            if let Err(e) = result {
                tracing::error!("Individual INSERT failed for {}: {}", event.tx_digest, e);
                if let Err(dl_err) = db::insert_dead_letter(
                    &self.pool,
                    &event.event_type,
                    &event.raw_data,
                    &e.to_string(),
                    "batch_writer",
                    1,
                )
                .await
                {
                    tracing::error!("Dead-letter insert also failed: {}", dl_err);
                }
            }
        }
    }
}
