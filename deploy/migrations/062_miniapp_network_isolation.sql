-- =============================================================================
-- MiniApp event, notification, and transaction network isolation
-- =============================================================================
-- Public MiniApp pages must never merge mainnet and testnet activity feeds.
-- The application layer now sends an explicit network parameter; these columns
-- make that filter enforceable in Supabase-backed activity queries.

BEGIN;

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'miniapp_notifications',
    'contract_events',
    'chain_txs',
    'miniapp_tx_events',
    'simulation_transactions',
    'service_requests'
  ]
  LOOP
    IF to_regclass('public.' || target_table) IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = target_table
          AND column_name = 'network'
      ) THEN
        EXECUTE format(
          'ALTER TABLE public.%I
             ADD COLUMN network TEXT NOT NULL DEFAULT ''mainnet''
             CHECK (network IN (''mainnet'', ''testnet''))',
          target_table
        );
      END IF;
    END IF;
  END LOOP;
END $$;

ALTER TABLE IF EXISTS public.contract_events
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS state JSONB,
  ADD COLUMN IF NOT EXISTS contract_hash TEXT,
  ADD COLUMN IF NOT EXISTS block_index BIGINT;

DO $$
BEGIN
  IF to_regclass('public.miniapp_notifications') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_miniapp_notifications_network_app
      ON public.miniapp_notifications (network, app_id, created_at DESC);
  END IF;

  IF to_regclass('public.contract_events') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_contract_events_network_app
      ON public.contract_events (network, app_id, created_at DESC);
  END IF;

  IF to_regclass('public.chain_txs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_chain_txs_network_request
      ON public.chain_txs (network, request_id, id DESC);
  END IF;

  IF to_regclass('public.miniapp_tx_events') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_miniapp_tx_events_network_app_date
      ON public.miniapp_tx_events (network, app_id, event_date DESC);
  END IF;
END $$;

COMMIT;
