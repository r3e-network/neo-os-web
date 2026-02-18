-- =============================================================================
-- Community MiniApp submissions queue
-- =============================================================================

CREATE TABLE IF NOT EXISTS miniapp_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '📦',
    category TEXT NOT NULL DEFAULT 'utility',
    entry_url TEXT NOT NULL,
    contract_hash TEXT,
    developer_address TEXT NOT NULL,
    developer_name TEXT,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    source TEXT NOT NULL DEFAULT 'community',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_miniapp_submissions_status
    ON miniapp_submissions (status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_miniapp_submissions_category
    ON miniapp_submissions (category, submitted_at DESC);

ALTER TABLE miniapp_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_all_submissions
    ON miniapp_submissions FOR ALL TO service_role
    USING (true);

CREATE POLICY public_submit_community
    ON miniapp_submissions FOR INSERT TO anon
    WITH CHECK (source = 'community');

CREATE POLICY public_read_submissions
    ON miniapp_submissions FOR SELECT TO anon
    USING (true);
