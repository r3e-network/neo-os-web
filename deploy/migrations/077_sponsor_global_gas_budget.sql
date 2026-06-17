-- Migration 077: Atomic global daily GAS budget for the host-app sponsor endpoint
--
-- The Next.js sponsor endpoint (platform/host-app/pages/api/rpc/sponsor.ts)
-- previously enforced its global "N GAS per day" budget with a module-level
-- in-memory counter. On serverless that counter is per-instance and resets on
-- cold start, so the global cap never actually held and the sponsor wallet could
-- be drained. This function provides a single, shared, atomic budget keyed by
-- (scope, date) so every instance enforces the same daily ceiling.
--
-- Behavior mirrors gas_sponsor_bump_quota (migration 040):
--   - p_daily_limit IS NOT NULL => enforce used + amount <= limit
--                                  (raises 'budget_exceeded')
--   - p_daily_limit IS NULL     => blind bump (no enforcement)
--   - p_amount < 0              => rollback path, skip the limit check
-- SELECT ... FOR UPDATE serializes concurrent callers to prevent over-spend.
--
-- Called by: platform/host-app/pages/api/rpc/sponsor.ts

CREATE TABLE IF NOT EXISTS sponsor_global_budget (
    scope TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    used_amount NUMERIC(20, 8) NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (scope, date)
);

ALTER TABLE sponsor_global_budget ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sponsor_global_budget_service_all ON sponsor_global_budget;
CREATE POLICY sponsor_global_budget_service_all
    ON sponsor_global_budget FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION sponsor_global_budget_bump(
    p_scope TEXT,
    p_amount NUMERIC(20, 8),
    p_daily_limit NUMERIC(20, 8) DEFAULT NULL
)
RETURNS TABLE(used_amount NUMERIC(20, 8), request_count INTEGER) AS $$
DECLARE
    v_current_used NUMERIC(20, 8);
BEGIN
    -- Lock the existing row for today's scope (if any) to serialize callers.
    SELECT b.used_amount INTO v_current_used
    FROM sponsor_global_budget b
    WHERE b.scope = p_scope AND b.date = CURRENT_DATE
    FOR UPDATE;

    IF FOUND THEN
        IF p_daily_limit IS NOT NULL AND p_amount > 0 THEN
            IF v_current_used + p_amount > p_daily_limit THEN
                RAISE EXCEPTION 'budget_exceeded: daily limit is %, current usage is %, requested %',
                    p_daily_limit, v_current_used, p_amount;
            END IF;
        END IF;

        UPDATE sponsor_global_budget b
        SET used_amount   = b.used_amount + p_amount,
            request_count = b.request_count + 1,
            updated_at    = NOW()
        WHERE b.scope = p_scope AND b.date = CURRENT_DATE;
    ELSE
        IF p_daily_limit IS NOT NULL AND p_amount > 0 THEN
            IF p_amount > p_daily_limit THEN
                RAISE EXCEPTION 'budget_exceeded: daily limit is %, requested %',
                    p_daily_limit, p_amount;
            END IF;
        END IF;

        INSERT INTO sponsor_global_budget (scope, date, used_amount, request_count)
        VALUES (p_scope, CURRENT_DATE, p_amount, 1);
    END IF;

    RETURN QUERY
    SELECT b.used_amount, b.request_count
    FROM sponsor_global_budget b
    WHERE b.scope = p_scope AND b.date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

GRANT SELECT, INSERT, UPDATE ON sponsor_global_budget TO service_role;
GRANT EXECUTE ON FUNCTION sponsor_global_budget_bump(TEXT, NUMERIC, NUMERIC) TO service_role;
