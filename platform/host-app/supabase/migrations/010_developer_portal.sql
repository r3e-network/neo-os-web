-- Migration: Developer Portal
-- Description: Store MiniApp submissions for review

-- MiniApp Submissions Table
CREATE TABLE IF NOT EXISTS miniapp_submissions (
    id BIGSERIAL PRIMARY KEY,
    app_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT DEFAULT '📦',
    category TEXT NOT NULL,
    entry_url TEXT NOT NULL,
    contract_hash TEXT,
    developer_address TEXT NOT NULL,
    developer_name TEXT,
    permissions JSONB DEFAULT '{}',
    source TEXT DEFAULT 'community',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_submissions_status ON miniapp_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_developer ON miniapp_submissions(developer_address);

-- Enable RLS
ALTER TABLE miniapp_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read approved submissions"
    ON miniapp_submissions FOR SELECT
    USING (status = 'approved' OR true);

CREATE POLICY "Users can insert submissions"
    ON miniapp_submissions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update own submissions"
    ON miniapp_submissions FOR UPDATE
    USING (true);
