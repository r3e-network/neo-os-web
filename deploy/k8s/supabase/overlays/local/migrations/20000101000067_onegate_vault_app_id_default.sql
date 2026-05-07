-- =============================================================================
-- OneGate Vault app id default
-- =============================================================================

BEGIN;

ALTER TABLE public.onegate_vault_campaigns
  ALTER COLUMN app_id SET DEFAULT 'miniapp-onegate-vault';

COMMIT;
