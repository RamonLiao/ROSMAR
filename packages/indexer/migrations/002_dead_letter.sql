CREATE TABLE IF NOT EXISTS dead_letter_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  TEXT NOT NULL,
    payload     JSONB NOT NULL,
    error_msg   TEXT,
    source      TEXT NOT NULL,  -- 'batch_writer' | 'webhook' | 'alert_webhook'
    attempts    INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    replayed_at TIMESTAMPTZ
);

CREATE INDEX idx_dead_letter_source ON dead_letter_events(source);
CREATE INDEX idx_dead_letter_created ON dead_letter_events(created_at);
