-- Core tables for accounts, functions, triggers

CREATE TABLE IF NOT EXISTS app_accounts (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS app_functions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    source TEXT NOT NULL,
    secrets JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_functions_account ON app_functions(account_id);

CREATE TABLE IF NOT EXISTS app_triggers (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    function_id TEXT NOT NULL REFERENCES app_functions(id) ON DELETE CASCADE,
    rule TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_triggers_account ON app_triggers(account_id);

