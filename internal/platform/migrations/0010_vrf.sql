-- Chainlink VRF keys and requests

CREATE TABLE IF NOT EXISTS app_vrf_keys (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL,
    label TEXT,
    status TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    attestation TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_vrf_keys_account
    ON app_vrf_keys (account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_vrf_requests (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    key_id TEXT NOT NULL REFERENCES app_vrf_keys(id) ON DELETE CASCADE,
    consumer TEXT NOT NULL,
    seed TEXT NOT NULL,
    status TEXT NOT NULL,
    result TEXT,
    error TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_vrf_requests_account
    ON app_vrf_requests (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_vrf_requests_key
    ON app_vrf_requests (key_id, created_at DESC);
