-- Migration: Rankings System
-- Description: Hot, trending, and new app rankings

-- App Rankings Table
CREATE TABLE IF NOT EXISTS app_rankings (
    id BIGSERIAL PRIMARY KEY,
    app_id TEXT NOT NULL,
    rank_type TEXT NOT NULL,
    rank_position INTEGER NOT NULL,
    score DECIMAL(10,2) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(app_id, rank_type)
);

-- Indexes
CREATE INDEX idx_rankings_type ON app_rankings(rank_type, rank_position);

-- Enable RLS
ALTER TABLE app_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rankings_read" ON app_rankings FOR SELECT USING (true);
CREATE POLICY "rankings_write" ON app_rankings FOR ALL USING (true);
