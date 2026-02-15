use sqlx::postgres::PgPool;

pub struct Indexer {
    pool: Option<PgPool>,
}

impl Indexer {
    pub fn new() -> Self {
        Indexer { pool: None }
    }

    pub async fn init(&mut self, database_url: &str) -> Result<(), String> {
        let pool = PgPool::connect(database_url)
            .await
            .map_err(|e| e.to_string())?;
        self.pool = Some(pool);
        Ok(())
    }

    pub async fn start_indexing(&self) -> Result<(), String> {
        Ok(())
    }
}
