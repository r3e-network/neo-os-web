-- =============================================================================
-- Stats Rollup Idempotency: Add tracking table and advisory lock
-- =============================================================================

-- Track rollup executions to prevent redundant processing
CREATE TABLE IF NOT EXISTS miniapp_stats_rollup_log (
    id SERIAL PRIMARY KEY,
    rollup_date DATE NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    apps_processed INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running',
    UNIQUE(rollup_date, status) WHERE status = 'completed'
);

CREATE INDEX IF NOT EXISTS idx_rollup_log_date
    ON miniapp_stats_rollup_log(rollup_date, status);
