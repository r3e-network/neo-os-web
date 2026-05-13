-- =============================================================================
-- OneGate Vault runtime diagnostics
-- =============================================================================
-- The claim page records sanitized scan/runtime failures so iOS/Android bridge
-- differences can be analyzed from the database without exposing QR keys,
-- wallet addresses, WIFs, tokens, or full claim URLs.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.onegate_vault_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('missing_address', 'claim_error', 'scan_open', 'status_error')),
  network TEXT NOT NULL CHECK (network IN ('mainnet', 'testnet')),
  app_id TEXT NOT NULL DEFAULT 'miniapp-gas-lucky-pool',
  onegate_app_id TEXT,
  pool_id TEXT,
  source TEXT NOT NULL DEFAULT 'unknown',
  operation TEXT NOT NULL DEFAULT 'unknown',
  platform TEXT NOT NULL DEFAULT 'other',
  locale TEXT,
  user_agent TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  diagnostic TEXT NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onegate_vault_diagnostics_created
  ON public.onegate_vault_diagnostics (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_onegate_vault_diagnostics_network_created
  ON public.onegate_vault_diagnostics (network, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_onegate_vault_diagnostics_fingerprint_created
  ON public.onegate_vault_diagnostics (fingerprint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_onegate_vault_diagnostics_platform_created
  ON public.onegate_vault_diagnostics (platform, created_at DESC);

ALTER TABLE public.onegate_vault_diagnostics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS onegate_vault_diagnostics_service_role_all
  ON public.onegate_vault_diagnostics;

CREATE POLICY onegate_vault_diagnostics_service_role_all
  ON public.onegate_vault_diagnostics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
