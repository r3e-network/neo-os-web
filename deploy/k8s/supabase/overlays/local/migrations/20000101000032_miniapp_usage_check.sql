-- =============================================================================
-- MiniApp usage cap checks without recording usage
-- =============================================================================

CREATE OR REPLACE FUNCTION miniapp_usage_check(
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
    SELECT
        COALESCE(gas_used, 0),
        COALESCE(governance_used, 0)
    INTO v_gas, v_governance
    FROM miniapp_usage
    WHERE user_id = p_user_id
      AND app_id = p_app_id
      AND usage_date = CURRENT_DATE;

    v_gas := COALESCE(v_gas, 0) + GREATEST(COALESCE(p_gas_delta, 0), 0);
    v_governance := COALESCE(v_governance, 0) + GREATEST(COALESCE(p_governance_delta, 0), 0);

    IF p_gas_cap IS NOT NULL AND p_gas_cap > 0 AND v_gas > p_gas_cap THEN
        RAISE EXCEPTION 'CAP_EXCEEDED: daily GAS cap exceeded';
    END IF;

    IF p_governance_cap IS NOT NULL AND p_governance_cap > 0 AND v_governance > p_governance_cap THEN
        RAISE EXCEPTION 'CAP_EXCEEDED: governance cap exceeded';
    END IF;

    RETURN QUERY SELECT v_gas, v_governance;
END;
$$ LANGUAGE plpgsql;
