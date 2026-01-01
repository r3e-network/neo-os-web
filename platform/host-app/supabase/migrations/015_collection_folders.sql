-- Migration: Collection Folders
-- Description: Organize collections into folders with tags

-- Collection Folders Table
CREATE TABLE IF NOT EXISTS collection_folders (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📁',
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address, name)
);

-- Collection Tags Table
CREATE TABLE IF NOT EXISTS collection_tags (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    app_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address, app_id, tag)
);

-- Folder Items Table
CREATE TABLE IF NOT EXISTS folder_items (
    id BIGSERIAL PRIMARY KEY,
    folder_id BIGINT REFERENCES collection_folders(id) ON DELETE CASCADE,
    app_id TEXT NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(folder_id, app_id)
);

-- Indexes
CREATE INDEX idx_folders_wallet ON collection_folders(wallet_address);
CREATE INDEX idx_tags_wallet ON collection_tags(wallet_address);
CREATE INDEX idx_tags_app ON collection_tags(app_id);
CREATE INDEX idx_folder_items ON folder_items(folder_id);

-- Enable RLS
ALTER TABLE collection_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "folders_policy" ON collection_folders FOR ALL USING (true);
CREATE POLICY "tags_policy" ON collection_tags FOR ALL USING (true);
CREATE POLICY "items_policy" ON folder_items FOR ALL USING (true);
