-- Migration 040: Atomic quota enforcement for gas_sponsor_bump_quota
--
-- Replaces the naive bump-and-return function from 039 with an atomic version
-- that checks daily limits BEFORE committing the increment. Uses SELECT ... FOR
-- UPDATE row locking to prevent concurrent over-allocation.
--
-- Key behaviors:
--   - p_daily_limit IS NOT NULL  => enforce used + amount <= limit (raises 'quota_exceeded')
--   - p_daily_limit IS NULL      => backward-compatible blind bump
--   - p_amount < 0               => rollback path, skip limit check
--
-- Called by: platform/edge/functions/gas-sponsor-request/index.ts

CREATE OR REPLACE FUNCTION gas_sponsor_bump_quota(
    p_user_id UUID,
    p_amount NUMERIC(20, 8),
    p_daily_limit NUMERIC(20, 8) DEFAULT NULL
)
RETURNS TABLE(used_amount NUMERIC(20, 8), request_count INTEGER) AS $$
DECLARE
    v_current_used NUMERIC(20, 8);
BEGIN
    -- Try to lock the existing row for today
    SELECT q.used_amount INTO v_current_used
    FROM gas_sponsor_quotas q
    WHERE q.user_id = p_user_id AND q.date = CURRENT_DATE
    FOR UPDATE;

    IF FOUND THEN
        -- Row exists: enforce limit if applicable (skip for negative/rollback amounts)
        IF p_daily_limit IS NOT NULL AND p_amount > 0 THEN
            IF v_current_used + p_amount > p_daily_limit THEN
                RAISE EXCEPTION 'quota_exceeded: daily limit is %, current usage is %, requested %',
                    p_daily_limit, v_current_used, p_amount;
            END IF;
        END IF;

        UPDATE gas_sponsor_quotas q
        SET used_amount    = q.used_amount + p_amount,
            request_count  = q.request_count + 1,
            updated_at     = NOW()
        WHERE q.user_id = p_user_id AND q.date = CURRENT_DATE;
    ELSE
        -- No row yet today: check limit for the initial insert
        IF p_daily_limit IS NOT NULL AND p_amount > 0 THEN
            IF p_amount > p_daily_limit THEN
                RAISE EXCEPTION 'quota_exceeded: daily limit is %, requested %',
                    p_daily_limit, p_amount;
            END IF;
        END IF;

        INSERT INTO gas_sponsor_quotas (user_id, date, used_amount, request_count)
        VALUES (p_user_id, CURRENT_DATE, p_amount, 1);
    END IF;

    RETURN QUERY
    SELECT q.used_amount, q.request_count
    FROM gas_sponsor_quotas q
    WHERE q.user_id = p_user_id AND q.date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Re-grant after CREATE OR REPLACE
GRANT EXECUTE ON FUNCTION gas_sponsor_bump_quota(UUID, NUMERIC, NUMERIC) TO service_role;
