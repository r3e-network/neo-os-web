-- =============================================================================
-- MiniApp Daily Statistics Tracking (for Trending Calculation)
-- =============================================================================

-- Daily transaction snapshots for trending calculation
CREATE TABLE miniapp_stats_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id TEXT NOT NULL REFERENCES miniapps(app_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    tx_count INTEGER NOT NULL DEFAULT 0,
    active_users INTEGER NOT NULL DEFAULT 0,
    gas_used NUMERIC(30,8) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(app_id, date)
);

CREATE INDEX idx_miniapp_stats_daily_app ON miniapp_stats_daily(app_id, date DESC);

ALTER TABLE miniapp_stats_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_all ON miniapp_stats_daily FOR ALL TO service_role USING (true);
CREATE POLICY public_read ON miniapp_stats_daily FOR SELECT TO anon USING (true);
