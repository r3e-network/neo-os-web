-- =============================================================================
-- MiniApp usage tx counts + stats rollup helper
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'miniapp_usage'
          AND column_name = 'tx_count'
    ) THEN
        ALTER TABLE miniapp_usage
            ADD COLUMN tx_count INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION miniapp_usage_bump(
    p_user_id UUID,
    p_app_id TEXT,
    p_gas_delta BIGINT DEFAULT 0,
    p_governance_delta BIGINT DEFAULT 0,
    p_gas_cap BIGINT DEFAULT NULL,
    p_governance_cap BIGINT DEFAULT NULL
)
RETURNS TABLE(gas_used BIGINT, governance_used BIGINT) AS $$
DECLARE
    v_gas BIGINT;
    v_governance BIGINT;
BEGIN
    INSERT INTO miniapp_usage (
        user_id,
        app_id,
        usage_date,
        gas_used,
        governance_used,
        tx_count,
        updated_at
    )
    VALUES (
        p_user_id,
        p_app_id,
        CURRENT_DATE,
        GREATEST(COALESCE(p_gas_delta, 0), 0),
        GREATEST(COALESCE(p_governance_delta, 0), 0),
        1,
        NOW()
    )
    ON CONFLICT (user_id, app_id, usage_date)
    DO UPDATE SET
        gas_used = miniapp_usage.gas_used + EXCLUDED.gas_used,
        governance_used = miniapp_usage.governance_used + EXCLUDED.governance_used,
        tx_count = miniapp_usage.tx_count + EXCLUDED.tx_count,
        updated_at = NOW()
    RETURNING gas_used, governance_used INTO v_gas, v_governance;

    IF p_gas_cap IS NOT NULL AND p_gas_cap > 0 AND v_gas > p_gas_cap THEN
        RAISE EXCEPTION 'CAP_EXCEEDED: daily GAS cap exceeded';
    END IF;

    IF p_governance_cap IS NOT NULL AND p_governance_cap > 0 AND v_governance > p_governance_cap THEN
        RAISE EXCEPTION 'CAP_EXCEEDED: governance cap exceeded';
    END IF;

    RETURN QUERY SELECT v_gas, v_governance;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION miniapp_stats_rollup(p_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
BEGIN
    INSERT INTO miniapp_stats_daily (app_id, date, tx_count, active_users, gas_used)
    SELECT
        usage.app_id,
        p_date,
        COALESCE(SUM(usage.tx_count), 0)::INT,
        COUNT(DISTINCT usage.user_id)::INT,
        (COALESCE(SUM(usage.gas_used), 0)::NUMERIC / 100000000)
    FROM miniapp_usage AS usage
    WHERE usage.usage_date = p_date
    GROUP BY usage.app_id
    ON CONFLICT (app_id, date)
    DO UPDATE SET
        tx_count = EXCLUDED.tx_count,
        active_users = EXCLUDED.active_users,
        gas_used = EXCLUDED.gas_used;

    WITH totals AS (
        SELECT
            usage.app_id,
            COALESCE(SUM(usage.tx_count), 0)::BIGINT AS total_transactions,
            COUNT(DISTINCT usage.user_id)::INT AS total_users,
            (COALESCE(SUM(usage.gas_used), 0)::NUMERIC / 100000000) AS total_gas_used,
            MAX(usage.usage_date)::TIMESTAMPTZ AS last_activity_at
        FROM miniapp_usage AS usage
        GROUP BY usage.app_id
    ),
    daily AS (
        SELECT
            usage.app_id,
            COUNT(DISTINCT usage.user_id)::INT AS daily_users
        FROM miniapp_usage AS usage
        WHERE usage.usage_date = p_date
        GROUP BY usage.app_id
    ),
    weekly AS (
        SELECT
            usage.app_id,
            COUNT(DISTINCT usage.user_id)::INT AS weekly_users
        FROM miniapp_usage AS usage
        WHERE usage.usage_date >= (p_date - INTERVAL '6 days')
          AND usage.usage_date <= p_date
        GROUP BY usage.app_id
    )
    INSERT INTO miniapp_stats (
        app_id,
        total_transactions,
        total_users,
        total_gas_used,
        total_gas_earned,
        method_calls,
        daily_active_users,
        weekly_active_users,
        last_activity_at,
        stats_updated_at
    )
    SELECT
        apps.app_id,
        COALESCE(totals.total_transactions, 0),
        COALESCE(totals.total_users, 0),
        COALESCE(totals.total_gas_used, 0),
        COALESCE(existing.total_gas_earned, 0),
        COALESCE(existing.method_calls, '{}'::jsonb),
        COALESCE(daily.daily_users, 0),
        COALESCE(weekly.weekly_users, 0),
        totals.last_activity_at,
        NOW()
    FROM miniapps AS apps
    LEFT JOIN totals ON totals.app_id = apps.app_id
    LEFT JOIN daily ON daily.app_id = apps.app_id
    LEFT JOIN weekly ON weekly.app_id = apps.app_id
    LEFT JOIN miniapp_stats AS existing ON existing.app_id = apps.app_id
    ON CONFLICT (app_id)
    DO UPDATE SET
        total_transactions = EXCLUDED.total_transactions,
        total_users = EXCLUDED.total_users,
        total_gas_used = EXCLUDED.total_gas_used,
        daily_active_users = EXCLUDED.daily_active_users,
        weekly_active_users = EXCLUDED.weekly_active_users,
        last_activity_at = EXCLUDED.last_activity_at,
        stats_updated_at = EXCLUDED.stats_updated_at;
END;
$$ LANGUAGE plpgsql;
