-- =============================================================================
-- MiniApp publish approval workflow
-- =============================================================================

CREATE TABLE IF NOT EXISTS miniapp_publish_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT NOT NULL REFERENCES miniapps(app_id) ON DELETE CASCADE,
    requested_version_id UUID REFERENCES miniapp_versions(id) ON DELETE SET NULL,
    requested_version_no BIGINT,
    requested_manifest_hash TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    request_note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'cancelled')),
    review_note TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    applied_version_id UUID REFERENCES miniapp_versions(id) ON DELETE SET NULL,
    applied_at TIMESTAMPTZ,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_miniapp_publish_requests_app_status
    ON miniapp_publish_requests (app_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_miniapp_publish_requests_status_requested
    ON miniapp_publish_requests (status, requested_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_miniapp_publish_requests_pending_app
    ON miniapp_publish_requests (app_id)
    WHERE status = 'pending';

ALTER TABLE miniapp_publish_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_all_miniapp_publish_requests
    ON miniapp_publish_requests FOR ALL TO service_role
    USING (true);
