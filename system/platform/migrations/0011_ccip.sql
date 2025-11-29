-- CCIP lanes and messages

CREATE TABLE IF NOT EXISTS app_ccip_lanes (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_chain TEXT NOT NULL,
    dest_chain TEXT NOT NULL,
    signer_set JSONB,
    allowed_tokens JSONB,
    delivery_policy JSONB,
    metadata JSONB,
    tags JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_ccip_lanes_account
    ON app_ccip_lanes (account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_ccip_messages (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    lane_id TEXT NOT NULL REFERENCES app_ccip_lanes(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    payload JSONB,
    token_transfers JSONB,
    trace JSONB,
    error TEXT,
    metadata JSONB,
    tags JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_ccip_messages_account
    ON app_ccip_messages (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_ccip_messages_lane
    ON app_ccip_messages (lane_id, created_at DESC);
