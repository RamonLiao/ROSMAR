use crate::cache::AddressCache;
use sqlx::PgPool;
use uuid::Uuid;

/// Enricher resolves address → (profile_id, workspace_id) with cache + DB fallback
pub struct Enricher {
    cache: AddressCache,
    pool: PgPool,
}

impl Enricher {
    pub fn new(cache: AddressCache, pool: PgPool) -> Self {
        Self { cache, pool }
    }

    /// Resolve address to (profile_id, workspace_id).
    /// Returns None if address is not linked to any profile.
    pub async fn resolve_full(
        &self,
        address: &str,
    ) -> Result<Option<(Uuid, Uuid)>, sqlx::Error> {
        // Try cache first
        if let Some(ids) = self.cache.get(address).await {
            return Ok(Some(ids));
        }

        // Cache miss → query DB
        let result = self.query_db_full(address).await?;

        // Update cache if found
        if let Some((profile_id, workspace_id)) = result {
            self.cache
                .insert(address.to_string(), profile_id, workspace_id)
                .await;
        }

        Ok(result)
    }

    /// Query database for address → (profile_id, workspace_id)
    async fn query_db_full(
        &self,
        address: &str,
    ) -> Result<Option<(Uuid, Uuid)>, sqlx::Error> {
        // Check primary_address in profiles
        let primary: Option<(Uuid, Uuid)> = sqlx::query_as(
            "SELECT id, workspace_id FROM profiles
             WHERE primary_address = $1 AND NOT is_archived",
        )
        .bind(address)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(ids) = primary {
            return Ok(Some(ids));
        }

        // Fallback: check wallet_bindings → join profiles for workspace_id
        let binding: Option<(Uuid, Uuid)> = sqlx::query_as(
            "SELECT wb.profile_id, p.workspace_id
             FROM wallet_bindings wb
             JOIN profiles p ON wb.profile_id = p.id
             WHERE wb.address = $1 AND NOT p.is_archived",
        )
        .bind(address)
        .fetch_optional(&self.pool)
        .await?;

        Ok(binding)
    }

    /// Preload cache with recent active profiles
    pub async fn preload_cache(&self) -> Result<usize, sqlx::Error> {
        let rows: Vec<(String, Uuid, Uuid)> = sqlx::query_as(
            "SELECT primary_address, id, workspace_id
             FROM profiles
             WHERE last_active_at > now() - interval '7 days'
             AND NOT is_archived",
        )
        .fetch_all(&self.pool)
        .await?;

        let count = rows.len();
        self.cache.insert_batch(rows).await;

        // Also load wallet bindings for active profiles
        let bindings: Vec<(String, Uuid, Uuid)> = sqlx::query_as(
            "SELECT wb.address, wb.profile_id, p.workspace_id
             FROM wallet_bindings wb
             JOIN profiles p ON wb.profile_id = p.id
             WHERE p.last_active_at > now() - interval '7 days'
             AND NOT p.is_archived",
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
        let cache = AddressCache::new(300);
        let enricher = Enricher::new(cache, pool);

        let result = enricher.resolve_full("0xunknown").await.unwrap();
        assert!(result.is_none());

        let count = enricher.preload_cache().await.unwrap();
        println!("Preloaded {} profiles", count);
    }
}
