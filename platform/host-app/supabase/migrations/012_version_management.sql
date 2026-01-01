-- Migration: Version Management System
-- Description: MiniApp version history, changelogs, and rollback support

-- App Versions Table
CREATE TABLE IF NOT EXISTS app_versions (
    id BIGSERIAL PRIMARY KEY,
    app_id TEXT NOT NULL,
    version TEXT NOT NULL,
    entry_url TEXT NOT NULL,
    contract_hash TEXT,
    changelog TEXT,
    release_notes TEXT,
    is_current BOOLEAN DEFAULT false,
    is_stable BOOLEAN DEFAULT true,
    published_by TEXT NOT NULL,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(app_id, version)
);

-- Version Downloads/Installs Tracking
CREATE TABLE IF NOT EXISTS version_installs (
    id BIGSERIAL PRIMARY KEY,
    app_id TEXT NOT NULL,
    version TEXT NOT NULL,
    wallet_address TEXT,
    installed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rollback History
CREATE TABLE IF NOT EXISTS version_rollbacks (
    id BIGSERIAL PRIMARY KEY,
    app_id TEXT NOT NULL,
    from_version TEXT NOT NULL,
    to_version TEXT NOT NULL,
    reason TEXT,
    rolled_back_by TEXT NOT NULL,
    rolled_back_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_versions_app ON app_versions(app_id);
CREATE INDEX IF NOT EXISTS idx_versions_current ON app_versions(app_id, is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_installs_app_version ON version_installs(app_id, version);
CREATE INDEX IF NOT EXISTS idx_rollbacks_app ON version_rollbacks(app_id);

-- Enable RLS
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_rollbacks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read versions" ON app_versions FOR SELECT USING (true);
CREATE POLICY "Developers can manage versions" ON app_versions FOR ALL USING (true);
CREATE POLICY "Anyone can read installs" ON version_installs FOR SELECT USING (true);
CREATE POLICY "Users can insert installs" ON version_installs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read rollbacks" ON version_rollbacks FOR SELECT USING (true);

-- Function to set current version
CREATE OR REPLACE FUNCTION set_current_version()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_current = true THEN
        UPDATE app_versions SET is_current = false
        WHERE app_id = NEW.app_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_current_version
AFTER INSERT OR UPDATE ON app_versions
FOR EACH ROW EXECUTE FUNCTION set_current_version();
