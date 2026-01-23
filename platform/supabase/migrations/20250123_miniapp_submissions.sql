-- Miniapp submissions for external developers
-- Stores submissions from external developers who submit their source code via Git URL

CREATE TABLE IF NOT EXISTS miniapp_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Git source information
    git_url TEXT NOT NULL,
    git_host TEXT NOT NULL,
    repo_owner TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    subfolder TEXT,
    branch TEXT NOT NULL DEFAULT 'main',
    git_commit_sha TEXT,
    git_commit_message TEXT,
    git_committer TEXT,
    git_committed_at TIMESTAMPTZ,

    -- App information
    app_id TEXT NOT NULL,
    manifest JSONB NOT NULL,
    manifest_hash TEXT NOT NULL,

    -- Auto-detected assets (for review)
    assets_detected JSONB DEFAULT '{}',

    -- Build configuration (detected, not executed yet)
    build_config JSONB DEFAULT '{}',

    -- IMPORTANT: No auto-update, no auto-build
    status TEXT NOT NULL DEFAULT 'pending_review',
    -- pending_review, approved, building, build_failed, published, rejected, update_requested

    -- Review information
    submitted_by UUID REFERENCES auth.users(id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Build information (populated AFTER manual build)
    built_at TIMESTAMPTZ,
    built_by UUID REFERENCES auth.users(id),
    cdn_base_url TEXT,
    cdn_version_path TEXT,

    -- Version tracking (manual updates only)
    current_version TEXT,
    previous_version TEXT,

    -- Error tracking
    last_error TEXT,
    build_log TEXT,
    error_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT miniapp_submissions_app_id_key UNIQUE (app_id, git_url, subfolder)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_submissions_app_id ON miniapp_submissions(app_id);
CREATE INDEX IF NOT EXISTS idx_submissions_git_url ON miniapp_submissions(git_url, subfolder, branch);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON miniapp_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON miniapp_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_reviewed_by ON miniapp_submissions(reviewed_by) WHERE reviewed_by IS NOT NULL;

-- RLS Policies
ALTER TABLE miniapp_submissions ENABLE ROW LEVEL SECURITY;

-- Developers can see their own submissions
CREATE POLICY "Developers can view own submissions"
    ON miniapp_submissions
    FOR SELECT
    USING (auth.uid() = submitted_by);

-- Admins can do everything
CREATE POLICY "Admins can manage submissions"
    ON miniapp_submissions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admin_emails
            WHERE user_id = auth.uid()
        )
    );

-- Everyone can read published miniapps
CREATE POLICY "Everyone can read published submissions"
    ON miniapp_submissions
    FOR SELECT
    USING (status = 'published');
