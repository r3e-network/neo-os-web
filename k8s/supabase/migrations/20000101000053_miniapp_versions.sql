-- =============================================================================
-- MiniApp Versioning and Release Channels
-- =============================================================================

CREATE TABLE IF NOT EXISTS miniapp_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT NOT NULL REFERENCES miniapps(app_id) ON DELETE CASCADE,
    version_no BIGINT NOT NULL,
    source_action TEXT NOT NULL CHECK (source_action IN ('save_draft', 'publish', 'disable', 'rollback')),
    release_channel TEXT NOT NULL CHECK (release_channel IN ('draft', 'published')),
    status app_status NOT NULL,
    manifest_hash TEXT NOT NULL,
    manifest JSONB NOT NULL,
    row_snapshot JSONB NOT NULL,
    actor TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (app_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_miniapp_versions_app_created
    ON miniapp_versions (app_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_miniapp_versions_app_channel
    ON miniapp_versions (app_id, release_channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_miniapp_versions_manifest_hash
    ON miniapp_versions (manifest_hash);

CREATE TABLE IF NOT EXISTS miniapp_releases (
    app_id TEXT PRIMARY KEY REFERENCES miniapps(app_id) ON DELETE CASCADE,
    draft_version_id UUID REFERENCES miniapp_versions(id) ON DELETE SET NULL,
    published_version_id UUID REFERENCES miniapp_versions(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS miniapp_release_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT NOT NULL REFERENCES miniapps(app_id) ON DELETE CASCADE,
    release_channel TEXT NOT NULL CHECK (release_channel IN ('draft', 'published')),
    from_version_id UUID REFERENCES miniapp_versions(id) ON DELETE SET NULL,
    to_version_id UUID REFERENCES miniapp_versions(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('save_draft', 'publish', 'disable', 'rollback')),
    actor TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_miniapp_release_history_app_created
    ON miniapp_release_history (app_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_miniapp_release_history_channel
    ON miniapp_release_history (app_id, release_channel, created_at DESC);

ALTER TABLE miniapp_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE miniapp_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE miniapp_release_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_all_miniapp_versions
    ON miniapp_versions FOR ALL TO service_role
    USING (true);

CREATE POLICY service_all_miniapp_releases
    ON miniapp_releases FOR ALL TO service_role
    USING (true);

CREATE POLICY service_all_miniapp_release_history
    ON miniapp_release_history FOR ALL TO service_role
    USING (true);
