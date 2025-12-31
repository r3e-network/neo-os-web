-- Migration: Leaderboard and User Activity Tables
-- Description: Store user gamification data and activity history

-- User Leaderboard Table
CREATE TABLE IF NOT EXISTS user_leaderboard (
    id BIGSERIAL PRIMARY KEY,
    wallet TEXT NOT NULL UNIQUE,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    badges INTEGER DEFAULT 0,
    total_tx INTEGER DEFAULT 0,
    total_volume TEXT DEFAULT '0',
    apps_used INTEGER DEFAULT 0,
    first_activity_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for leaderboard queries
CREATE INDEX idx_user_leaderboard_xp ON user_leaderboard(xp DESC);
CREATE INDEX idx_user_leaderboard_level ON user_leaderboard(level DESC);
CREATE INDEX idx_user_leaderboard_wallet ON user_leaderboard(wallet);

-- User Activity History Table
CREATE TABLE IF NOT EXISTS user_activity (
    id BIGSERIAL PRIMARY KEY,
    wallet TEXT NOT NULL,
    app_id TEXT NOT NULL,
    app_name TEXT,
    tx_hash TEXT,
    tx_count INTEGER DEFAULT 1,
    volume TEXT DEFAULT '0',
    activity_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for activity queries
CREATE INDEX idx_user_activity_wallet ON user_activity(wallet);
CREATE INDEX idx_user_activity_date ON user_activity(activity_date DESC);
CREATE INDEX idx_user_activity_app ON user_activity(app_id);
CREATE INDEX idx_user_activity_wallet_date ON user_activity(wallet, activity_date DESC);

-- Updated at trigger for leaderboard
CREATE OR REPLACE FUNCTION update_user_leaderboard_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_leaderboard_updated_at
    BEFORE UPDATE ON user_leaderboard
    FOR EACH ROW
    EXECUTE FUNCTION update_user_leaderboard_updated_at();

-- Enable RLS
ALTER TABLE user_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access for user_leaderboard"
    ON user_leaderboard FOR SELECT
    USING (true);

CREATE POLICY "Public read access for user_activity"
    ON user_activity FOR SELECT
    USING (true);

-- Service role write access
CREATE POLICY "Service role write access for user_leaderboard"
    ON user_leaderboard FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role write access for user_activity"
    ON user_activity FOR ALL
    USING (auth.role() = 'service_role');

-- Enable Realtime for leaderboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE user_leaderboard;
