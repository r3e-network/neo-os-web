-- Chainlink CRE playbooks, runs, and executors

CREATE TABLE IF NOT EXISTS app_cre_playbooks (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    steps JSONB NOT NULL,
    tags JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_cre_playbooks_account
    ON app_cre_playbooks (account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_cre_executors (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    metadata JSONB,
    tags JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_cre_executors_account
    ON app_cre_executors (account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_cre_runs (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    playbook_id TEXT NOT NULL REFERENCES app_cre_playbooks(id) ON DELETE CASCADE,
    executor_id TEXT REFERENCES app_cre_executors(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    parameters JSONB,
    tags JSONB,
    results JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_cre_runs_account
    ON app_cre_runs (account_id, created_at DESC);
