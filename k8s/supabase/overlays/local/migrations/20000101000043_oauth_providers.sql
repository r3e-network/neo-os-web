-- OAuth identity providers and custodial wallet support
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_type text NOT NULL DEFAULT 'external' CHECK (wallet_type IN ('external','custodial'));
ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS wallet_type text NOT NULL DEFAULT 'external' CHECK (wallet_type IN ('external','custodial'));

CREATE TABLE IF NOT EXISTS oauth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_identities_user_id ON oauth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_identities_email ON oauth_identities(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oauth_identities_provider ON oauth_identities(provider, provider_user_id);

ALTER TABLE oauth_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS service_all ON oauth_identities FOR ALL TO service_role USING (true);
