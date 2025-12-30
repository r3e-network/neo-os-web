-- Migration: MiniApp Statistics Tables
-- Description: Store aggregated statistics for MiniApps from chain data

-- MiniApp Stats Table: Aggregated statistics per app
CREATE TABLE IF NOT EXISTS miniapp_stats (
    id BIGSERIAL PRIMARY KEY,
    app_id TEXT NOT NULL UNIQUE,
    contract_hash TEXT,

    -- User metrics
    active_users_daily INTEGER DEFAULT 0,
    active_users_weekly INTEGER DEFAULT 0,
    active_users_monthly INTEGER DEFAULT 0,
    total_unique_users INTEGER DEFAULT 0,

    -- Transaction metrics
    total_transactions INTEGER DEFAULT 0,
    transactions_24h INTEGER DEFAULT 0,
    transactions_7d INTEGER DEFAULT 0,

    -- Volume metrics (in GAS, stored as text for precision)
    total_volume_gas TEXT DEFAULT '0',
    volume_24h_gas TEXT DEFAULT '0',
    volume_7d_gas TEXT DEFAULT '0',

    -- App-specific metrics (JSON for flexibility)
    live_data JSONB DEFAULT '{}',

    -- Rating and engagement
    rating DECIMAL(3,2) DEFAULT 0.00,
    rating_count INTEGER DEFAULT 0,

    -- Timestamps
    last_activity_at TIMESTAMPTZ,
    last_rollup_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_miniapp_stats_app_id ON miniapp_stats(app_id);
CREATE INDEX idx_miniapp_stats_contract_hash ON miniapp_stats(contract_hash);
CREATE INDEX idx_miniapp_stats_last_activity ON miniapp_stats(last_activity_at DESC);
CREATE INDEX idx_miniapp_stats_total_users ON miniapp_stats(total_unique_users DESC);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_miniapp_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_miniapp_stats_updated_at
    BEFORE UPDATE ON miniapp_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_miniapp_stats_updated_at();

-- Enable RLS
ALTER TABLE miniapp_stats ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access for miniapp_stats"
    ON miniapp_stats FOR SELECT
    USING (true);

-- Service role write access
CREATE POLICY "Service role write access for miniapp_stats"
    ON miniapp_stats FOR ALL
    USING (auth.role() = 'service_role');
