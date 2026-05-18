-- =============================================================================
-- MiniApp stats network scope
-- =============================================================================
-- Public stats must not merge mainnet and testnet rows. Older deployments keyed
-- miniapp_stats by app_id only; this migration adds an explicit network column
-- and changes the conflict target to app_id + network for future rollups.

BEGIN;

ALTER TABLE IF EXISTS public.miniapp_stats
  ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'mainnet'
  CHECK (network IN ('mainnet', 'testnet'));

ALTER TABLE IF EXISTS public.miniapp_stats_daily
  ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'mainnet'
  CHECK (network IN ('mainnet', 'testnet'));

DROP INDEX IF EXISTS public.idx_miniapp_stats_app_id_uq;
DROP INDEX IF EXISTS public.idx_miniapp_stats_app_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_miniapp_stats_app_network_uq
  ON public.miniapp_stats (app_id, network);
CREATE INDEX IF NOT EXISTS idx_miniapp_stats_network_activity
  ON public.miniapp_stats (network, last_activity_at DESC);

DROP INDEX IF EXISTS public.idx_miniapp_stats_daily_app_date_uq;
CREATE UNIQUE INDEX IF NOT EXISTS idx_miniapp_stats_daily_app_network_date_uq
  ON public.miniapp_stats_daily (app_id, network, "date");
CREATE INDEX IF NOT EXISTS idx_miniapp_stats_daily_network_date
  ON public.miniapp_stats_daily (network, "date" DESC);

CREATE OR REPLACE FUNCTION public.miniapp_stats_aggregate(
  p_app_id TEXT DEFAULT NULL,
  p_network TEXT DEFAULT 'mainnet'
)
RETURNS TABLE(
  app_id TEXT,
  total_users BIGINT,
  total_transactions BIGINT,
  total_gas_used NUMERIC
) AS $$
BEGIN
  IF p_network NOT IN ('mainnet', 'testnet') THEN
    RAISE EXCEPTION 'network must be mainnet or testnet';
  END IF;

  RETURN QUERY
  WITH sim AS (
    SELECT
      st.app_id::TEXT AS app_id,
      COUNT(*)::BIGINT AS tx_count,
      COUNT(DISTINCT st.account_address)::BIGINT AS user_count,
      COALESCE(SUM(st.amount), 0)::NUMERIC AS volume
    FROM public.simulation_transactions st
    WHERE st.app_id IS NOT NULL
      AND st.network = p_network
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
      AND sr.network = p_network
      AND (p_app_id IS NULL OR sr.app_id = p_app_id)
    GROUP BY sr.app_id
  ),
  evt AS (
    SELECT
      ce.app_id::TEXT AS app_id,
      COUNT(*)::BIGINT AS tx_count
    FROM public.contract_events ce
    WHERE ce.app_id IS NOT NULL
      AND ce.network = p_network
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

GRANT EXECUTE ON FUNCTION public.miniapp_stats_aggregate(TEXT, TEXT) TO service_role;

COMMIT;
