-- Migration: Platform Global Statistics Table
-- Description: Store platform-wide statistics that persist and grow over time

-- Platform Stats Table: Single row for global platform metrics
CREATE TABLE IF NOT EXISTS platform_stats (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Ensure single row
    total_users INTEGER DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    total_volume_gas TEXT DEFAULT '0',
    active_apps INTEGER DEFAULT 64,
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial row with seed data
INSERT INTO platform_stats (id, total_users, total_transactions, total_volume_gas, active_apps)
VALUES (1, 12500, 445000, '125000.00', 64)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE platform_stats ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access for platform_stats"
    ON platform_stats FOR SELECT
    USING (true);

-- Service role write access
CREATE POLICY "Service role write access for platform_stats"
    ON platform_stats FOR ALL
    USING (auth.role() = 'service_role');

-- Anon read access (for frontend)
CREATE POLICY "anon_read_platform_stats"
    ON platform_stats FOR SELECT TO anon
    USING (true);
