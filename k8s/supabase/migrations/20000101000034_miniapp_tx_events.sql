-- =============================================================================
-- MiniApp transaction event log + stats rollup updates
-- =============================================================================

CREATE TABLE IF NOT EXISTS miniapp_tx_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT NOT NULL REFERENCES miniapps(app_id) ON DELETE CASCADE,
    tx_hash TEXT NOT NULL,
    sender_address TEXT,
    block_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(app_id, tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_miniapp_tx_events_app_date ON miniapp_tx_events(app_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_miniapp_tx_events_sender ON miniapp_tx_events(sender_address);

ALTER TABLE miniapp_tx_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_all ON miniapp_tx_events FOR ALL TO service_role USING (true);

CREATE OR REPLACE FUNCTION miniapp_tx_log(
    p_app_id TEXT,
    p_tx_hash TEXT,
    p_sender_address TEXT DEFAULT NULL,
    p_block_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN AS $$
DECLARE
    inserted BOOLEAN := false;
BEGIN
    INSERT INTO miniapp_tx_events (
        app_id,
        tx_hash,
        sender_address,
        block_time,
        event_date
    )
    VALUES (
        p_app_id,
        p_tx_hash,
        NULLIF(p_sender_address, ''),
        COALESCE(p_block_time, NOW()),
        (COALESCE(p_block_time, NOW()) AT TIME ZONE 'UTC')::date
    )
    ON CONFLICT (app_id, tx_hash)
    DO NOTHING;

    GET DIAGNOSTICS inserted = ROW_COUNT;
    RETURN inserted;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION miniapp_stats_rollup(p_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
BEGIN
    WITH tx_daily AS (
        SELECT
            event.app_id,
            COUNT(*)::INT AS tx_count,
            COUNT(DISTINCT NULLIF(event.sender_address, ''))::INT AS active_users
        FROM miniapp_tx_events AS event
        WHERE event.event_date = p_date
        GROUP BY event.app_id
    ),
    usage_daily AS (
        SELECT
            usage.app_id,
            (COALESCE(SUM(usage.gas_used), 0)::NUMERIC / 100000000) AS gas_used
        FROM miniapp_usage AS usage
        WHERE usage.usage_date = p_date
        GROUP BY usage.app_id
    )
    INSERT INTO miniapp_stats_daily (app_id, date, tx_count, active_users, gas_used)
    SELECT
        apps.app_id,
        p_date,
        COALESCE(tx_daily.tx_count, 0),
        COALESCE(tx_daily.active_users, 0),
        COALESCE(usage_daily.gas_used, 0)
    FROM miniapps AS apps
    LEFT JOIN tx_daily ON tx_daily.app_id = apps.app_id
    LEFT JOIN usage_daily ON usage_daily.app_id = apps.app_id
    ON CONFLICT (app_id, date)
    DO UPDATE SET
        tx_count = EXCLUDED.tx_count,
        active_users = EXCLUDED.active_users,
        gas_used = EXCLUDED.gas_used;

    WITH tx_totals AS (
        SELECT
            event.app_id,
            COUNT(*)::BIGINT AS total_transactions,
            COUNT(DISTINCT NULLIF(event.sender_address, ''))::INT AS total_users,
            MAX(event.block_time) AS last_activity_at
        FROM miniapp_tx_events AS event
        GROUP BY event.app_id
    ),
    usage_totals AS (
        SELECT
            usage.app_id,
            (COALESCE(SUM(usage.gas_used), 0)::NUMERIC / 100000000) AS total_gas_used,
            MAX(usage.usage_date)::TIMESTAMPTZ AS last_usage_at
        FROM miniapp_usage AS usage
        GROUP BY usage.app_id
    ),
    daily AS (
        SELECT
            event.app_id,
            COUNT(DISTINCT NULLIF(event.sender_address, ''))::INT AS daily_users
        FROM miniapp_tx_events AS event
        WHERE event.event_date = p_date
        GROUP BY event.app_id
    ),
    weekly AS (
        SELECT
            event.app_id,
            COUNT(DISTINCT NULLIF(event.sender_address, ''))::INT AS weekly_users
        FROM miniapp_tx_events AS event
        WHERE event.event_date >= (p_date - INTERVAL '6 days')
          AND event.event_date <= p_date
        GROUP BY event.app_id
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
        COALESCE(tx_totals.total_transactions, 0),
        COALESCE(tx_totals.total_users, 0),
        COALESCE(usage_totals.total_gas_used, 0),
        COALESCE(existing.total_gas_earned, 0),
        COALESCE(existing.method_calls, '{}'::jsonb),
        COALESCE(daily.daily_users, 0),
        COALESCE(weekly.weekly_users, 0),
        COALESCE(GREATEST(tx_totals.last_activity_at, usage_totals.last_usage_at), tx_totals.last_activity_at, usage_totals.last_usage_at),
        NOW()
    FROM miniapps AS apps
    LEFT JOIN tx_totals ON tx_totals.app_id = apps.app_id
    LEFT JOIN usage_totals ON usage_totals.app_id = apps.app_id
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
