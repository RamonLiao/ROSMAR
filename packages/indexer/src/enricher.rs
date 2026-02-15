use crate::cache::AddressCache;
use sqlx::PgPool;
use uuid::Uuid;

/// Enricher resolves address → profile_id with cache + DB fallback
pub struct Enricher {
    cache: AddressCache,
    pool: PgPool,
}

impl Enricher {
    pub fn new(cache: AddressCache, pool: PgPool) -> Self {
        Self { cache, pool }
    }

    /// Resolve address to profile_id
    /// Returns None if address is not linked to any profile
    pub async fn resolve_address(&self, address: &str) -> Result<Option<Uuid>, sqlx::Error> {
        // Try cache first
        if let Some(profile_id) = self.cache.get(address).await {
            return Ok(Some(profile_id));
        }

        // Cache miss → query DB
        let result = self.query_db(address).await?;

        // Update cache if found
        if let Some(profile_id) = result {
            self.cache.insert(address.to_string(), profile_id).await;
        }

        Ok(result)
    }

    /// Query database for address → profile_id mapping
    async fn query_db(&self, address: &str) -> Result<Option<Uuid>, sqlx::Error> {
        // First check primary_address in profiles
        let primary_result: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM profiles WHERE primary_address = $1 AND NOT is_archived"
        )
        .bind(address)
        .fetch_optional(&self.pool)
        .await?;

        if let Some((profile_id,)) = primary_result {
            return Ok(Some(profile_id));
        }

        // Then check wallet_bindings
        let binding_result: Option<(Uuid,)> = sqlx::query_as(
            "SELECT profile_id FROM wallet_bindings WHERE address = $1"
        )
        .bind(address)
        .fetch_optional(&self.pool)
        .await?;

        Ok(binding_result.map(|(profile_id,)| profile_id))
    }

    /// Batch resolve addresses to profile_ids
    pub async fn resolve_batch(
        &self,
        addresses: &[String],
    ) -> Result<Vec<(String, Option<Uuid>)>, sqlx::Error> {
        let mut results = Vec::new();

        for address in addresses {
            let profile_id = self.resolve_address(address).await?;
            results.push((address.clone(), profile_id));
        }

        Ok(results)
    }

    /// Preload cache with recent active profiles
    pub async fn preload_cache(&self) -> Result<usize, sqlx::Error> {
        // Load profiles active in last 7 days
        let rows: Vec<(String, Uuid)> = sqlx::query_as(
            "SELECT primary_address, id
             FROM profiles
             WHERE last_active_at > now() - interval '7 days'
             AND NOT is_archived"
        )
        .fetch_all(&self.pool)
        .await?;

        let count = rows.len();
        self.cache.insert_batch(rows).await;

        // Also load wallet bindings for active profiles
        let bindings: Vec<(String, Uuid)> = sqlx::query_as(
            "SELECT wb.address, wb.profile_id
             FROM wallet_bindings wb
             JOIN profiles p ON wb.profile_id = p.id
             WHERE p.last_active_at > now() - interval '7 days'
             AND NOT p.is_archived"
        )
        .fetch_all(&self.pool)
        .await?;

        self.cache.insert_batch(bindings).await;

        Ok(count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires database
    async fn test_enricher() {
        let database_url = std::env::var("DATABASE_URL").unwrap();
        let pool = crate::db::create_pool(&database_url).await.unwrap();
        let cache = AddressCache::new();
        let enricher = Enricher::new(cache, pool);

        // Test unknown address
        let result = enricher.resolve_address("0xunknown").await.unwrap();
        assert!(result.is_none());

        // Preload cache
        let count = enricher.preload_cache().await.unwrap();
        println!("Preloaded {} profiles", count);
    }
}
