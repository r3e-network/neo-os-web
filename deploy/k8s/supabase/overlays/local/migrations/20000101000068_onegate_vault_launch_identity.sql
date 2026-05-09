-- =============================================================================
-- OneGate Vault launch identity hardening
-- =============================================================================
-- Stores the OneGate launch id and claim-key id on the server, then requires
-- scanned QR parameters to match before a key can reserve a GAS payout.

BEGIN;

ALTER TABLE public.onegate_vault_campaigns
  ADD COLUMN IF NOT EXISTS onegate_app_id TEXT;

ALTER TABLE public.onegate_vault_claim_keys
  ADD COLUMN IF NOT EXISTS claim_key_id TEXT,
  ADD COLUMN IF NOT EXISTS onegate_app_id TEXT;

ALTER TABLE public.onegate_vault_campaigns
  ALTER COLUMN app_id SET DEFAULT 'miniapp-gas-lucky-pool';

ALTER TABLE public.onegate_vault_campaigns
  DROP CONSTRAINT IF EXISTS onegate_vault_campaigns_onegate_app_id_safe;

ALTER TABLE public.onegate_vault_campaigns
  ADD CONSTRAINT onegate_vault_campaigns_onegate_app_id_safe
    CHECK (onegate_app_id IS NULL OR onegate_app_id ~ '^[A-Za-z0-9_.:-]{1,128}$');

ALTER TABLE public.onegate_vault_claim_keys
  DROP CONSTRAINT IF EXISTS onegate_vault_claim_keys_claim_key_id_safe,
  DROP CONSTRAINT IF EXISTS onegate_vault_claim_keys_onegate_app_id_safe;

ALTER TABLE public.onegate_vault_claim_keys
  ADD CONSTRAINT onegate_vault_claim_keys_claim_key_id_safe
    CHECK (claim_key_id IS NULL OR claim_key_id ~ '^[A-Za-z0-9_.:-]{1,128}$'),
  ADD CONSTRAINT onegate_vault_claim_keys_onegate_app_id_safe
    CHECK (onegate_app_id IS NULL OR onegate_app_id ~ '^[A-Za-z0-9_.:-]{1,128}$');

