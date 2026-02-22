-- =============================================================================
-- Template marketplace metadata (frontend + contract templates)
-- =============================================================================

CREATE TABLE IF NOT EXISTS miniapp_frontend_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id TEXT NOT NULL,
    version TEXT NOT NULL,
    owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'utility',
    schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    ui_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    source_type TEXT NOT NULL DEFAULT 'community' CHECK (source_type IN ('builtin', 'community', 'verified')),
    tags TEXT[] NOT NULL DEFAULT '{}'::text[],
    usage_count BIGINT NOT NULL DEFAULT 0,
    rating_avg NUMERIC(5,2),
    rating_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_frontend_templates_active
    ON miniapp_frontend_templates (is_active, category, updated_at DESC);

CREATE TABLE IF NOT EXISTS miniapp_contract_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id TEXT NOT NULL,
    version TEXT NOT NULL,
    owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'utility',
    schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    ui_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    deploy_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
    factory_template_ref TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    source_type TEXT NOT NULL DEFAULT 'community' CHECK (source_type IN ('builtin', 'community', 'verified')),
    tags TEXT[] NOT NULL DEFAULT '{}'::text[],
    usage_count BIGINT NOT NULL DEFAULT 0,
    rating_avg NUMERIC(5,2),
    rating_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_contract_templates_active
    ON miniapp_contract_templates (is_active, category, updated_at DESC);

CREATE TABLE IF NOT EXISTS miniapp_template_publish_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_kind TEXT NOT NULL CHECK (template_kind IN ('frontend', 'contract')),
    template_row_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    requested_by TEXT NOT NULL,
    reviewed_by TEXT,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_template_publish_requests_status
    ON miniapp_template_publish_requests (status, created_at DESC);

ALTER TABLE miniapp_frontend_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE miniapp_contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE miniapp_template_publish_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_all_frontend_templates
    ON miniapp_frontend_templates FOR ALL TO service_role
    USING (true);

CREATE POLICY service_all_contract_templates
    ON miniapp_contract_templates FOR ALL TO service_role
    USING (true);

CREATE POLICY service_all_template_publish_requests
    ON miniapp_template_publish_requests FOR ALL TO service_role
    USING (true);
