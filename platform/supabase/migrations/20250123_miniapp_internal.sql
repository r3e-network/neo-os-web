-- Internal miniapps (pre-built, in our repo)
-- Stores reference to our own miniapps that are already built

CREATE TABLE IF NOT EXISTS miniapp_internal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source location (our repo)
    git_url TEXT NOT NULL DEFAULT 'https://github.com/R3E-Network/service_layer.git',
    subfolder TEXT NOT NULL,
    branch TEXT NOT NULL DEFAULT 'master',
    git_commit_sha TEXT,

    -- App information
    app_id TEXT NOT NULL UNIQUE,
    manifest JSONB NOT NULL,
    manifest_hash TEXT NOT NULL,

    -- Pre-built assets location
    entry_url TEXT NOT NULL,
    icon_url TEXT,
    banner_url TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'active',
    -- active, disabled, deprecated

    -- Version tracking
    current_version TEXT,

    -- Metadata
    category TEXT,
    tags TEXT[],

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_internal_app_id ON miniapp_internal(app_id);
CREATE INDEX IF NOT EXISTS idx_internal_subfolder ON miniapp_internal(subfolder);
CREATE INDEX IF NOT EXISTS idx_internal_status ON miniapp_internal(status);
CREATE INDEX IF NOT EXISTS idx_internal_category ON miniapp_internal(category);

-- RLS Policies
ALTER TABLE miniapp_internal ENABLE ROW LEVEL SECURITY;

-- Everyone can read active internal miniapps
CREATE POLICY "Everyone can read active internal miniapps"
    ON miniapp_internal
    FOR SELECT
    USING (status = 'active');

-- Admins can manage internal miniapps
CREATE POLICY "Admins can manage internal miniapps"
    ON miniapp_internal
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admin_emails
            WHERE user_id = auth.uid()
        )
    );

-- Insert comment for documentation
COMMENT ON TABLE miniapp_internal IS 'Internal pre-built miniapps from our repository';
COMMENT ON COLUMN miniapp_internal.subfolder IS 'Path to miniapp folder, e.g., miniapps-uniapp/apps/coin-flip';
COMMENT ON COLUMN miniapp_internal.entry_url IS 'CDN URL where the pre-built app is hosted';
COMMENT ON COLUMN miniapp_internal.status IS 'active: enabled, disabled: temporarily disabled, deprecated: will be removed';
