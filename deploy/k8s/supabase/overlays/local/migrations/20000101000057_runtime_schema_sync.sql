-- Migration 057: Runtime schema sync for host APIs and canonical miniapp IDs.
-- This migration is intentionally idempotent and safe to re-run.

-- Ensure optional catalog columns exist on miniapps.
ALTER TABLE IF EXISTS public.miniapps
  ADD COLUMN IF NOT EXISTS news_integration BOOLEAN;

ALTER TABLE IF EXISTS public.miniapps
  ADD COLUMN IF NOT EXISTS stats_display TEXT[];

-- Ensure simulation_transactions exists with the columns required by stats RPCs.
CREATE TABLE IF NOT EXISTS public.simulation_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash VARCHAR(64),
  tx_type VARCHAR(50),
  app_id VARCHAR(100),
  account_address VARCHAR(50),
  amount BIGINT,
  status VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.simulation_transactions
  ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(64);

ALTER TABLE public.simulation_transactions
  ADD COLUMN IF NOT EXISTS tx_type VARCHAR(50);

ALTER TABLE public.simulation_transactions
  ADD COLUMN IF NOT EXISTS app_id VARCHAR(100);

ALTER TABLE public.simulation_transactions
  ADD COLUMN IF NOT EXISTS account_address VARCHAR(50);

ALTER TABLE public.simulation_transactions
  ADD COLUMN IF NOT EXISTS amount BIGINT;

ALTER TABLE public.simulation_transactions
  ADD COLUMN IF NOT EXISTS status VARCHAR(20);

ALTER TABLE public.simulation_transactions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'simulation_transactions'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sim_tx_app_created
      ON public.simulation_transactions (app_id, created_at DESC)
      WHERE app_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_sim_tx_created
      ON public.simulation_transactions (created_at DESC);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'miniapp_usage'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_miniapp_usage_app_id
      ON public.miniapp_usage (app_id);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'miniapp_tx_events'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_miniapp_tx_events_date
      ON public.miniapp_tx_events (event_date DESC);
  END IF;
END
$$;

-- Platform stats RPC consumed by /api/platform/stats.
CREATE OR REPLACE FUNCTION public.platform_stats_aggregate()
RETURNS TABLE(
  unique_users BIGINT,
  total_volume NUMERIC,
  top_apps JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH all_users AS (
    SELECT st.account_address AS addr
    FROM public.simulation_transactions st
    WHERE st.account_address IS NOT NULL
    UNION
    SELECT sr.requester AS addr
    FROM public.service_requests sr
    WHERE sr.requester IS NOT NULL
  ),
  volume AS (
    SELECT COALESCE(SUM(st.amount), 0)::NUMERIC AS total
    FROM public.simulation_transactions st
    WHERE st.amount IS NOT NULL
  ),
  apps AS (
    SELECT st.app_id::TEXT AS app_id, COUNT(*)::BIGINT AS tx_count
    FROM public.simulation_transactions st
    WHERE st.app_id IS NOT NULL
    GROUP BY st.app_id
    ORDER BY tx_count DESC
    LIMIT 5
  )
  SELECT
    (SELECT COUNT(*)::BIGINT FROM all_users),
    (SELECT total / 100000000 FROM volume),
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('name', apps.app_id, 'users', apps.tx_count)) FROM apps),
      '[]'::JSONB
    );
END;
$$ LANGUAGE plpgsql STABLE
   SET search_path = public;

GRANT EXECUTE ON FUNCTION public.platform_stats_aggregate() TO service_role;

