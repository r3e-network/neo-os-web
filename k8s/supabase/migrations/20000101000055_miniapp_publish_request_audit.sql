-- =============================================================================
-- MiniApp publish request immutable audit chain
-- =============================================================================

CREATE TABLE IF NOT EXISTS miniapp_publish_request_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES miniapp_publish_requests(id) ON DELETE CASCADE,
    app_id TEXT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN (
      'request_created',
      'request_approved',
      'request_rejected',
      'request_cancelled',
      'request_applied',
      'reminder_sent'
    )),
    status TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    prev_hash TEXT,
    chain_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_miniapp_publish_request_audit_request
    ON miniapp_publish_request_audit (request_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_miniapp_publish_request_audit_app
    ON miniapp_publish_request_audit (app_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_miniapp_publish_request_audit_chain_hash
    ON miniapp_publish_request_audit (chain_hash);

ALTER TABLE miniapp_publish_request_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_all_miniapp_publish_request_audit
    ON miniapp_publish_request_audit FOR ALL TO service_role
    USING (true);
