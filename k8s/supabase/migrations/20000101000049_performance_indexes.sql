-- Migration 049: Add missing performance indexes and stats aggregation RPC
-- Addresses full table scans identified in performance audit.

-- 1. Missing index on miniapp_usage(app_id) for aggregation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_miniapp_usage_app_id
    ON miniapp_usage (app_id);

-- 2. Missing index on miniapp_tx_events(event_date) for stats rollup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_miniapp_tx_events_date
    ON miniapp_tx_events (event_date DESC);

-- 3. Missing composite index on simulation_transactions(app_id, created_at)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sim_tx_app_created
    ON simulation_transactions (app_id, created_at DESC)
    WHERE app_id IS NOT NULL;

-- 4. Database-side stats aggregation to replace client-side full table scans
CREATE OR REPLACE FUNCTION miniapp_stats_aggregate(p_app_id TEXT DEFAULT NULL)
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
            st.app_id,
            COUNT(*)::BIGINT AS tx_count,
            COUNT(DISTINCT st.account_address)::BIGINT AS user_count,
            COALESCE(SUM(st.amount), 0) AS volume
        FROM simulation_transactions st
        WHERE st.app_id IS NOT NULL
          AND (p_app_id IS NULL OR st.app_id = p_app_id)
        GROUP BY st.app_id
    ),
    svc AS (
        SELECT
            sr.app_id,
            COUNT(*)::BIGINT AS tx_count,
            COUNT(DISTINCT sr.requester)::BIGINT AS user_count
        FROM service_requests sr
        WHERE sr.app_id IS NOT NULL
          AND (p_app_id IS NULL OR sr.app_id = p_app_id)
        GROUP BY sr.app_id
    ),
    evt AS (
        SELECT
            ce.app_id,
            COUNT(*)::BIGINT AS tx_count
        FROM contract_events ce
        WHERE ce.app_id IS NOT NULL
          AND (p_app_id IS NULL OR ce.app_id = p_app_id)
        GROUP BY ce.app_id
    ),
    all_apps AS (
        SELECT app_id FROM sim
        UNION SELECT app_id FROM svc
        UNION SELECT app_id FROM evt
    )
    SELECT
        a.app_id,
        COALESCE(sim.user_count, 0) + COALESCE(svc.user_count, 0) AS total_users,
        COALESCE(sim.tx_count, 0) + COALESCE(svc.tx_count, 0) + COALESCE(evt.tx_count, 0) AS total_transactions,
        COALESCE(sim.volume, 0)::NUMERIC / 100000000 AS total_gas_used
    FROM all_apps a
    LEFT JOIN sim ON sim.app_id = a.app_id
    LEFT JOIN svc ON svc.app_id = a.app_id
    LEFT JOIN evt ON evt.app_id = a.app_id
    ORDER BY total_transactions DESC;
END;
$$ LANGUAGE plpgsql STABLE
   SET search_path = public;

GRANT EXECUTE ON FUNCTION miniapp_stats_aggregate(TEXT) TO service_role;
