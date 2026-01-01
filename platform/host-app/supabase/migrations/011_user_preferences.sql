-- Migration: User Preferences System
-- Description: Store user preferences, followed developers, and personalized recommendations

-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    preferred_categories JSONB DEFAULT '[]',
    notification_settings JSONB DEFAULT '{"email": false, "push": true, "digest": "daily"}',
    theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Followed Developers Table
CREATE TABLE IF NOT EXISTS followed_developers (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    developer_address TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address, developer_address)
);

-- Personalized Recommendations Cache
CREATE TABLE IF NOT EXISTS user_recommendations (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    app_id TEXT NOT NULL,
    score DECIMAL(5,4) DEFAULT 0,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    UNIQUE(wallet_address, app_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_preferences_wallet ON user_preferences(wallet_address);
CREATE INDEX IF NOT EXISTS idx_followed_wallet ON followed_developers(wallet_address);
CREATE INDEX IF NOT EXISTS idx_followed_developer ON followed_developers(developer_address);
CREATE INDEX IF NOT EXISTS idx_recommendations_wallet ON user_recommendations(wallet_address);
CREATE INDEX IF NOT EXISTS idx_recommendations_expires ON user_recommendations(expires_at);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE followed_developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own preferences" ON user_preferences FOR ALL USING (true);
CREATE POLICY "Users can manage followed developers" ON followed_developers FOR ALL USING (true);
CREATE POLICY "Users can read own recommendations" ON user_recommendations FOR SELECT USING (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_preferences_timestamp
BEFORE UPDATE ON user_preferences
FOR EACH ROW EXECUTE FUNCTION update_preferences_timestamp();
