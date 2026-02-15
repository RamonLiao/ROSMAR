use sqlx::PgPool;
use uuid::Uuid;

pub struct SearchEngine {
    pool: PgPool,
}

#[derive(Debug)]
pub struct SearchResult {
    pub id: Uuid,
    pub result_type: String,
    pub title: String,
    pub subtitle: String,
}

impl SearchEngine {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Multi-table full-text search across profiles and organizations
    pub async fn search(
        &self,
        workspace_id: Uuid,
        query: &str,
        limit: i32,
    ) -> Result<Vec<SearchResult>, Box<dyn std::error::Error>> {
        let mut results = Vec::new();

        // Search profiles
        let profile_results: Vec<(Uuid, Option<String>, String, i16, i64)> = sqlx::query_as(
            "SELECT id, display_name, primary_address, tier, engagement_score
             FROM profiles
             WHERE workspace_id = $1
               AND NOT is_archived
               AND search_vector @@ plainto_tsquery('simple', $2)
             ORDER BY ts_rank(search_vector, plainto_tsquery('simple', $2)) DESC
             LIMIT $3"
        )
        .bind(workspace_id)
        .bind(query)
        .bind(limit / 2) // Split limit between profiles and orgs
        .fetch_all(&self.pool)
        .await?;

        for (id, display_name, address, tier, score) in profile_results {
            results.push(SearchResult {
                id,
                result_type: "profile".to_string(),
                title: display_name.unwrap_or(address),
                subtitle: format!("Tier: {} | Score: {}", tier, score),
            });
        }

        // Search organizations
        let org_results: Vec<(Uuid, String, i16)> = sqlx::query_as(
            "SELECT id, name, org_type
             FROM organizations
             WHERE workspace_id = $1
               AND NOT is_archived
               AND to_tsvector('simple', name) @@ plainto_tsquery('simple', $2)
             ORDER BY ts_rank(to_tsvector('simple', name), plainto_tsquery('simple', $2)) DESC
             LIMIT $3"
        )
        .bind(workspace_id)
        .bind(query)
        .bind(limit / 2)
        .fetch_all(&self.pool)
        .await?;

        for (id, name, org_type) in org_results {
            let type_label = match org_type {
                0 => "Company",
                1 => "DAO",
                2 => "Protocol",
                3 => "NFT Project",
                _ => "Organization",
            };

            results.push(SearchResult {
                id,
                result_type: "organization".to_string(),
                title: name,
                subtitle: type_label.to_string(),
            });
        }

        Ok(results)
    }
}
