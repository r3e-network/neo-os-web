-- =============================================================================
-- OneGate Vault reserve RPC LEAST expression fix
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION private.onegate_vault_reserve_claim(
  p_key_hash TEXT,
  p_wallet_address TEXT,
  p_network TEXT,
  p_request_id TEXT,
  p_random_u64 NUMERIC DEFAULT NULL
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
BEGIN
  IF p_network NOT IN ('mainnet', 'testnet') THEN
    RAISE EXCEPTION 'INVALID_NETWORK';
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

  IF v_key.wallet_address IS NOT NULL AND v_key.wallet_address <> p_wallet_address THEN
    RAISE EXCEPTION 'CLAIM_KEY_USED';
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

  SELECT *
    INTO v_campaign
    FROM public.onegate_vault_campaigns
   WHERE onegate_vault_campaigns.id = v_key.campaign_id
     AND onegate_vault_campaigns.network = p_network
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VAULT_NOT_FOUND';
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

REVOKE ALL ON FUNCTION private.onegate_vault_reserve_claim(TEXT, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.onegate_vault_reserve_claim(TEXT, TEXT, TEXT, TEXT, NUMERIC) TO service_role;

COMMIT;
