-- =============================================================================
-- Migration 078: MiniApp Credits — DB-first spend ledger with on-chain checkpoints
-- =============================================================================
-- Companion to the MiniAppCredits contract (contracts/MiniAppCredits).
--
-- Architecture (inverted v2):
--   * BUY   — on-chain: user sends GAS to MiniAppCredits with memo
--             "miniapp-credits:buy"; the contract emits CreditsPurchased and the
--             credits-indexer edge function credits the DB balance here.
--   * SPEND — DB-first: credits-ledger debits atomically (no transaction, no
--             fee) via credits_spend below; idempotency keys dedupe retries.
--   * SETTLE — credits-settler aggregates net spend deltas per user over a
--             contiguous credit_events window and posts ONE operator-signed
--             postSettlement batch per epoch; the chain stays the auditable
--             checkpoint and users can exit() their last settled balance.
--
-- Reconciliation rule (documented in docs/MINIAPP_CREDITS_LEDGER.md):
--   settled chain state + unsettled DB spend deltas = current truth.
--   Purchases replay from chain (tx_hash+event_index dedupe); spends replay
--   from the credit_events append log (idempotency_key dedupe).
--
-- Rate: 1 GAS = 50 credits; 1 credit = 2_000_000 GAS base units (fixed8).
-- All credit amounts in these tables are integer credits (BIGINT).

BEGIN;

