-- Gas bank enhancements: thresholds, approvals, scheduling metadata.

ALTER TABLE app_gas_accounts
    ADD COLUMN IF NOT EXISTS locked DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS min_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS daily_limit DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS notification_threshold DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS required_approvals INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS flags JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE app_gas_transactions
    ADD COLUMN IF NOT EXISTS schedule_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cron_expression TEXT,
    ADD COLUMN IF NOT EXISTS approval_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS resolver_attempt INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resolver_error TEXT,
    ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS app_gas_withdrawal_approvals (
    transaction_id TEXT NOT NULL REFERENCES app_gas_transactions(id) ON DELETE CASCADE,
    approver TEXT NOT NULL,
    status TEXT NOT NULL,
    signature TEXT,
    note TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (transaction_id, approver)
);

CREATE TABLE IF NOT EXISTS app_gas_withdrawal_schedules (
    transaction_id TEXT PRIMARY KEY REFERENCES app_gas_transactions(id) ON DELETE CASCADE,
    schedule_at TIMESTAMPTZ,
    cron_expression TEXT,
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS app_gas_settlement_attempts (
    transaction_id TEXT NOT NULL REFERENCES app_gas_transactions(id) ON DELETE CASCADE,
    attempt INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    latency_ms BIGINT,
    status TEXT,
    error TEXT,
    PRIMARY KEY (transaction_id, attempt)
);

CREATE TABLE IF NOT EXISTS app_gas_dead_letters (
    transaction_id TEXT PRIMARY KEY REFERENCES app_gas_transactions(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES app_gas_accounts(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    last_error TEXT,
    last_attempt_at TIMESTAMPTZ,
    retries INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
