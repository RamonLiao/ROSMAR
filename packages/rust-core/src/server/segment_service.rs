use crate::engine::segment_engine::SegmentEngine;
use crate::proto::crm::core::{
    segment_service_server::SegmentService, EvaluateRequest, EvaluateResponse, ProfileSummary,
    SegmentMembersRequest, SegmentMembersResponse,
};
use crate::repo::profile_repo::ProfileRepo;
use crate::repo::segment_repo::SegmentRepo;
use sqlx::PgPool;
use tonic::{Request, Response, Status};
use uuid::Uuid;

pub struct SegmentServiceImpl {
    segment_repo: SegmentRepo,
    profile_repo: ProfileRepo,
    segment_engine: SegmentEngine,
}

impl SegmentServiceImpl {
    pub fn new(pool: PgPool) -> Self {
        Self {
            segment_repo: SegmentRepo::new(pool.clone()),
            profile_repo: ProfileRepo::new(pool.clone()),
            segment_engine: SegmentEngine::new(pool),
        }
    }
}

#[tonic::async_trait]
impl SegmentService for SegmentServiceImpl {
    async fn evaluate_segment(
        &self,
        request: Request<EvaluateRequest>,
    ) -> Result<Response<EvaluateResponse>, Status> {
        let req = request.into_inner();

        let segment_id = Uuid::parse_str(&req.segment_id)
            .map_err(|_| Status::invalid_argument("Invalid segment_id"))?;

        // Get segment
        let segment = self
            .segment_repo
            .get_segment(segment_id)
            .await
            .map_err(|e| Status::internal(format!("Database error: {}", e)))?
            .ok_or_else(|| Status::not_found("Segment not found"))?;

        // Evaluate segment
        let profile_ids = self
            .segment_engine
            .evaluate_segment(segment.workspace_id, &segment.rules)
            .await
            .map_err(|e| Status::internal(format!("Evaluation error: {}", e)))?;

        // Update segment members
        self.segment_repo
            .update_segment_members(segment_id, &profile_ids)
            .await
            .map_err(|e| Status::internal(format!("Database error: {}", e)))?;

        Ok(Response::new(EvaluateResponse {
            member_count: profile_ids.len() as i32,
            profile_ids: profile_ids.into_iter().map(|id| id.to_string()).collect(),
        }))
    }

    async fn get_segment_members(
        &self,
        request: Request<SegmentMembersRequest>,
    ) -> Result<Response<SegmentMembersResponse>, Status> {
        let req = request.into_inner();

        let segment_id = Uuid::parse_str(&req.segment_id)
            .map_err(|_| Status::invalid_argument("Invalid segment_id"))?;

        let (profile_ids, total) = self
            .segment_repo
            .get_segment_members(segment_id, req.page, req.page_size)
            .await
            .map_err(|e| Status::internal(format!("Database error: {}", e)))?;

        // Fetch profile details
        let mut members = Vec::new();
        for profile_id in profile_ids {
            if let Ok(Some(profile)) = self.profile_repo.get_profile(profile_id).await {
                members.push(ProfileSummary {
                    id: profile.id.to_string(),
                    primary_address: profile.primary_address,
                    suins_name: profile.suins_name.unwrap_or_default(),
                    tier: profile.tier as i32,
                    engagement_score: profile.engagement_score,
                    tags: profile.tags,
                    display_name: profile.display_name.unwrap_or_default(),
                    last_active_at: profile
                        .last_active_at
                        .map(|t| t.to_rfc3339())
                        .unwrap_or_default(),
                });
            }
        }

        Ok(Response::new(SegmentMembersResponse {
            members,
            total: total as i32,
        }))
    }
}
