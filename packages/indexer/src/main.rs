mod alerts;
mod cache;
mod config;
mod consumer;
mod db;
mod enricher;
mod handlers;
mod router;
mod webhook;
mod writer;

use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "crm_indexer=debug,info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting CRM Indexer");

    // Load configuration
    let config = config::Config::from_env()?;
    tracing::info!("Loaded configuration for network: {}", config.sui_network);

    // Create database connection pool
    let pool = db::create_pool(&config.database_url).await?;
    tracing::info!("Connected to database");

    // Initialize address cache
    let cache = cache::AddressCache::new();

    // Create enricher and preload cache
    let enricher = Arc::new(enricher::Enricher::new(cache.clone(), pool.clone()));
    let preloaded = enricher.preload_cache().await?;
    tracing::info!("Preloaded {} profiles into cache", preloaded);

    // Initialize alert engine
    let _alert_engine = alerts::AlertEngine::new(config.clone(), pool.clone());
    tracing::info!("Alert engine initialized");

    // Create webhook dispatcher
    let webhook_dispatcher = Arc::new(webhook::WebhookDispatcher::new(
        config.bff_webhook_url.clone(),
    ));
    tracing::info!("Webhook dispatcher initialized");

    // Create event router
    let router = Arc::new(
        router::EventRouter::new(pool.clone(), enricher.clone())
            .with_webhook(webhook_dispatcher),
    );
    tracing::info!("Event router initialized");

    // Create checkpoint consumer
    let consumer = consumer::CheckpointConsumer::new(config.clone(), pool.clone(), router);

    // Get starting checkpoint
    let start_checkpoint = db::get_last_checkpoint(&pool).await?;
    tracing::info!("Starting from checkpoint: {}", start_checkpoint);

    // Start consumer (this runs forever)
    tracing::info!("Starting checkpoint consumer...");
    consumer.start().await?;

    Ok(())
}