-- -----------------------------------------------------------------------------
-- Balances: interactive truth between settlements. One row per wallet+network.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_balances (
  network TEXT NOT NULL CHECK (network IN ('mainnet', 'testnet')),
  wallet_address TEXT NOT NULL,
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_purchased BIGINT NOT NULL DEFAULT 0 CHECK (total_purchased >= 0),
  total_spent BIGINT NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  total_exited BIGINT NOT NULL DEFAULT 0 CHECK (total_exited >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (network, wallet_address)
);

-- -----------------------------------------------------------------------------
-- Events: append-only ledger. Every balance change has exactly one row here.
--   purchase — indexed from CreditsPurchased (amount > 0, chain-anchored)
--   spend    — DB-first debit (amount < 0, idempotency-keyed)
--   exit     — indexed from CreditsExited (amount <= 0; the DB debit clamps at
--              the DB balance, so a fully spent-down wallet records 0)
-- Settlement does NOT touch balances (spends were already debited); epochs are
-- bookkept in credit_epochs over contiguous [from_event_id, through_event_id]
-- windows of this log.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_events (
  id BIGSERIAL PRIMARY KEY,
  network TEXT NOT NULL CHECK (network IN ('mainnet', 'testnet')),
  wallet_address TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('purchase', 'spend', 'exit')),
  -- Signed credits delta applied to credit_balances.balance.
  amount BIGINT NOT NULL,
  balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
  -- Spend metadata
  app_id TEXT,
  action TEXT,
  idempotency_key TEXT,
  -- Chain anchors (purchase / exit)
  tx_hash TEXT,
  event_index INTEGER,
  -- GAS base units moved on-chain (purchase: paid in; exit: paid out).
  gas_amount NUMERIC(39, 0) CHECK (gas_amount IS NULL OR gas_amount >= 0),
  -- Chain-side credits minted/burned (exit may burn more than the DB debit
  -- when unsettled spends existed; keep the chain figure for audit).
  chain_credits BIGINT CHECK (chain_credits IS NULL OR chain_credits >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT credit_events_spend_fields CHECK (
    event_type <> 'spend'
    OR (app_id IS NOT NULL AND idempotency_key IS NOT NULL AND amount < 0)
  ),
  CONSTRAINT credit_events_purchase_fields CHECK (
    event_type <> 'purchase'
    OR (tx_hash IS NOT NULL AND event_index IS NOT NULL AND amount > 0)
  ),
  CONSTRAINT credit_events_exit_fields CHECK (
    event_type <> 'exit'
    OR (tx_hash IS NOT NULL AND event_index IS NOT NULL AND amount <= 0)
  )
);

-- Spend idempotency: one debit per (network, wallet, key), retries dedupe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_events_spend_idempotency
  ON public.credit_events (network, wallet_address, idempotency_key)
  WHERE event_type = 'spend' AND idempotency_key IS NOT NULL;

-- Chain replay safety: one row per on-chain notification.
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_events_chain_anchor
  ON public.credit_events (network, tx_hash, event_index)
  WHERE tx_hash IS NOT NULL;

-- History reads (credits-ledger GET).
CREATE INDEX IF NOT EXISTS idx_credit_events_wallet_history
  ON public.credit_events (network, wallet_address, id DESC);

-- Settlement window scans (credits-settler aggregation).
CREATE INDEX IF NOT EXISTS idx_credit_events_settlement_window
  ON public.credit_events (network, event_type, id);

-- -----------------------------------------------------------------------------
-- Epochs: settlement bookkeeping. Each epoch checkpoints the contiguous spend
-- window (from_event_id, through_event_id] onto the chain.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_epochs (
  network TEXT NOT NULL CHECK (network IN ('mainnet', 'testnet')),
  epoch BIGINT NOT NULL CHECK (epoch > 0),
  from_event_id BIGINT NOT NULL CHECK (from_event_id >= 0),
  through_event_id BIGINT NOT NULL CHECK (through_event_id > from_event_id),
  user_count INTEGER NOT NULL CHECK (user_count > 0),
  -- Sum of per-user net spend deltas in the window (always negative).
  total_delta BIGINT NOT NULL CHECK (total_delta < 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed')),
  request_id TEXT,
  tx_hash TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  PRIMARY KEY (network, epoch)
);

-- -----------------------------------------------------------------------------
-- Indexer cursor: replay-safe block progress per network.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_indexer_state (
  network TEXT PRIMARY KEY CHECK (network IN ('mainnet', 'testnet')),
  last_processed_block BIGINT NOT NULL CHECK (last_processed_block >= 0),
  contract_hash TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_epochs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_indexer_state ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- credits_spend — atomic conditional debit with idempotency dedupe.
--
-- Returns exactly one row:
--   success   — debit applied (or previously applied when deduped)
--   deduped   — an event with this idempotency key already existed; the
--               original outcome is returned and no second debit happens
--   error_code — NULL | 'invalid_amount' | 'insufficient_credits'
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credits_spend(
  p_network TEXT,
  p_wallet TEXT,
  p_app_id TEXT,
  p_action TEXT,
  p_amount BIGINT,
  p_idempotency_key TEXT
) RETURNS TABLE(
  success BOOLEAN,
  deduped BOOLEAN,
  new_balance BIGINT,
  event_id BIGINT,
  error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance BIGINT;
  v_new_balance BIGINT;
  v_event_id BIGINT;
  v_existing RECORD;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN QUERY SELECT false, false, 0::BIGINT, NULL::BIGINT, 'invalid_amount'::TEXT;
    RETURN;
  END IF;

  -- Fast-path dedupe (also re-checked via the unique index below).
  SELECT e.id, e.balance_after INTO v_existing
  FROM credit_events e
  WHERE e.network = p_network
    AND e.wallet_address = p_wallet
    AND e.idempotency_key = p_idempotency_key
    AND e.event_type = 'spend';
  IF FOUND THEN
    RETURN QUERY SELECT true, true, v_existing.balance_after, v_existing.id, NULL::TEXT;
    RETURN;
  END IF;

  -- Lock the balance row; a missing row means zero balance.
  SELECT b.balance INTO v_balance
  FROM credit_balances b
  WHERE b.network = p_network AND b.wallet_address = p_wallet
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, 0::BIGINT, NULL::BIGINT, 'insufficient_credits'::TEXT;
    RETURN;
  END IF;

  IF v_balance < p_amount THEN
    RETURN QUERY SELECT false, false, v_balance, NULL::BIGINT, 'insufficient_credits'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_balance - p_amount;

  BEGIN
    UPDATE credit_balances
    SET balance = v_new_balance,
        total_spent = total_spent + p_amount,
        updated_at = now()
    WHERE network = p_network AND wallet_address = p_wallet;

    INSERT INTO credit_events (network, wallet_address, event_type, amount, balance_after, app_id, action, idempotency_key)
    VALUES (p_network, p_wallet, 'spend', -p_amount, v_new_balance, p_app_id, p_action, p_idempotency_key)
    RETURNING id INTO v_event_id;
  EXCEPTION WHEN unique_violation THEN
    -- A concurrent request with the same idempotency key won the race; this
    -- block's debit is rolled back and the original outcome is returned.
    SELECT e.id, e.balance_after INTO v_existing
    FROM credit_events e
    WHERE e.network = p_network
      AND e.wallet_address = p_wallet
      AND e.idempotency_key = p_idempotency_key
      AND e.event_type = 'spend';
    RETURN QUERY SELECT true, true, v_existing.balance_after, v_existing.id, NULL::TEXT;
    RETURN;
  END;

  RETURN QUERY SELECT true, false, v_new_balance, v_event_id, NULL::TEXT;
END;
$$;

-- -----------------------------------------------------------------------------
-- credits_credit_purchase — replay-safe credit of an on-chain purchase.
-- Dedupe on (network, tx_hash, event_index); duplicates return deduped=true
-- and leave the balance untouched.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credits_credit_purchase(
  p_network TEXT,
  p_wallet TEXT,
  p_tx_hash TEXT,
  p_event_index INTEGER,
  p_gas_amount NUMERIC,
  p_credits BIGINT
) RETURNS TABLE(
  success BOOLEAN,
  deduped BOOLEAN,
  new_balance BIGINT,
  event_id BIGINT,
  error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance BIGINT;
  v_event_id BIGINT;
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RETURN QUERY SELECT false, false, 0::BIGINT, NULL::BIGINT, 'invalid_amount'::TEXT;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO credit_balances (network, wallet_address, balance, total_purchased)
    VALUES (p_network, p_wallet, p_credits, p_credits)
    ON CONFLICT (network, wallet_address) DO UPDATE
      SET balance = credit_balances.balance + EXCLUDED.balance,
          total_purchased = credit_balances.total_purchased + EXCLUDED.total_purchased,
          updated_at = now()
    RETURNING balance INTO v_new_balance;

    INSERT INTO credit_events (network, wallet_address, event_type, amount, balance_after, tx_hash, event_index, gas_amount, chain_credits)
    VALUES (p_network, p_wallet, 'purchase', p_credits, v_new_balance, p_tx_hash, p_event_index, p_gas_amount, p_credits)
    RETURNING id INTO v_event_id;
  EXCEPTION WHEN unique_violation THEN
    -- Notification already indexed: the balance update above is rolled back.
    RETURN QUERY SELECT true, true,
      (SELECT b.balance FROM credit_balances b WHERE b.network = p_network AND b.wallet_address = p_wallet),
      NULL::BIGINT, NULL::TEXT;
    RETURN;
  END;

  RETURN QUERY SELECT true, false, v_new_balance, v_event_id, NULL::TEXT;
END;
$$;

-- -----------------------------------------------------------------------------
-- credits_apply_exit — replay-safe mirror of an on-chain exit().
-- The contract burns the user's SETTLED balance; the DB debit clamps at the
-- current DB balance (a wallet that spent down off-chain after the last
-- settlement records a smaller — possibly zero — DB delta; chain_credits keeps
-- the chain-side figure for audit).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credits_apply_exit(
  p_network TEXT,
  p_wallet TEXT,
  p_tx_hash TEXT,
  p_event_index INTEGER,
  p_chain_credits BIGINT,
  p_gas_paid NUMERIC
) RETURNS TABLE(
  success BOOLEAN,
  deduped BOOLEAN,
  new_balance BIGINT,
  event_id BIGINT,
  error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance BIGINT;
  v_debit BIGINT;
  v_new_balance BIGINT;
  v_event_id BIGINT;
BEGIN
  IF p_chain_credits IS NULL OR p_chain_credits <= 0 THEN
    RETURN QUERY SELECT false, false, 0::BIGINT, NULL::BIGINT, 'invalid_amount'::TEXT;
    RETURN;
  END IF;

  -- Ensure a lockable row exists even for wallets never indexed before.
  INSERT INTO credit_balances (network, wallet_address)
  VALUES (p_network, p_wallet)
  ON CONFLICT (network, wallet_address) DO NOTHING;

  SELECT b.balance INTO v_balance
  FROM credit_balances b
  WHERE b.network = p_network AND b.wallet_address = p_wallet
  FOR UPDATE;

  v_debit := LEAST(v_balance, p_chain_credits);
  v_new_balance := v_balance - v_debit;

  BEGIN
    UPDATE credit_balances
    SET balance = v_new_balance,
        total_exited = total_exited + v_debit,
        updated_at = now()
    WHERE network = p_network AND wallet_address = p_wallet;

    INSERT INTO credit_events (network, wallet_address, event_type, amount, balance_after, tx_hash, event_index, gas_amount, chain_credits)
    VALUES (p_network, p_wallet, 'exit', -v_debit, v_new_balance, p_tx_hash, p_event_index, p_gas_paid, p_chain_credits)
    RETURNING id INTO v_event_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT true, true,
      (SELECT b.balance FROM credit_balances b WHERE b.network = p_network AND b.wallet_address = p_wallet),
      NULL::BIGINT, NULL::TEXT;
    RETURN;
  END;

  RETURN QUERY SELECT true, false, v_new_balance, v_event_id, NULL::TEXT;
END;
$$;

-- -----------------------------------------------------------------------------
-- credits_prepare_epoch — deterministic settlement window + per-user deltas.
--
-- Window start = through_event_id of the latest submitted/confirmed epoch
-- (failed and pending epochs release their window so retries re-aggregate).
-- Caps distinct users at p_max_users by shrinking through_event_id so a batch
-- never exceeds the contract's MaxSettlementBatch (500).
--
-- Upserts the (network, p_epoch) row to 'pending' and returns one row per
-- user: (epoch, from_event_id, through_event_id, wallet_address, delta<0).
-- Returns zero rows when there is nothing to settle (no epoch row written).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credits_prepare_epoch(
  p_network TEXT,
  p_epoch BIGINT,
  p_max_users INTEGER DEFAULT 500
) RETURNS TABLE(
  epoch BIGINT,
  from_event_id BIGINT,
  through_event_id BIGINT,
  wallet_address TEXT,
  delta BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- OUT parameters intentionally reuse column names (settler reads these JSON
-- keys); resolve identifier clashes (e.g. ON CONFLICT (network, epoch)) in
-- favor of table columns. All variable reads below are p_/v_ prefixed.
#variable_conflict use_column
DECLARE
  v_from BIGINT;
  v_through BIGINT;
  v_user_count INTEGER;
  v_total_delta BIGINT;
BEGIN
  IF p_max_users IS NULL OR p_max_users < 1 OR p_max_users > 500 THEN
    p_max_users := 500;
  END IF;

  SELECT COALESCE(MAX(e.through_event_id), 0) INTO v_from
  FROM credit_epochs e
  WHERE e.network = p_network AND e.status IN ('submitted', 'confirmed');

  -- Largest event id whose inclusion keeps the distinct-user count <= cap.
  SELECT MAX(t.id) INTO v_through
  FROM (
    SELECT s.id,
           SUM(s.is_first_occurrence) OVER (ORDER BY s.id) AS users_so_far
    FROM (
      SELECT ev.id,
             CASE WHEN ROW_NUMBER() OVER (PARTITION BY ev.wallet_address ORDER BY ev.id) = 1
                  THEN 1 ELSE 0 END AS is_first_occurrence
      FROM credit_events ev
      WHERE ev.network = p_network AND ev.event_type = 'spend' AND ev.id > v_from
    ) s
  ) t
  WHERE t.users_so_far <= p_max_users;

  IF v_through IS NULL THEN
    RETURN; -- nothing to settle
  END IF;

  SELECT COUNT(DISTINCT ev.wallet_address), SUM(ev.amount)
  INTO v_user_count, v_total_delta
  FROM credit_events ev
  WHERE ev.network = p_network AND ev.event_type = 'spend'
    AND ev.id > v_from AND ev.id <= v_through;

  INSERT INTO credit_epochs (network, epoch, from_event_id, through_event_id, user_count, total_delta, status)
  VALUES (p_network, p_epoch, v_from, v_through, v_user_count, v_total_delta, 'pending')
  ON CONFLICT (network, epoch) DO UPDATE
    SET from_event_id = EXCLUDED.from_event_id,
        through_event_id = EXCLUDED.through_event_id,
        user_count = EXCLUDED.user_count,
        total_delta = EXCLUDED.total_delta,
        status = 'pending',
        request_id = NULL,
        tx_hash = NULL,
        error_message = NULL,
        submitted_at = NULL,
        confirmed_at = NULL
    WHERE credit_epochs.status IN ('pending', 'failed');

  -- Refuse to re-prepare an epoch that is already submitted/confirmed.
  IF NOT EXISTS (
    SELECT 1 FROM credit_epochs ce
    WHERE ce.network = p_network AND ce.epoch = p_epoch AND ce.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'epoch % already submitted or confirmed for network %', p_epoch, p_network
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN QUERY
  SELECT p_epoch, v_from, v_through, ev.wallet_address, SUM(ev.amount)::BIGINT
  FROM credit_events ev
  WHERE ev.network = p_network AND ev.event_type = 'spend'
    AND ev.id > v_from AND ev.id <= v_through
  GROUP BY ev.wallet_address
  ORDER BY ev.wallet_address;
END;
$$;

-- Least privilege: definer functions are service-role only.
REVOKE ALL ON FUNCTION public.credits_spend(TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credits_credit_purchase(TEXT, TEXT, TEXT, INTEGER, NUMERIC, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credits_apply_exit(TEXT, TEXT, TEXT, INTEGER, BIGINT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credits_prepare_epoch(TEXT, BIGINT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credits_spend(TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.credits_credit_purchase(TEXT, TEXT, TEXT, INTEGER, NUMERIC, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.credits_apply_exit(TEXT, TEXT, TEXT, INTEGER, BIGINT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.credits_prepare_epoch(TEXT, BIGINT, INTEGER) TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.credit_balances TO service_role;
GRANT SELECT, INSERT ON public.credit_events TO service_role;
GRANT USAGE ON SEQUENCE public.credit_events_id_seq TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.credit_epochs TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.credit_indexer_state TO service_role;

COMMIT;
