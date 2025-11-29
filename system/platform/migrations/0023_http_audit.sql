-- HTTP audit log persistence (optional; in-memory buffer remains).

CREATE TABLE IF NOT EXISTS http_audit_log (
    id BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_name TEXT,
    role_name TEXT,
    tenant TEXT,
    path TEXT NOT NULL,
    method TEXT NOT NULL,
    status INTEGER NOT NULL,
    remote_addr TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_http_audit_log_time ON http_audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_http_audit_log_status ON http_audit_log (status);
