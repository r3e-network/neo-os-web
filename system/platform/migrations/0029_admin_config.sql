-- Admin Configuration Tables
-- Migration: 0029_admin_config.sql

-- Chain RPC endpoints for multi-chain support
CREATE TABLE IF NOT EXISTS admin_chain_rpcs (
    id              TEXT PRIMARY KEY,
    chain_id        TEXT NOT NULL,
    name            TEXT NOT NULL,
    rpc_url         TEXT NOT NULL,
    ws_url          TEXT DEFAULT '',
    chain_type      TEXT NOT NULL DEFAULT 'evm',
    network_id      BIGINT DEFAULT 0,
    priority        INT DEFAULT 0,
    weight          INT DEFAULT 1,
    max_rps         INT DEFAULT 0,
    timeout_ms      INT DEFAULT 30000,
    enabled         BOOLEAN DEFAULT TRUE,
    healthy         BOOLEAN DEFAULT TRUE,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    last_check_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_chain_rpcs_chain_id ON admin_chain_rpcs(chain_id);
CREATE INDEX IF NOT EXISTS idx_admin_chain_rpcs_enabled ON admin_chain_rpcs(enabled);
CREATE INDEX IF NOT EXISTS idx_admin_chain_rpcs_chain_type ON admin_chain_rpcs(chain_type);

-- Data providers for oracle, price feeds, etc.
CREATE TABLE IF NOT EXISTS admin_data_providers (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    type            TEXT NOT NULL,
    base_url        TEXT NOT NULL,
    api_key         TEXT DEFAULT '',
    rate_limit      INT DEFAULT 60,
    timeout_ms      INT DEFAULT 10000,
    retries         INT DEFAULT 3,
    enabled         BOOLEAN DEFAULT TRUE,
    healthy         BOOLEAN DEFAULT TRUE,
    features        TEXT[] DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    last_check_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_data_providers_type ON admin_data_providers(type);
CREATE INDEX IF NOT EXISTS idx_admin_data_providers_enabled ON admin_data_providers(enabled);

-- System settings key-value store
CREATE TABLE IF NOT EXISTS admin_settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    type            TEXT NOT NULL DEFAULT 'string',
    category        TEXT NOT NULL DEFAULT 'general',
    description     TEXT DEFAULT '',
    editable        BOOLEAN DEFAULT TRUE,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_by      TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_admin_settings_category ON admin_settings(category);

-- Feature flags
CREATE TABLE IF NOT EXISTS admin_feature_flags (
    key             TEXT PRIMARY KEY,
    enabled         BOOLEAN DEFAULT FALSE,
    description     TEXT DEFAULT '',
    rollout         INT DEFAULT 100,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_by      TEXT DEFAULT ''
);

-- Tenant quotas
CREATE TABLE IF NOT EXISTS admin_tenant_quotas (
    tenant_id       TEXT PRIMARY KEY,
    max_accounts    INT DEFAULT 10,
    max_functions   INT DEFAULT 100,
    max_rpc_per_min INT DEFAULT 1000,
    max_storage     BIGINT DEFAULT 1073741824,
    max_gas_per_day BIGINT DEFAULT 1000000000,
    features        TEXT[] DEFAULT '{}',
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_by      TEXT DEFAULT ''
);

-- Allowed RPC methods per chain
CREATE TABLE IF NOT EXISTS admin_allowed_methods (
    chain_id        TEXT PRIMARY KEY,
    methods         TEXT[] DEFAULT '{}',
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default system settings
INSERT INTO admin_settings (key, value, type, category, description, editable) VALUES
    ('system.maintenance_mode', 'false', 'bool', 'general', 'Enable maintenance mode', true),
    ('system.registration_enabled', 'true', 'bool', 'general', 'Allow new registrations', true),
    ('limits.max_request_size', '10485760', 'int', 'limits', 'Max request body size in bytes', true),
    ('limits.rate_limit_per_min', '100', 'int', 'limits', 'Default rate limit per minute', true),
    ('limits.max_concurrent_functions', '10', 'int', 'limits', 'Max concurrent function executions', true),
    ('security.require_2fa', 'false', 'bool', 'security', 'Require 2FA for all users', true),
    ('security.session_timeout_mins', '60', 'int', 'security', 'Session timeout in minutes', true),
    ('features.oracle_enabled', 'true', 'bool', 'features', 'Enable Oracle service', true),
    ('features.vrf_enabled', 'true', 'bool', 'features', 'Enable VRF service', true),
    ('features.automation_enabled', 'true', 'bool', 'features', 'Enable Automation service', true)
ON CONFLICT (key) DO NOTHING;

-- Insert default feature flags
INSERT INTO admin_feature_flags (key, enabled, description, rollout) VALUES
    ('new_dashboard', false, 'Enable new dashboard UI', 0),
    ('advanced_analytics', false, 'Enable advanced analytics features', 0),
    ('multi_chain', true, 'Enable multi-chain support', 100),
    ('websocket_streams', true, 'Enable WebSocket data streams', 100)
ON CONFLICT (key) DO NOTHING;
