use crate::proto::crm::core::{
    profile_service_server::ProfileService, ActivityEvent, ActivityFeedRequest,
    GetProfileRequest, ListProfilesRequest, ListProfilesResponse, ProfileDetail,
    ProfileFilter, ProfileSummary, SearchRequest, SearchResponse, SearchResult,
};
use crate::repo::profile_repo::ProfileRepo;
use sqlx::PgPool;
use tonic::{Request, Response, Status};
use uuid::Uuid;

pub struct ProfileServiceImpl {
    repo: ProfileRepo,
}

impl ProfileServiceImpl {
    pub fn new(pool: PgPool) -> Self {
        Self {
            repo: ProfileRepo::new(pool),
        }
    }
}

#[tonic::async_trait]
impl ProfileService for ProfileServiceImpl {
    async fn list_profiles(
        &self,
        request: Request<ListProfilesRequest>,
    ) -> Result<Response<ListProfilesResponse>, Status> {
        let req = request.into_inner();

        let workspace_id = Uuid::parse_str(&req.workspace_id)
            .map_err(|_| Status::invalid_argument("Invalid workspace_id"))?;

        let filter = req.filter.as_ref();
        let filter_tiers = filter.map(|f| f.tiers.clone()).unwrap_or_default();
        let filter_tags = filter.map(|f| f.tags.clone()).unwrap_or_default();
        let min_score = filter.and_then(|f| f.min_score);
        let max_score = filter.and_then(|f| f.max_score);
        let search_query = filter.and_then(|f| f.search_query.as_deref());

        let (profiles, total) = self
            .repo
            .list_profiles(
                workspace_id,
                req.page,
                req.page_size,
                &req.sort_by,
                &req.sort_order,
                &filter_tiers,
                &filter_tags,
                min_score,
                max_score,
                search_query,
            )
            .await
            .map_err(|e| Status::internal(format!("Database error: {}", e)))?;

        let profile_summaries: Vec<ProfileSummary> = profiles
            .into_iter()
            .map(|p| ProfileSummary {
                id: p.id.to_string(),
                primary_address: p.primary_address,
                suins_name: p.suins_name.unwrap_or_default(),
                tier: p.tier as i32,
                engagement_score: p.engagement_score,
                tags: p.tags,
                display_name: p.display_name.unwrap_or_default(),
                last_active_at: p
                    .last_active_at
                    .map(|t| t.to_rfc3339())
                    .unwrap_or_default(),
            })
            .collect();

        Ok(Response::new(ListProfilesResponse {
            profiles: profile_summaries,
            total: total as i32,
            page: req.page,
            page_size: req.page_size,
        }))
    }

    async fn get_profile(
        &self,
        request: Request<GetProfileRequest>,
    ) -> Result<Response<ProfileDetail>, Status> {
        let req = request.into_inner();

        let profile_id = Uuid::parse_str(&req.id)
            .map_err(|_| Status::invalid_argument("Invalid profile id"))?;

        let profile = self
            .repo
            .get_profile(profile_id)
            .await
            .map_err(|e| Status::internal(format!("Database error: {}", e)))?
            .ok_or_else(|| Status::not_found("Profile not found"))?;

        let summary = ProfileSummary {
            id: profile.id.to_string(),
            primary_address: profile.primary_address.clone(),
            suins_name: profile.suins_name.clone().unwrap_or_default(),
            tier: profile.tier as i32,
            engagement_score: profile.engagement_score,
            tags: profile.tags.clone(),
            display_name: profile.display_name.clone().unwrap_or_default(),
            last_active_at: profile
                .last_active_at
                .map(|t| t.to_rfc3339())
                .unwrap_or_default(),
        };

        Ok(Response::new(ProfileDetail {
            summary: Some(summary),
            sui_object_id: profile.sui_object_id.unwrap_or_default(),
            avatar_url: profile.avatar_url.unwrap_or_default(),
            source: profile.source.unwrap_or_default(),
            created_at: profile.created_at.to_rfc3339(),
            updated_at: profile.updated_at.to_rfc3339(),
            version: profile.version,
            is_archived: profile.is_archived,
        }))
    }

    type GetActivityFeedStream = tokio_stream::wrappers::ReceiverStream<Result<ActivityEvent, Status>>;

    async fn get_activity_feed(
        &self,
        request: Request<ActivityFeedRequest>,
    ) -> Result<Response<Self::GetActivityFeedStream>, Status> {
        let req = request.into_inner();

        let profile_id = Uuid::parse_str(&req.profile_id)
            .map_err(|_| Status::invalid_argument("Invalid profile_id"))?;

        let before = if req.before.is_empty() {
            None
        } else {
            Some(
                chrono::DateTime::parse_from_rfc3339(&req.before)
                    .map_err(|_| Status::invalid_argument("Invalid before timestamp"))?
                    .with_timezone(&chrono::Utc),
            )
        };

        let events = self
            .repo
            .get_activity_feed(profile_id, req.limit, before)
            .await
            .map_err(|e| Status::internal(format!("Database error: {}", e)))?;

        let (tx, rx) = tokio::sync::mpsc::channel(128);

        tokio::spawn(async move {
            for event in events {
                let activity = ActivityEvent {
                    time: event.time.to_rfc3339(),
                    event_type: event.event_type,
                    contract_address: event.contract_address.unwrap_or_default(),
                    collection: event.collection.unwrap_or_default(),
                    token: event.token.unwrap_or_default(),
                    amount: event.amount,
                    tx_digest: event.tx_digest,
                };

                if tx.send(Ok(activity)).await.is_err() {
                    break;
                }
            }
        });

        Ok(Response::new(tokio_stream::wrappers::ReceiverStream::new(rx)))
    }

    async fn search(
        &self,
        request: Request<SearchRequest>,
    ) -> Result<Response<SearchResponse>, Status> {
        let req = request.into_inner();

        let workspace_id = Uuid::parse_str(&req.workspace_id)
            .map_err(|_| Status::invalid_argument("Invalid workspace_id"))?;

        let profiles = self
            .repo
            .search(workspace_id, &req.query, req.limit)
            .await
            .map_err(|e| Status::internal(format!("Database error: {}", e)))?;

        let results: Vec<SearchResult> = profiles
            .into_iter()
            .map(|p| SearchResult {
                id: p.id.to_string(),
                r#type: "profile".to_string(),
                title: p.display_name.unwrap_or_else(|| p.primary_address.clone()),
                subtitle: format!("Tier: {} | Score: {}", p.tier, p.engagement_score),
            })
            .collect();

        Ok(Response::new(SearchResponse { results }))
    }
}
