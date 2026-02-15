pub struct AnalyticsService;

impl AnalyticsService {
    pub async fn get_dashboard_overview(workspace_id: &str) -> Result<String, String> {
        Ok("Dashboard data".to_string())
    }
}
