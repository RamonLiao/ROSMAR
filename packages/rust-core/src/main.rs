mod config;
mod engine;
mod repo;
mod scheduler;
mod server;

// Include generated proto code
pub mod proto {
    pub mod crm {
        pub mod core {
            tonic::include_proto!("crm.core");
        }
    }
}

use crate::proto::crm::core::{
    analytics_service_server::AnalyticsServiceServer,
    profile_service_server::ProfileServiceServer,
    segment_service_server::SegmentServiceServer,
};
use crate::server::{
    analytics_service::AnalyticsServiceImpl, profile_service::ProfileServiceImpl,
    segment_service::SegmentServiceImpl,
};
use sqlx::postgres::PgPoolOptions;
use tonic::transport::Server;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "crm_core=debug,info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting CRM Core gRPC Service");

    // Load configuration
    let config = config::Config::from_env()?;
    tracing::info!("Loaded configuration");

    // Create database connection pool
    let pool = PgPoolOptions::new()
        .max_connections(50)
        .connect(&config.database_url)
        .await?;

    tracing::info!("Connected to database");

    // Initialize services
    let profile_service = ProfileServiceImpl::new(pool.clone());
    let segment_service = SegmentServiceImpl::new(pool.clone());
    let analytics_service = AnalyticsServiceImpl::new(pool.clone());

    tracing::info!("Services initialized");

    // Start scheduler
    let scheduler = scheduler::Scheduler::new(pool.clone());
    scheduler.start().await;

    // Build gRPC server
    let addr = format!("0.0.0.0:{}", config.grpc_port).parse()?;

    tracing::info!("Starting gRPC server on {}", addr);

    Server::builder()
        .add_service(ProfileServiceServer::new(profile_service))
        .add_service(SegmentServiceServer::new(segment_service))
        .add_service(AnalyticsServiceServer::new(analytics_service))
        .serve(addr)
        .await?;

    Ok(())
}
