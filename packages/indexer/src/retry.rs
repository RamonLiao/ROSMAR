use std::time::Duration;
use tokio::time::sleep;

/// Retry manager with exponential backoff
pub struct RetryManager {
    max_retries: u32,
    base_delay: Duration,
}

impl RetryManager {
    pub fn new(max_retries: u32, base_delay_ms: u64) -> Self {
        Self {
            max_retries,
            base_delay: Duration::from_millis(base_delay_ms),
        }
    }

    pub fn max_retries(&self) -> u32 {
        self.max_retries
    }

    /// Execute an async closure with exponential backoff retry.
    pub async fn execute<F, Fut, T, E>(&self, mut f: F) -> Result<T, E>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<T, E>>,
        E: std::fmt::Display,
    {
        let mut last_error: Option<E> = None;

        for attempt in 0..=self.max_retries {
            match f().await {
                Ok(val) => return Ok(val),
                Err(e) => {
                    if attempt < self.max_retries {
                        let delay = self.base_delay * 2u32.pow(attempt);
                        tracing::warn!(
                            "Retry {}/{}: {} (next attempt in {:?})",
                            attempt + 1,
                            self.max_retries,
                            e,
                            delay
                        );
                        sleep(delay).await;
                    }
                    last_error = Some(e);
                }
            }
        }

        Err(last_error.unwrap())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Arc;

    #[tokio::test]
    async fn test_retry_succeeds_on_third_attempt() {
        let counter = Arc::new(AtomicU32::new(0));
        let retry = RetryManager::new(3, 10);

        let c = counter.clone();
        let result = retry
            .execute(|| {
                let c = c.clone();
                async move {
                    let attempt = c.fetch_add(1, Ordering::SeqCst);
                    if attempt < 2 {
                        Err(format!("fail attempt {}", attempt))
                    } else {
                        Ok("success")
                    }
                }
            })
            .await;

        assert_eq!(result.unwrap(), "success");
        assert_eq!(counter.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn test_retry_exhausted() {
        let retry = RetryManager::new(2, 10);

        let result: Result<(), String> = retry
            .execute(|| async { Err("always fails".to_string()) })
            .await;

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "always fails");
    }

    #[tokio::test]
    async fn test_retry_succeeds_first_try() {
        let retry = RetryManager::new(3, 10);

        let result = retry.execute(|| async { Ok::<_, String>("immediate") }).await;

        assert_eq!(result.unwrap(), "immediate");
    }
}
