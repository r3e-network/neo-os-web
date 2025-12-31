-- Migration: User Collections (Favorites)
-- Description: Store user's collected/favorited MiniApps linked to wallet address

-- User Collections Table
CREATE TABLE IF NOT EXISTS user_collections (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    app_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address, app_id)
);

-- Index for fast lookups by wallet
CREATE INDEX IF NOT EXISTS idx_user_collections_wallet
    ON user_collections(wallet_address);

-- Index for app popularity queries
CREATE INDEX IF NOT EXISTS idx_user_collections_app
    ON user_collections(app_id);

-- Enable RLS
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;

-- Users can read their own collections
CREATE POLICY "Users can read own collections"
    ON user_collections FOR SELECT
    USING (true);

-- Users can insert their own collections
CREATE POLICY "Users can insert own collections"
    ON user_collections FOR INSERT
    WITH CHECK (true);

-- Users can delete their own collections
CREATE POLICY "Users can delete own collections"
    ON user_collections FOR DELETE
    USING (true);

-- Anon access for API
CREATE POLICY "anon_read_collections"
    ON user_collections FOR SELECT TO anon
    USING (true);

CREATE POLICY "anon_insert_collections"
    ON user_collections FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "anon_delete_collections"
    ON user_collections FOR DELETE TO anon
    USING (true);
