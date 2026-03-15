-- Add columns for storing pre-generated account keys
-- This enables batch account generation instead of HD derivation

-- Add public_key column (compressed, 33 bytes hex = 66 chars)
ALTER TABLE public.pool_accounts
ADD COLUMN IF NOT EXISTS public_key text;

-- Add encrypted_wif column (WIF encrypted with service key)
ALTER TABLE public.pool_accounts
ADD COLUMN IF NOT EXISTS encrypted_wif text;

-- Add key_version for future key rotation support
ALTER TABLE public.pool_accounts
ADD COLUMN IF NOT EXISTS key_version integer DEFAULT 1;

-- Add generation_batch to track which batch the account was created in
ALTER TABLE public.pool_accounts
ADD COLUMN IF NOT EXISTS generation_batch text;

-- Index for finding accounts without stored keys (legacy HD accounts)
CREATE INDEX IF NOT EXISTS pool_accounts_encrypted_wif_null_idx
ON public.pool_accounts (encrypted_wif) WHERE encrypted_wif IS NULL;

-- Index for batch tracking
CREATE INDEX IF NOT EXISTS pool_accounts_generation_batch_idx
ON public.pool_accounts (generation_batch);

COMMENT ON COLUMN public.pool_accounts.public_key IS 'Compressed public key (hex, 66 chars)';
COMMENT ON COLUMN public.pool_accounts.encrypted_wif IS 'AES-256-GCM encrypted WIF using POOL_ENCRYPTION_KEY';
COMMENT ON COLUMN public.pool_accounts.key_version IS 'Encryption key version for rotation support';
COMMENT ON COLUMN public.pool_accounts.generation_batch IS 'Batch ID for tracking account generation runs';
