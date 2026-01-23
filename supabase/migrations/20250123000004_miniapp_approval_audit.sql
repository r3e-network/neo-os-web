-- MiniApp Approval Audit Table
-- Tracks all approval status changes for audit trail

-- Note: notifications table already exists in backend_schema migration
-- This migration only creates the miniapp_approval_audit table

CREATE TABLE IF NOT EXISTS public.miniapp_approval_audit (
    id BIGSERIAL PRIMARY KEY,
    submission_id UUID NOT NULL,
    app_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'request_changes')),
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    reviewer_id UUID NOT NULL,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_approval_submission
        FOREIGN KEY (submission_id)
        REFERENCES public.miniapp_submissions(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_approval_audit_submission_id ON miniapp_approval_audit(submission_id);
CREATE INDEX IF NOT EXISTS idx_approval_audit_app_id ON miniapp_approval_audit(app_id);
CREATE INDEX IF NOT EXISTS idx_approval_audit_reviewer_id ON miniapp_approval_audit(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_approval_audit_created_at ON miniapp_approval_audit(created_at DESC);

COMMENT ON TABLE public.miniapp_approval_audit IS 'Audit trail for MiniApp submission approval actions';
COMMENT ON COLUMN miniapp_approval_audit.submission_id IS 'Reference to miniapp_submissions.id';
COMMENT ON COLUMN miniapp_approval_audit.action IS 'Type of approval action: approve, reject, or request_changes';
COMMENT ON COLUMN miniapp_approval_audit.reviewer_id IS 'UUID of the admin who performed this action';

ALTER TABLE miniapp_approval_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage audit log"
    ON miniapp_approval_audit
    FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Authenticated can read audit log"
    ON miniapp_approval_audit
    FOR SELECT
    TO authenticated
    USING (true);

GRANT SELECT, INSERT ON miniapp_approval_audit TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE miniapp_approval_audit_id_seq TO authenticated;