CREATE INDEX IF NOT EXISTS idx_onegate_vault_campaigns_onegate_app
  ON public.onegate_vault_campaigns (network, onegate_app_id, created_at DESC)
  WHERE onegate_app_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_onegate_vault_claim_keys_campaign_claim_key_id
  ON public.onegate_vault_claim_keys (campaign_id, claim_key_id)
  WHERE claim_key_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_onegate_vault_claim_keys_onegate_app
  ON public.onegate_vault_claim_keys (network, onegate_app_id, created_at DESC)
  WHERE onegate_app_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.onegate_vault_reserve_claim(
  p_key_hash TEXT,
  p_wallet_address TEXT,
  p_network TEXT,
  p_request_id TEXT,
  p_random_u64 NUMERIC DEFAULT NULL,
  p_pool_id TEXT DEFAULT NULL,
  p_onegate_app_id TEXT DEFAULT NULL,
  p_app_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  key_hash TEXT,
  campaign_id TEXT,
  network TEXT,
  status TEXT,
  wallet_address TEXT,
  amount_fixed8 TEXT,
  tx_hash TEXT,
  request_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key public.onegate_vault_claim_keys%ROWTYPE;
  v_campaign public.onegate_vault_campaigns%ROWTYPE;
  v_capped_max NUMERIC(39, 0);
  v_span NUMERIC(39, 0);
  v_random NUMERIC(39, 0);
  v_amount NUMERIC(39, 0);
  v_pool_id TEXT;
  v_onegate_app_id TEXT;
  v_app_id TEXT;
  v_expected_onegate_app_id TEXT;
BEGIN
  v_pool_id := NULLIF(pg_catalog.btrim(COALESCE(p_pool_id, '')), '');
  v_onegate_app_id := NULLIF(pg_catalog.btrim(COALESCE(p_onegate_app_id, '')), '');
  v_app_id := NULLIF(pg_catalog.btrim(COALESCE(p_app_id, '')), '');

  IF p_network NOT IN ('mainnet', 'testnet') THEN
    RAISE EXCEPTION 'INVALID_NETWORK';
  END IF;

  IF v_pool_id IS NOT NULL AND v_pool_id !~ '^[A-Za-z0-9_.:-]{1,128}$' THEN
    RAISE EXCEPTION 'INVALID_POOL_ID';
  END IF;

  IF v_onegate_app_id IS NOT NULL AND v_onegate_app_id !~ '^[A-Za-z0-9_.:-]{1,128}$' THEN
    RAISE EXCEPTION 'INVALID_ONEGATE_APP_ID';
  END IF;

  IF v_app_id IS NOT NULL AND v_app_id !~ '^[A-Za-z0-9_.:-]{1,128}$' THEN
    RAISE EXCEPTION 'INVALID_APP_ID';
  END IF;

  IF p_wallet_address IS NULL OR pg_catalog.length(pg_catalog.btrim(p_wallet_address)) < 20 THEN
    RAISE EXCEPTION 'INVALID_ADDRESS';
  END IF;

  SELECT *
    INTO v_key
    FROM public.onegate_vault_claim_keys
   WHERE onegate_vault_claim_keys.key_hash = p_key_hash
     AND onegate_vault_claim_keys.network = p_network
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CLAIM_KEY_NOT_FOUND';
  END IF;

  IF v_pool_id IS NOT NULL AND v_key.campaign_id <> v_pool_id THEN
    RAISE EXCEPTION 'POOL_MISMATCH';
  END IF;

  IF v_key.wallet_address IS NOT NULL AND v_key.wallet_address <> p_wallet_address THEN
    RAISE EXCEPTION 'CLAIM_KEY_USED';
  END IF;

  SELECT *
    INTO v_campaign
    FROM public.onegate_vault_campaigns
   WHERE onegate_vault_campaigns.id = v_key.campaign_id
     AND onegate_vault_campaigns.network = p_network
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VAULT_NOT_FOUND';
  END IF;

  IF v_app_id IS NOT NULL AND v_campaign.app_id <> v_app_id THEN
    RAISE EXCEPTION 'APP_ID_MISMATCH';
  END IF;

  v_expected_onegate_app_id := NULLIF(v_key.onegate_app_id, '');
  IF v_expected_onegate_app_id IS NULL THEN
    v_expected_onegate_app_id := NULLIF(v_campaign.onegate_app_id, '');
  END IF;

  IF v_expected_onegate_app_id IS NOT NULL AND v_onegate_app_id IS NULL THEN
    RAISE EXCEPTION 'ONEGATE_APP_ID_REQUIRED';
  END IF;

  IF v_expected_onegate_app_id IS NOT NULL
     AND v_onegate_app_id IS NOT NULL
     AND v_expected_onegate_app_id <> v_onegate_app_id THEN
    RAISE EXCEPTION 'ONEGATE_APP_ID_MISMATCH';
  END IF;

  IF v_key.wallet_address = p_wallet_address
     AND v_key.amount_fixed8 IS NOT NULL
     AND v_key.request_id IS NOT NULL THEN
    RETURN QUERY
      SELECT
        v_key.key_hash,
        v_key.campaign_id,
        v_key.network,
        v_key.status,
        v_key.wallet_address,
        v_key.amount_fixed8::TEXT,
        v_key.tx_hash,
        v_key.request_id;
    RETURN;
  END IF;

  IF v_campaign.status <> 'active' THEN
    RAISE EXCEPTION 'VAULT_INACTIVE';
  END IF;

  IF v_campaign.expires_at IS NOT NULL AND v_campaign.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'VAULT_EXPIRED';
  END IF;

  IF v_campaign.claimed_count >= v_campaign.max_claims
     OR v_campaign.remaining_amount_fixed8 < v_campaign.min_amount_fixed8 THEN
    RAISE EXCEPTION 'VAULT_EMPTY';
  END IF;

  IF v_campaign.min_amount_fixed8 < 100000000
     OR v_campaign.max_amount_fixed8 > 5000000000
     OR v_campaign.min_amount_fixed8 > v_campaign.max_amount_fixed8 THEN
    RAISE EXCEPTION 'INVALID_REWARD_RANGE';
  END IF;

  v_capped_max := LEAST(v_campaign.max_amount_fixed8, v_campaign.remaining_amount_fixed8);
  v_span := v_capped_max - v_campaign.min_amount_fixed8 + 1;
  IF v_span <= 0 THEN
    RAISE EXCEPTION 'VAULT_EMPTY';
  END IF;

  IF p_random_u64 IS NULL OR p_random_u64 < 0 THEN
    v_random := pg_catalog.floor(pg_catalog.random() * 9223372036854775807)::NUMERIC;
  ELSE
    v_random := pg_catalog.floor(p_random_u64);
  END IF;
  v_amount := v_campaign.min_amount_fixed8 + pg_catalog.mod(v_random, v_span);

  UPDATE public.onegate_vault_campaigns
     SET remaining_amount_fixed8 = remaining_amount_fixed8 - v_amount,
         claimed_count = claimed_count + 1,
         updated_at = pg_catalog.now()
   WHERE id = v_campaign.id;

  UPDATE public.onegate_vault_claim_keys
     SET status = 'pending',
         wallet_address = p_wallet_address,
         amount_fixed8 = v_amount,
         request_id = p_request_id,
         error_message = NULL,
         claimed_at = pg_catalog.now(),
         failed_at = NULL
   WHERE onegate_vault_claim_keys.key_hash = p_key_hash
   RETURNING *
    INTO v_key;

  RETURN QUERY
    SELECT
      v_key.key_hash,
      v_key.campaign_id,
      v_key.network,
      v_key.status,
      v_key.wallet_address,
      v_key.amount_fixed8::TEXT,
      v_key.tx_hash,
      v_key.request_id;
END;
$$;

REVOKE ALL ON FUNCTION private.onegate_vault_reserve_claim(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.onegate_vault_reserve_claim(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.onegate_vault_reserve_claim(
  p_key_hash TEXT,
  p_wallet_address TEXT,
  p_network TEXT,
  p_request_id TEXT
)
RETURNS TABLE (
  key_hash TEXT,
  campaign_id TEXT,
  network TEXT,
  status TEXT,
  wallet_address TEXT,
  amount_fixed8 TEXT,
  tx_hash TEXT,
  request_id TEXT
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT *
    FROM private.onegate_vault_reserve_claim(
      p_key_hash,
      p_wallet_address,
      p_network,
      p_request_id,
      NULL::NUMERIC,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT
    );
$$;

CREATE OR REPLACE FUNCTION public.onegate_vault_reserve_claim_v2(
  p_key_hash TEXT,
  p_wallet_address TEXT,
  p_network TEXT,
  p_request_id TEXT,
  p_random_u64 TEXT
)
RETURNS TABLE (
  key_hash TEXT,
  campaign_id TEXT,
  network TEXT,
  status TEXT,
  wallet_address TEXT,
  amount_fixed8 TEXT,
  tx_hash TEXT,
  request_id TEXT
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT *
    FROM private.onegate_vault_reserve_claim(
      p_key_hash,
      p_wallet_address,
      p_network,
      p_request_id,
      NULLIF(p_random_u64, '')::NUMERIC,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT
    );
$$;

CREATE OR REPLACE FUNCTION public.onegate_vault_reserve_claim_v3(
  p_key_hash TEXT,
  p_wallet_address TEXT,
  p_network TEXT,
  p_request_id TEXT,
  p_random_u64 TEXT,
  p_pool_id TEXT DEFAULT NULL,
  p_onegate_app_id TEXT DEFAULT NULL,
  p_app_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  key_hash TEXT,
  campaign_id TEXT,
  network TEXT,
  status TEXT,
  wallet_address TEXT,
  amount_fixed8 TEXT,
  tx_hash TEXT,
  request_id TEXT
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT *
    FROM private.onegate_vault_reserve_claim(
      p_key_hash,
      p_wallet_address,
      p_network,
      p_request_id,
      NULLIF(p_random_u64, '')::NUMERIC,
      p_pool_id,
      p_onegate_app_id,
      p_app_id
    );
$$;

REVOKE ALL ON FUNCTION public.onegate_vault_reserve_claim(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.onegate_vault_reserve_claim_v2(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.onegate_vault_reserve_claim_v3(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.onegate_vault_reserve_claim(TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.onegate_vault_reserve_claim_v2(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.onegate_vault_reserve_claim_v3(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMIT;
