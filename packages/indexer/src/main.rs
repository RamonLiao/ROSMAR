mod alerts;
mod cache;
mod config;
mod consumer;
mod db;
mod enricher;
mod handlers;
mod retry;
mod router;
mod webhook;
mod writer;

use clap::{Parser, Subcommand};
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Parser)]
#[command(name = "crm-indexer", version, about = "ROSMAR CRM blockchain indexer")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the indexer (default)
    Run,
    /// Replay dead-letter events
    Replay {
        /// Filter by source (batch_writer, webhook, alert_webhook)
        #[arg(short, long)]
        source: Option<String>,
        /// Hours to look back (default: 24)
        #[arg(short = 'H', long, default_value = "24")]
        hours: i64,
    },
}

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

    let cli = Cli::parse();

    match cli.command.unwrap_or(Commands::Run) {
        Commands::Run => run_indexer().await,
        Commands::Replay { source, hours } => replay_dead_letters(source, hours).await,
    }
}

async fn run_indexer() -> Result<(), Box<dyn std::error::Error>> {
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
    let alert_engine = Arc::new(alerts::AlertEngine::new(config.clone(), pool.clone()));
    tracing::info!("Alert engine initialized");

    // Create webhook dispatcher
    let webhook_dispatcher = Arc::new(webhook::WebhookDispatcher::new(
        config.bff_webhook_url.clone(),
    ));
    tracing::info!("Webhook dispatcher initialized");

    // Create BatchWriter channel
    let (batch_tx, batch_rx) = tokio::sync::mpsc::channel(1000);
    let batch_writer = writer::BatchWriter::new(
        pool.clone(),
        config.batch_size,
        config.batch_timeout_ms,
    );

    // Spawn BatchWriter as background task
    tokio::spawn(async move {
        if let Err(e) = batch_writer.start(batch_rx).await {
            tracing::error!("BatchWriter error: {}", e);
        }
    });
    tracing::info!("BatchWriter started");

    // Create event router
    let router = Arc::new(
        router::EventRouter::new(
            pool.clone(),
            config.clone(),
            enricher.clone(),
            alert_engine,
            batch_tx,
        )
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

async fn replay_dead_letters(
    source: Option<String>,
    hours: i64,
) -> Result<(), Box<dyn std::error::Error>> {
    tracing::info!("Replaying dead-letter events (hours={}, source={:?})", hours, source);

    let config = config::Config::from_env()?;
    let pool = db::create_pool(&config.database_url).await?;

    let dead_letters = db::list_dead_letters(
        &pool,
        hours,
        source.as_deref(),
    )
    .await?;

    if dead_letters.is_empty() {
        tracing::info!("No dead-letter events found");
        return Ok(());
    }

    tracing::info!("Found {} dead-letter events to replay", dead_letters.len());

    // Set up router for replay
    let cache = cache::AddressCache::new();
    let enricher = Arc::new(enricher::Enricher::new(cache, pool.clone()));
    let alert_engine = Arc::new(alerts::AlertEngine::new(config.clone(), pool.clone()));
    let webhook_dispatcher = Arc::new(webhook::WebhookDispatcher::new(
        config.bff_webhook_url.clone(),
    ));
    let (batch_tx, batch_rx) = tokio::sync::mpsc::channel(1000);
    let batch_writer = writer::BatchWriter::new(
        pool.clone(),
        config.batch_size,
        config.batch_timeout_ms,
    );

    tokio::spawn(async move {
        if let Err(e) = batch_writer.start(batch_rx).await {
            tracing::error!("BatchWriter error during replay: {}", e);
        }
    });

    let router = router::EventRouter::new(
        pool.clone(),
        config,
        enricher,
        alert_engine,
        batch_tx,
    )
    .with_webhook(webhook_dispatcher);

    let mut replayed = 0;
    let mut failed = 0;

    for (id, event_type, payload) in &dead_letters {
        tracing::info!("Replaying dead-letter {} (type: {})", id, event_type);

        match router.route_event(payload).await {
            Ok(()) => {
                db::mark_replayed(&pool, *id).await?;
                replayed += 1;
                tracing::info!("Successfully replayed {}", id);
            }
            Err(e) => {
                failed += 1;
                tracing::error!("Failed to replay {}: {}", id, e);
            }
        }
    }

    tracing::info!(
        "Replay complete: {} replayed, {} failed out of {} total",
        replayed, failed, dead_letters.len()
    );

    Ok(())
}
