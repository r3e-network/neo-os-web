-- =============================================================================
-- Multi-Chain Accounts Migration
-- Supports storing encrypted accounts for Neo N3 only
-- =============================================================================

-- =============================================================================
-- Multi-Chain Accounts Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS multichain_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Auth0 user identifier
    auth0_sub TEXT NOT NULL,
    -- Chain identification
    chain_id TEXT NOT NULL,
    chain_type TEXT NOT NULL CHECK (chain_type IN ('neo-n3')),
    -- Account information
    address TEXT NOT NULL,
    public_key TEXT NOT NULL,
    -- Encrypted private key (encrypted in browser before storage)
    encrypted_private_key TEXT NOT NULL,
    encryption_salt TEXT NOT NULL,
    -- Key derivation parameters (iv, tag, iterations as JSON)
    key_derivation_params JSONB NOT NULL,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Constraints
    UNIQUE(auth0_sub, chain_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_multichain_accounts_auth0_sub
    ON multichain_accounts(auth0_sub);
CREATE INDEX IF NOT EXISTS idx_multichain_accounts_chain_id
    ON multichain_accounts(chain_id);
CREATE INDEX IF NOT EXISTS idx_multichain_accounts_chain_type
    ON multichain_accounts(chain_type);
CREATE INDEX IF NOT EXISTS idx_multichain_accounts_address
    ON multichain_accounts(address);

-- =============================================================================
-- Row Level Security
-- =============================================================================
ALTER TABLE multichain_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$
BEGIN
    DROP POLICY IF EXISTS service_all ON multichain_accounts;
    DROP POLICY IF EXISTS user_own_accounts ON multichain_accounts;
EXCEPTION WHEN undefined_object THEN
    NULL;
END $$;

-- Service role can do everything
CREATE POLICY service_all ON multichain_accounts
    FOR ALL TO service_role USING (true);

-- Users can only access their own accounts (via auth0_sub)
CREATE POLICY user_own_accounts ON multichain_accounts
    FOR ALL TO authenticated
    USING (auth0_sub = current_setting('request.jwt.claims', true)::json->>'sub');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON multichain_accounts TO authenticated;
GRANT ALL ON multichain_accounts TO service_role;

-- =============================================================================
-- Updated At Trigger
-- =============================================================================
CREATE OR REPLACE FUNCTION update_multichain_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_multichain_accounts_updated_at ON multichain_accounts;
CREATE TRIGGER trigger_multichain_accounts_updated_at
    BEFORE UPDATE ON multichain_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_multichain_accounts_updated_at();
