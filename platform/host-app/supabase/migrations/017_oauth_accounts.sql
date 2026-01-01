-- Migration: OAuth Accounts and Encrypted Keys
-- Description: Store OAuth account bindings, encrypted private keys, and developer tokens

-- OAuth Accounts Table
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'twitter', 'github')),
    provider_user_id TEXT NOT NULL,
    email TEXT,
    name TEXT,
    avatar TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address, provider),
    UNIQUE(provider, provider_user_id)
);

-- Encrypted Private Keys Table (for OAuth users)
CREATE TABLE IF NOT EXISTS encrypted_keys (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    encryption_salt TEXT NOT NULL,
    key_derivation_params JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Secrets Table (for MiniApp development)
CREATE TABLE IF NOT EXISTS user_secrets (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    secret_name TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address, secret_name)
);

-- Developer API Tokens Table
CREATE TABLE IF NOT EXISTS developer_tokens (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    token_prefix TEXT NOT NULL,
    name TEXT NOT NULL,
    scopes JSONB DEFAULT '["read"]',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_oauth_wallet ON oauth_accounts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_oauth_provider ON oauth_accounts(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_encrypted_keys_wallet ON encrypted_keys(wallet_address);
CREATE INDEX IF NOT EXISTS idx_secrets_wallet ON user_secrets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_tokens_wallet ON developer_tokens(wallet_address);
CREATE INDEX IF NOT EXISTS idx_tokens_hash ON developer_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_tokens_active ON developer_tokens(wallet_address, revoked_at) WHERE revoked_at IS NULL;

-- Enable RLS
ALTER TABLE oauth_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE encrypted_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own OAuth accounts" ON oauth_accounts FOR ALL USING (true);
CREATE POLICY "Users can manage own encrypted keys" ON encrypted_keys FOR ALL USING (true);
CREATE POLICY "Users can manage own secrets" ON user_secrets FOR ALL USING (true);
CREATE POLICY "Users can manage own tokens" ON developer_tokens FOR ALL USING (true);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_oauth_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_encrypted_keys_timestamp
BEFORE UPDATE ON encrypted_keys
FOR EACH ROW EXECUTE FUNCTION update_oauth_timestamp();

CREATE TRIGGER trigger_update_secrets_timestamp
BEFORE UPDATE ON user_secrets
FOR EACH ROW EXECUTE FUNCTION update_oauth_timestamp();
