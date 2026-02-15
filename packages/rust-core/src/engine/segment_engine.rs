use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

pub struct SegmentEngine {
    pool: PgPool,
}

impl SegmentEngine {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Evaluate segment rules and return matching profile IDs
    pub async fn evaluate_segment(
        &self,
        workspace_id: Uuid,
        rules: &Value,
    ) -> Result<Vec<Uuid>, Box<dyn std::error::Error + Send + Sync>> {
        // Parse rules JSON and generate SQL WHERE clause
        let where_clause = self.rules_to_sql(rules)?;

        let query = format!(
            "SELECT id FROM profiles
             WHERE workspace_id = $1
               AND NOT is_archived
               AND {}",
            where_clause
        );

        let profile_ids: Vec<(Uuid,)> = sqlx::query_as(&query)
            .bind(workspace_id)
            .fetch_all(&self.pool)
            .await?;

        Ok(profile_ids.into_iter().map(|(id,)| id).collect())
    }

    /// Convert rules JSONB to SQL WHERE clause
    fn rules_to_sql(&self, rules: &Value) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let operator = rules
            .get("operator")
            .and_then(|o| o.as_str())
            .unwrap_or("AND");

        let conditions = rules
            .get("conditions")
            .and_then(|c| c.as_array())
            .ok_or("Missing conditions array")?;

        let sql_conditions: Vec<String> = conditions
            .iter()
            .filter_map(|condition| self.condition_to_sql(condition).ok())
            .collect();

        if sql_conditions.is_empty() {
            return Ok("TRUE".to_string());
        }

        let joiner = match operator {
            "OR" => " OR ",
            _ => " AND ",
        };

        Ok(format!("({})", sql_conditions.join(joiner)))
    }

    /// Convert a single condition to SQL
    fn condition_to_sql(&self, condition: &Value) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let field = condition
            .get("field")
            .and_then(|f| f.as_str())
            .ok_or("Missing field")?;

        let operator = condition
            .get("operator")
            .and_then(|o| o.as_str())
            .ok_or("Missing operator")?;

        let value = condition.get("value").ok_or("Missing value")?;

        let sql = match field {
            "tier" => match operator {
                "=" => format!("tier = {}", value.as_i64().unwrap_or(0)),
                ">" => format!("tier > {}", value.as_i64().unwrap_or(0)),
                ">=" => format!("tier >= {}", value.as_i64().unwrap_or(0)),
                "<" => format!("tier < {}", value.as_i64().unwrap_or(0)),
                "<=" => format!("tier <= {}", value.as_i64().unwrap_or(0)),
                _ => "TRUE".to_string(),
            },
            "engagement_score" => match operator {
                "=" => format!("engagement_score = {}", value.as_i64().unwrap_or(0)),
                ">" => format!("engagement_score > {}", value.as_i64().unwrap_or(0)),
                ">=" => format!("engagement_score >= {}", value.as_i64().unwrap_or(0)),
                "<" => format!("engagement_score < {}", value.as_i64().unwrap_or(0)),
                "<=" => format!("engagement_score <= {}", value.as_i64().unwrap_or(0)),
                _ => "TRUE".to_string(),
            },
            "tags" => {
                if let Some(tag) = value.as_str() {
                    format!("'{}' = ANY(tags)", tag.replace('\'', "''"))
                } else {
                    "TRUE".to_string()
                }
            }
            "last_active_at" => {
                if let Some(days) = value.as_i64() {
                    format!("last_active_at > now() - interval '{} days'", days)
                } else {
                    "TRUE".to_string()
                }
            }
            _ => "TRUE".to_string(),
        };

        Ok(sql)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_rules_to_sql() {
        let engine = SegmentEngine::new(sqlx::PgPool::connect_lazy("").unwrap());

        let rules = json!({
            "operator": "AND",
            "conditions": [
                { "field": "tier", "operator": ">=", "value": 3 },
                { "field": "tags", "operator": "contains", "value": "DeFi" }
            ]
        });

        let sql = engine.rules_to_sql(&rules).unwrap();
        assert!(sql.contains("tier >= 3"));
        assert!(sql.contains("DeFi"));
    }
}
