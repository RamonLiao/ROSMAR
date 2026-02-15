use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// In-memory cache for address → profile_id mapping
#[derive(Clone)]
pub struct AddressCache {
    cache: Arc<RwLock<HashMap<String, Uuid>>>,
}

impl AddressCache {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Get profile_id for an address from cache
    pub async fn get(&self, address: &str) -> Option<Uuid> {
        let cache = self.cache.read().await;
        cache.get(address).copied()
    }

    /// Insert or update address → profile_id mapping
    pub async fn insert(&self, address: String, profile_id: Uuid) {
        let mut cache = self.cache.write().await;
        cache.insert(address, profile_id);
    }

    /// Batch insert multiple mappings
    pub async fn insert_batch(&self, mappings: Vec<(String, Uuid)>) {
        let mut cache = self.cache.write().await;
        for (address, profile_id) in mappings {
            cache.insert(address, profile_id);
        }
    }

    /// Clear the cache (useful for testing or memory management)
    pub async fn clear(&self) {
        let mut cache = self.cache.write().await;
        cache.clear();
    }

    /// Get cache size
    pub async fn len(&self) -> usize {
        let cache = self.cache.read().await;
        cache.len()
    }
}

impl Default for AddressCache {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_cache_operations() {
        let cache = AddressCache::new();
        let profile_id = Uuid::new_v4();
        let address = "0x1234".to_string();

        // Initially empty
        assert_eq!(cache.len().await, 0);
        assert!(cache.get(&address).await.is_none());

        // Insert
        cache.insert(address.clone(), profile_id).await;
        assert_eq!(cache.len().await, 1);
        assert_eq!(cache.get(&address).await, Some(profile_id));

        // Batch insert
        let batch = vec![
            ("0xabc".to_string(), Uuid::new_v4()),
            ("0xdef".to_string(), Uuid::new_v4()),
        ];
        cache.insert_batch(batch).await;
        assert_eq!(cache.len().await, 3);

        // Clear
        cache.clear().await;
        assert_eq!(cache.len().await, 0);
    }
}
