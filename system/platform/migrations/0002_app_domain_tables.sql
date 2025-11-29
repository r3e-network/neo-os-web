-- Additional domain tables for automation, price feeds, and oracle services

CREATE TABLE IF NOT EXISTS app_automation_jobs (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    function_id TEXT NOT NULL REFERENCES app_functions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    schedule TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_automation_jobs_account_name
    ON app_automation_jobs (account_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_app_automation_jobs_account
    ON app_automation_jobs (account_id);

CREATE TABLE IF NOT EXISTS app_price_feeds (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    base_asset TEXT NOT NULL,
    quote_asset TEXT NOT NULL,
    pair TEXT NOT NULL,
    update_interval TEXT NOT NULL,
    deviation_percent DOUBLE PRECISION NOT NULL,
    heartbeat_interval TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_price_feeds_account_pair
    ON app_price_feeds (account_id, pair);

CREATE INDEX IF NOT EXISTS idx_app_price_feeds_account
    ON app_price_feeds (account_id);

CREATE TABLE IF NOT EXISTS app_price_feed_snapshots (
    id TEXT PRIMARY KEY,
    feed_id TEXT NOT NULL REFERENCES app_price_feeds(id) ON DELETE CASCADE,
    price DOUBLE PRECISION NOT NULL,
    source TEXT NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_price_feed_snapshots_feed
    ON app_price_feed_snapshots (feed_id, collected_at DESC);

CREATE TABLE IF NOT EXISTS app_oracle_sources (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    method TEXT NOT NULL,
    headers JSONB,
    body TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_oracle_sources_account_name
    ON app_oracle_sources (account_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_app_oracle_sources_account
    ON app_oracle_sources (account_id);

CREATE TABLE IF NOT EXISTS app_oracle_requests (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    data_source_id TEXT NOT NULL REFERENCES app_oracle_sources(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    payload TEXT,
    result TEXT,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_oracle_requests_account
    ON app_oracle_requests (account_id, created_at DESC);

