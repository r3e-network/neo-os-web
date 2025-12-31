-- Migration: MiniApp Executions Table
-- Description: Track MiniApp execution status for real-time frontend updates
-- This enables Supabase as middleware between local backend and Vercel frontend

CREATE TABLE IF NOT EXISTS miniapp_executions (
    id BIGSERIAL PRIMARY KEY,

    -- Execution identification
    request_id TEXT NOT NULL UNIQUE,
    app_id TEXT NOT NULL,

    -- User context
    user_address TEXT,
    session_id TEXT,

    -- Execution status
    status TEXT NOT NULL DEFAULT 'pending',
    -- Status values: pending, processing, success, failed, timeout

    -- Request details
    method TEXT NOT NULL,
    params JSONB DEFAULT '{}',

    -- Response data
    result JSONB,
    error_message TEXT,
    error_code TEXT,

    -- Transaction info (if applicable)
    tx_hash TEXT,
    tx_status TEXT,

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- Indexes for efficient queries
CREATE INDEX idx_executions_app_id ON miniapp_executions(app_id);
CREATE INDEX idx_executions_user ON miniapp_executions(user_address);
CREATE INDEX idx_executions_status ON miniapp_executions(status);
CREATE INDEX idx_executions_created ON miniapp_executions(created_at DESC);
CREATE INDEX idx_executions_session ON miniapp_executions(session_id);

-- Enable Row Level Security
ALTER TABLE miniapp_executions ENABLE ROW LEVEL SECURITY;

-- Public read access (users can see their own executions)
CREATE POLICY "Users can read own executions"
    ON miniapp_executions FOR SELECT
    USING (true);

-- Service role write access (backend writes)
CREATE POLICY "Service role write access"
    ON miniapp_executions FOR ALL
    USING (auth.role() = 'service_role');

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE miniapp_executions;

COMMENT ON TABLE miniapp_executions IS 'Tracks MiniApp execution status for real-time sync between backend and frontend';
