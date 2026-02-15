use serde_json::Value;
use sqlx::PgPool;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::interval;

/// Batch writer accumulates events and writes them in batches
pub struct BatchWriter {
    pool: PgPool,
    batch_size: usize,
    batch_timeout: Duration,
}

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
}

impl BatchWriter {
    pub fn new(pool: PgPool, batch_size: usize, batch_timeout_ms: u64) -> Self {
        Self {
            pool,
            batch_size,
            batch_timeout: Duration::from_millis(batch_timeout_ms),
        }
    }

    /// Start the batch writer event loop
    pub async fn start(
        &self,
        mut rx: mpsc::Receiver<BatchEvent>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut batch: Vec<BatchEvent> = Vec::with_capacity(self.batch_size);
        let mut timer = interval(self.batch_timeout);

        loop {
            tokio::select! {
                // Receive event
                Some(event) = rx.recv() => {
                    batch.push(event);

                    // Flush if batch is full
                    if batch.len() >= self.batch_size {
                        self.flush_batch(&mut batch).await?;
                    }
                }

                // Timeout - flush partial batch
                _ = timer.tick() => {
                    if !batch.is_empty() {
                        self.flush_batch(&mut batch).await?;
                    }
                }
            }
        }
    }

    /// Flush accumulated events to database
    async fn flush_batch(&self, batch: &mut Vec<BatchEvent>) -> Result<(), Box<dyn std::error::Error>> {
        if batch.is_empty() {
            return Ok(());
        }

        tracing::debug!("Flushing batch of {} events", batch.len());

        // Begin transaction
        let mut tx = self.pool.begin().await?;

        // Insert all events in batch
        for event in batch.iter() {
            sqlx::query(
                "INSERT INTO wallet_events
                 (time, address, event_type, contract_address, collection, token, amount, tx_digest, raw_data)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
            .execute(&mut *tx)
            .await?;
        }

        // Commit transaction
        tx.commit().await?;

        tracing::info!("Successfully flushed {} events", batch.len());

        // Clear batch
        batch.clear();

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires database
    async fn test_batch_writer() {
        let database_url = std::env::var("DATABASE_URL").unwrap();
        let pool = crate::db::create_pool(&database_url).await.unwrap();
        let writer = BatchWriter::new(pool, 100, 1000);

        let (tx, rx) = mpsc::channel(1000);

        // Spawn writer
        let writer_handle = tokio::spawn(async move {
            writer.start(rx).await.unwrap();
        });

        // Send test event
        tx.send(BatchEvent {
            time: chrono::Utc::now(),
            address: "0xtest".to_string(),
            event_type: "test".to_string(),
            contract_address: None,
            collection: None,
            token: None,
            amount: 0,
            tx_digest: "test_digest".to_string(),
            raw_data: serde_json::json!({}),
        })
        .await
        .unwrap();

        // Wait a bit for batch to flush
        tokio::time::sleep(Duration::from_millis(2000)).await;

        drop(tx);
        writer_handle.abort();
    }
}
