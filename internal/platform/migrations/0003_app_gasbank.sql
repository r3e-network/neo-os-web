-- Gas bank tables for accounts and transactions

CREATE TABLE IF NOT EXISTS app_gas_accounts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    wallet_address TEXT,
    balance DOUBLE PRECISION NOT NULL DEFAULT 0,
    available DOUBLE PRECISION NOT NULL DEFAULT 0,
    pending DOUBLE PRECISION NOT NULL DEFAULT 0,
    daily_withdrawal DOUBLE PRECISION NOT NULL DEFAULT 0,
    last_withdrawal TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_gas_accounts_wallet_lower
    ON app_gas_accounts ((lower(wallet_address)))
    WHERE wallet_address IS NOT NULL AND wallet_address <> '';

CREATE INDEX IF NOT EXISTS idx_app_gas_accounts_account
    ON app_gas_accounts (account_id);

CREATE TABLE IF NOT EXISTS app_gas_transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES app_gas_accounts(id) ON DELETE CASCADE,
    user_account_id TEXT,
    type TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    net_amount DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL,
    blockchain_tx_id TEXT,
    from_address TEXT,
    to_address TEXT,
    notes TEXT,
    error TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_gas_transactions_account
    ON app_gas_transactions (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_gas_transactions_pending
    ON app_gas_transactions (status)
    WHERE type = 'withdrawal';
