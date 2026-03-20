pub mod alerts;
pub mod cache;
pub mod config;
pub mod consumer;
pub mod db;
pub mod enricher;
pub mod handlers;
pub mod retry;
pub mod router;
pub mod webhook;
pub mod writer;

pub fn version() -> &'static str {
    "0.1.0"
}
