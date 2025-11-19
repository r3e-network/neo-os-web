-- Workspace wallets for signer/approval policies

CREATE TABLE IF NOT EXISTS workspace_wallets (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    label TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_wallets_workspace_wallet
    ON workspace_wallets (workspace_id, lower(wallet_address));

CREATE INDEX IF NOT EXISTS idx_workspace_wallets_workspace
    ON workspace_wallets (workspace_id);
