use crate::engine::score_engine::ScoreEngine;
use crate::proto::crm::core::{
    analytics_service_server::AnalyticsService, DashboardRequest, DashboardResponse,
    ScoreRequest, ScoreResponse, TierDistribution, WhaleAlert, WhaleAlertRequest,
};
use crate::repo::analytics_repo::AnalyticsRepo;
use sqlx::PgPool;
use tonic::{Request, Response, Status};
use uuid::Uuid;

pub struct AnalyticsServiceImpl {
    repo: AnalyticsRepo,
    score_engine: ScoreEngine,
}

impl AnalyticsServiceImpl {
    pub fn new(pool: PgPool) -> Self {
        Self {
            repo: AnalyticsRepo::new(pool.clone()),
            score_engine: ScoreEngine::new(pool),
        }
    }
}

#[tonic::async_trait]
impl AnalyticsService for AnalyticsServiceImpl {
    async fn get_dashboard_overview(
        &self,
        request: Request<DashboardRequest>,
    ) -> Result<Response<DashboardResponse>, Status> {
        let req = request.into_inner();

        let workspace_id = Uuid::parse_str(&req.workspace_id)
            .map_err(|_| Status::invalid_argument("Invalid workspace_id"))?;

        let stats = self
            .repo
            .get_dashboard_overview(workspace_id)
            .await
            .map_err(|e| Status::internal(format!("Database error: {}", e)))?;

        let tier_distribution: Vec<TierDistribution> = stats
            .tier_distribution
            .into_iter()
            .map(|t| TierDistribution {
                tier: t.tier as i32,
                count: t.count,
            })
            .collect();

        Ok(Response::new(DashboardResponse {
            total_profiles: stats.total_profiles,
            active_profiles_30d: stats.active_profiles_30d,
            total_deals_value: stats.total_deals_value,
            open_tickets: stats.open_tickets,
            tier_distribution,
        }))
    }

    async fn recalculate_scores(
        &self,
        request: Request<ScoreRequest>,
    ) -> Result<Response<ScoreResponse>, Status> {
        let req = request.into_inner();

        let workspace_id = Uuid::parse_str(&req.workspace_id)
            .map_err(|_| Status::invalid_argument("Invalid workspace_id"))?;

        let (profiles_updated, tier_changes) = self
            .score_engine
            .recalculate_scores(workspace_id)
            .await
            .map_err(|e| Status::internal(format!("Score calculation error: {}", e)))?;

        Ok(Response::new(ScoreResponse {
            profiles_updated: profiles_updated as i32,
            tier_changes: tier_changes as i32,
        }))
    }

    type CheckWhaleAlertStream = tokio_stream::wrappers::ReceiverStream<Result<WhaleAlert, Status>>;

    async fn check_whale_alert(
        &self,
        _request: Request<WhaleAlertRequest>,
    ) -> Result<Response<Self::CheckWhaleAlertStream>, Status> {
        // This is a placeholder - in production this would stream real whale alerts
        let (tx, rx) = tokio::sync::mpsc::channel(128);

        tokio::spawn(async move {
            // Stream whale alerts as they occur
            // For now, just close the stream
            drop(tx);
        });

        Ok(Response::new(tokio_stream::wrappers::ReceiverStream::new(rx)))
    }
}