-- Miniapp stats RPC consumed by /api/miniapp-stats.
CREATE OR REPLACE FUNCTION public.miniapp_stats_aggregate(p_app_id TEXT DEFAULT NULL)
RETURNS TABLE(
  app_id TEXT,
  total_users BIGINT,
  total_transactions BIGINT,
  total_gas_used NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH sim AS (
    SELECT
      st.app_id::TEXT AS app_id,
      COUNT(*)::BIGINT AS tx_count,
      COUNT(DISTINCT st.account_address)::BIGINT AS user_count,
      COALESCE(SUM(st.amount), 0)::NUMERIC AS volume
    FROM public.simulation_transactions st
    WHERE st.app_id IS NOT NULL
      AND (p_app_id IS NULL OR st.app_id = p_app_id)
    GROUP BY st.app_id
  ),
  svc AS (
    SELECT
      sr.app_id::TEXT AS app_id,
      COUNT(*)::BIGINT AS tx_count,
      COUNT(DISTINCT sr.requester)::BIGINT AS user_count
    FROM public.service_requests sr
    WHERE sr.app_id IS NOT NULL
      AND (p_app_id IS NULL OR sr.app_id = p_app_id)
    GROUP BY sr.app_id
  ),
  evt AS (
    SELECT
      ce.app_id::TEXT AS app_id,
      COUNT(*)::BIGINT AS tx_count
    FROM public.contract_events ce
    WHERE ce.app_id IS NOT NULL
      AND (p_app_id IS NULL OR ce.app_id = p_app_id)
    GROUP BY ce.app_id
  ),
  all_apps AS (
    SELECT sim.app_id AS app_id FROM sim
    UNION SELECT svc.app_id AS app_id FROM svc
    UNION SELECT evt.app_id AS app_id FROM evt
  )
  SELECT
    a.app_id::TEXT,
    (COALESCE(sim.user_count, 0) + COALESCE(svc.user_count, 0))::BIGINT AS total_users,
    (COALESCE(sim.tx_count, 0) + COALESCE(svc.tx_count, 0) + COALESCE(evt.tx_count, 0))::BIGINT AS total_transactions,
    (COALESCE(sim.volume, 0) / 100000000)::NUMERIC AS total_gas_used
  FROM all_apps a
  LEFT JOIN sim ON sim.app_id = a.app_id
  LEFT JOIN svc ON svc.app_id = a.app_id
  LEFT JOIN evt ON evt.app_id = a.app_id
  ORDER BY total_transactions DESC;
END;
$$ LANGUAGE plpgsql STABLE
   SET search_path = public;

GRANT EXECUTE ON FUNCTION public.miniapp_stats_aggregate(TEXT) TO service_role;

-- Canonicalize historical app IDs to current miniapp-* IDs across all base tables.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'app_id'
      AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('text', 'character varying', 'character')
  LOOP
    EXECUTE format(
      'UPDATE public.%I
          SET app_id = CASE app_id
            WHEN ''builtin-lottery'' THEN ''miniapp-lottery''
            WHEN ''builtin-coin-flip'' THEN ''miniapp-coinflip''
            WHEN ''builtin-dice-game'' THEN ''miniapp-dicegame''
            WHEN ''builtin-prediction-market'' THEN ''miniapp-predictionmarket''
            WHEN ''builtin-red-envelope'' THEN ''miniapp-redenvelope''
            WHEN ''builtin-secret-vote'' THEN ''miniapp-secretvote''
            WHEN ''builtin-gas-spin'' THEN ''miniapp-gacha''
            WHEN ''miniapp-coin-flip'' THEN ''miniapp-coinflip''
            WHEN ''miniapp-dice-game'' THEN ''miniapp-dicegame''
            WHEN ''miniapp-prediction-market'' THEN ''miniapp-predictionmarket''
            WHEN ''miniapp-red-envelope'' THEN ''miniapp-redenvelope''
            WHEN ''miniapp-secret-vote'' THEN ''miniapp-secretvote''
            WHEN ''miniapp-gas-spin'' THEN ''miniapp-gacha''
            ELSE app_id
          END
        WHERE app_id IN (
          ''builtin-lottery'',
          ''builtin-coin-flip'',
          ''builtin-dice-game'',
          ''builtin-prediction-market'',
          ''builtin-red-envelope'',
          ''builtin-secret-vote'',
          ''builtin-gas-spin'',
          ''miniapp-coin-flip'',
          ''miniapp-dice-game'',
          ''miniapp-prediction-market'',
          ''miniapp-red-envelope'',
          ''miniapp-secret-vote'',
          ''miniapp-gas-spin''
        )',
      r.table_name
    );
  END LOOP;
END
$$;
