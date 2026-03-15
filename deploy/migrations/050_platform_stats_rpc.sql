-- Migration 050: Database-side platform stats aggregation RPC
-- Replaces 5 sequential full table scans in /api/platform/stats with a single RPC call.

CREATE OR REPLACE FUNCTION platform_stats_aggregate()
RETURNS TABLE(
    unique_users BIGINT,
    total_volume NUMERIC,
    top_apps JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH all_users AS (
        SELECT account_address AS addr FROM simulation_transactions WHERE account_address IS NOT NULL
        UNION
        SELECT requester AS addr FROM service_requests WHERE requester IS NOT NULL
    ),
    volume AS (
        SELECT COALESCE(SUM(amount), 0) AS total FROM simulation_transactions WHERE amount IS NOT NULL
    ),
    apps AS (
        SELECT app_id, COUNT(*)::BIGINT AS tx_count
        FROM simulation_transactions
        WHERE app_id IS NOT NULL
        GROUP BY app_id
        ORDER BY tx_count DESC
        LIMIT 5
    )
    SELECT
        (SELECT COUNT(*)::BIGINT FROM all_users),
        (SELECT total::NUMERIC / 100000000 FROM volume),
        COALESCE((SELECT jsonb_agg(jsonb_build_object('name', app_id, 'users', tx_count)) FROM apps), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE
   SET search_path = public;

GRANT EXECUTE ON FUNCTION platform_stats_aggregate() TO service_role;
