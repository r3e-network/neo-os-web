-- =============================================================================
-- Distributed MiniApp System - Database Setup for Supabase
-- =============================================================================
--
-- This file contains all the SQL commands needed to set up the database
-- for the distributed MiniApp system. Execute this in the Supabase SQL Editor.
--
-- Instructions:
-- 1. Go to https://supabase.com/dashboard/project/dmonstzalbldzzdbbcdj
-- 2. Click on "SQL Editor" in the left sidebar
-- 3. Copy and execute each section below in order
--
-- =============================================================================

-- =============================================================================
-- SECTION 1: Admin Emails Table (Required for Edge Functions)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_emails (
    user_id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'moderator')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage admin emails"
    ON public.admin_emails
    FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Admins can view all admin emails"
    ON public.admin_emails
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_emails
            WHERE user_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, UPDATE ON public.admin_emails TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.admin_emails_user_id_seq TO authenticated;


-- =============================================================================
-- SECTION 2: MiniApp Submissions Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.miniapp_submissions (
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
            SELECT 1 FROM public.admin_emails
            WHERE user_id = auth.uid()
        )
    );

-- Everyone can read published miniapps
CREATE POLICY "Everyone can read published submissions"
    ON miniapp_submissions
    FOR SELECT
    USING (status = 'published');


-- =============================================================================
-- SECTION 3: MiniApp Internal Table (Pre-built Apps)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.miniapp_internal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Git source (for reference)
    git_url TEXT NOT NULL,
    subfolder TEXT NOT NULL,
    branch TEXT NOT NULL DEFAULT 'master',

    -- App identification
    app_id TEXT NOT NULL UNIQUE,

    -- Manifest information
    manifest JSONB NOT NULL,
    manifest_hash TEXT NOT NULL,

    -- Pre-built URLs
    entry_url TEXT NOT NULL,
    icon_url TEXT,
    banner_url TEXT,

    -- Categorization
    category TEXT NOT NULL DEFAULT 'uncategorized',

    -- Version tracking
    current_version TEXT NOT NULL,
    previous_version TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_app_id ON miniapp_internal(app_id);
CREATE INDEX IF NOT EXISTS idx_internal_status ON miniapp_internal(status);
CREATE INDEX IF NOT EXISTS idx_internal_category ON miniapp_internal(category);

-- RLS Policies
ALTER TABLE miniapp_internal ENABLE ROW LEVEL SECURITY;

-- Public read access for active apps
CREATE POLICY "Public can read active internal miniapps"
    ON miniapp_internal
    FOR SELECT
    TO authenticated
    USING (status = 'active');

-- Service role can manage
CREATE POLICY "Service role can manage internal miniapps"
    ON miniapp_internal
    FOR ALL
    TO service_role
    USING (true);


-- =============================================================================
-- SECTION 4: Unified Registry View
-- =============================================================================

CREATE OR REPLACE VIEW miniapp_registry_view AS
SELECT
    'external' AS source_type,
    s.app_id,
    s.manifest->>'name' AS name,
    s.manifest->>'name_zh' AS name_zh,
    s.manifest->>'description' AS description,
    s.manifest->>'description_zh' AS description_zh,
    s.manifest->>'category' AS category,
    s.manifest->>'permissions' AS permissions,
    s.status,
    s.cdn_base_url,
    s.cdn_version_path AS version_path,
    s.assets_selected->>'icon' AS icon_url,
    s.assets_selected->>'banner' AS banner_url,
    s.manifest->>'entry_url' AS entry_url,
    s.git_url AS source_url,
    s.current_version AS version,
    s.updated_at
FROM miniapp_submissions s
WHERE s.status = 'published'

UNION ALL

SELECT
    'internal' AS source_type,
    i.app_id,
    i.manifest->>'name' AS name,
    i.manifest->>'name_zh' AS name_zh,
    i.manifest->>'description' AS description,
    i.manifest->>'description_zh' AS description_zh,
    i.category,
    i.manifest->>'permissions' AS permissions,
    i.status,
    i.entry_url AS cdn_base_url,
    i.current_version AS version_path,
    i.icon_url,
    i.banner_url,
    i.entry_url AS entry_url,
    i.git_url AS source_url,
    i.current_version AS version,
    i.updated_at
FROM miniapp_internal i
WHERE i.status = 'active';


-- =============================================================================
-- SECTION 5: Approval Audit Table (Optional)
-- =============================================================================

-- Note: This table references miniapp_registry which doesn't exist.
-- For now, we'll use a simpler audit table without foreign key constraints.

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


-- =============================================================================
-- Verification Queries
-- =============================================================================

-- Run these after setup to verify everything is working:

-- Check admin emails
-- SELECT * FROM public.admin_emails;

-- Check submissions
-- SELECT app_id, status, git_url FROM public.miniapp_submissions ORDER BY created_at DESC;

-- Check internal miniapps
-- SELECT app_id, status, category FROM public.miniapp_internal ORDER BY app_id;

-- Check unified registry
-- SELECT source_type, app_id, status FROM miniapp_registry_view ORDER BY app_id;

-- Check audit log
-- SELECT * FROM public.miniapp_approval_audit ORDER BY created_at DESC;
