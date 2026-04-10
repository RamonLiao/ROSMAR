use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone, Debug)]
struct CacheEntry {
    profile_id: Uuid,
    workspace_id: Uuid,
    cached_at: Instant,
}

/// In-memory cache for address → (profile_id, workspace_id) with TTL
#[derive(Clone)]
pub struct AddressCache {
    cache: Arc<RwLock<HashMap<String, CacheEntry>>>,
    ttl: Duration,
}

impl AddressCache {
    pub fn new(ttl_secs: u64) -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            ttl: Duration::from_secs(ttl_secs),
        }
    }

    pub async fn get(&self, address: &str) -> Option<(Uuid, Uuid)> {
        let mut cache = self.cache.write().await;
        if let Some(entry) = cache.get(address) {
            if entry.cached_at.elapsed() < self.ttl {
                return Some((entry.profile_id, entry.workspace_id));
            }
            cache.remove(address);
        }
        None
    }

    pub async fn insert(&self, address: String, profile_id: Uuid, workspace_id: Uuid) {
        let mut cache = self.cache.write().await;
        cache.insert(
            address,
            CacheEntry {
                profile_id,
                workspace_id,
                cached_at: Instant::now(),
            },
        );
    }

    pub async fn insert_batch(&self, mappings: Vec<(String, Uuid, Uuid)>) {
        let mut cache = self.cache.write().await;
        let now = Instant::now();
        for (address, profile_id, workspace_id) in mappings {
            cache.insert(
                address,
                CacheEntry {
                    profile_id,
                    workspace_id,
                    cached_at: now,
                },
            );
        }
    }

    pub async fn len(&self) -> usize {
        let cache = self.cache.read().await;
        cache.len()
    }
}

impl Default for AddressCache {
    fn default() -> Self {
        Self::new(300)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_cache_insert_and_get() {
        let cache = AddressCache::new(300);
        let pid = Uuid::new_v4();
        let wid = Uuid::new_v4();

        assert!(cache.get("0x1234").await.is_none());

        cache.insert("0x1234".to_string(), pid, wid).await;
        let result = cache.get("0x1234").await;
        assert_eq!(result, Some((pid, wid)));
    }

    #[tokio::test]
    async fn test_cache_ttl_expiry() {
        let cache = AddressCache::new(0);
        let pid = Uuid::new_v4();
        let wid = Uuid::new_v4();

        cache.insert("0x1234".to_string(), pid, wid).await;
        tokio::time::sleep(Duration::from_millis(10)).await;
        assert!(cache.get("0x1234").await.is_none());
    }

    #[tokio::test]
    async fn test_cache_batch_insert() {
        let cache = AddressCache::new(300);
        let batch = vec![
            ("0xabc".to_string(), Uuid::new_v4(), Uuid::new_v4()),
            ("0xdef".to_string(), Uuid::new_v4(), Uuid::new_v4()),
        ];
        cache.insert_batch(batch).await;
        assert_eq!(cache.len().await, 2);
        assert!(cache.get("0xabc").await.is_some());
    }
}
