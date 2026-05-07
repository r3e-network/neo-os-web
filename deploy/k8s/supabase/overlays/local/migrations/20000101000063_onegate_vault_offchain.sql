-- =============================================================================
-- OneGate Vault off-chain claim-key reward backend
-- =============================================================================
-- The public dApp now receives a one-time claim key from OneGate QR params.
-- Raw keys are never stored; only a peppered hash is recorded. The reservation
-- RPC atomically binds the key to the first claiming wallet and reserves a GAS
-- payout amount before the server-side tx proxy transfers GAS.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.onegate_vault_campaigns (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'miniapp-gas-lucky-pool',
  network TEXT NOT NULL CHECK (network IN ('mainnet', 'testnet')),
  creator_address TEXT,
  reward_source TEXT NOT NULL DEFAULT 'PLATFORM_SPONSOR',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired')),
  min_amount_fixed8 NUMERIC(39, 0) NOT NULL DEFAULT 100000000 CHECK (min_amount_fixed8 >= 100000000),
  max_amount_fixed8 NUMERIC(39, 0) NOT NULL DEFAULT 5000000000 CHECK (max_amount_fixed8 >= min_amount_fixed8 AND max_amount_fixed8 <= 5000000000),
  remaining_amount_fixed8 NUMERIC(39, 0) NOT NULL CHECK (remaining_amount_fixed8 >= 0),
  max_claims INTEGER NOT NULL CHECK (max_claims > 0),
  claimed_count INTEGER NOT NULL DEFAULT 0 CHECK (claimed_count >= 0),
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onegate_vault_claim_keys (
  key_hash TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES public.onegate_vault_campaigns(id) ON DELETE CASCADE,
  network TEXT NOT NULL CHECK (network IN ('mainnet', 'testnet')),
  status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'pending', 'submitted', 'paid', 'failed')),
  wallet_address TEXT,
  amount_fixed8 NUMERIC(39, 0),
  tx_hash TEXT,
  request_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  CONSTRAINT onegate_vault_claim_key_amount_nonnegative CHECK (amount_fixed8 IS NULL OR amount_fixed8 > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_onegate_vault_claim_keys_request_id
  ON public.onegate_vault_claim_keys (request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_onegate_vault_claim_keys_campaign_status
  ON public.onegate_vault_claim_keys (campaign_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_onegate_vault_claim_keys_wallet
  ON public.onegate_vault_claim_keys (network, wallet_address, created_at DESC)
  WHERE wallet_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_onegate_vault_campaigns_network_status
  ON public.onegate_vault_campaigns (network, status, created_at DESC);

ALTER TABLE public.onegate_vault_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onegate_vault_claim_keys ENABLE ROW LEVEL SECURITY;

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key public.onegate_vault_claim_keys%ROWTYPE;
  v_campaign public.onegate_vault_campaigns%ROWTYPE;
  v_capped_max NUMERIC(39, 0);
  v_amount NUMERIC(39, 0);
BEGIN
  IF p_network NOT IN ('mainnet', 'testnet') THEN
    RAISE EXCEPTION 'INVALID_NETWORK';
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

  IF v_key.wallet_address = p_wallet_address AND v_key.amount_fixed8 IS NOT NULL THEN
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

  IF v_campaign.expires_at IS NOT NULL AND v_campaign.expires_at <= now() THEN
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
  v_amount := FLOOR(random() * ((v_capped_max - v_campaign.min_amount_fixed8 + 1)::DOUBLE PRECISION))
    + v_campaign.min_amount_fixed8;

  UPDATE public.onegate_vault_campaigns
     SET remaining_amount_fixed8 = remaining_amount_fixed8 - v_amount,
         claimed_count = claimed_count + 1,
         updated_at = now()
   WHERE id = v_campaign.id;

  UPDATE public.onegate_vault_claim_keys
     SET status = 'pending',
         wallet_address = p_wallet_address,
         amount_fixed8 = v_amount,
         request_id = p_request_id,
         error_message = NULL,
         claimed_at = now(),
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

REVOKE ALL ON FUNCTION public.onegate_vault_reserve_claim(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.onegate_vault_reserve_claim(TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMIT;
