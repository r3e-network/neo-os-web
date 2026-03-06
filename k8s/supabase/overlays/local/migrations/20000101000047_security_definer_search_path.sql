-- Migration 047: Add SET search_path to SECURITY DEFINER functions
-- Prevents search_path hijacking in functions that run with definer privileges.

CREATE OR REPLACE FUNCTION verify_user_interaction(
    p_app_id TEXT,
    p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    interaction_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO interaction_count
    FROM social_proof_of_interaction
    WHERE app_id = p_app_id AND user_id = p_user_id;
    RETURN interaction_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION check_spam_limit(
    p_user_id UUID,
    p_action_type TEXT,
    p_app_id TEXT DEFAULT NULL,
    p_window_minutes INTEGER DEFAULT 5,
    p_max_per_window INTEGER DEFAULT 3
) RETURNS BOOLEAN AS $$
DECLARE
    recent_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO recent_count
    FROM social_spam_tracking
    WHERE user_id = p_user_id
      AND action_type = p_action_type
      AND (p_app_id IS NULL OR app_id = p_app_id)
      AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;
    RETURN recent_count < p_max_per_window;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION log_spam_action(
    p_user_id UUID,
    p_action_type TEXT,
    p_app_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO social_spam_tracking (user_id, action_type, app_id)
    VALUES (p_user_id, p_action_type, p_app_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION calculate_app_rating_weighted(p_app_id TEXT)
RETURNS TABLE(
    avg_rating NUMERIC,
    total_ratings INTEGER,
    rating_distribution JSONB,
    weighted_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH rating_stats AS (
        SELECT
            COUNT(*)::INTEGER as total,
            COALESCE(AVG(rating_value), 0)::NUMERIC as avg_val,
            COALESCE(
                jsonb_object_agg(rating_value::TEXT, cnt),
                '{}'::jsonb
            ) as distribution
        FROM (
            SELECT rating_value, COUNT(*) as cnt
            FROM social_ratings
            WHERE app_id = p_app_id
            GROUP BY rating_value
        ) sub
    )
    SELECT
        avg_val,
        total,
        distribution,
        CASE WHEN total >= 5
            THEN (avg_val * total + 3.0 * 10) / (total + 10)
            ELSE 0::NUMERIC
        END as weighted
    FROM rating_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Restrict overly broad GRANT ALL to minimal required permissions
REVOKE ALL ON simulation_transactions FROM service_role;
REVOKE ALL ON contract_events FROM service_role;
REVOKE ALL ON service_requests FROM service_role;

GRANT SELECT, INSERT, UPDATE ON simulation_transactions TO service_role;
GRANT SELECT, INSERT, UPDATE ON contract_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON service_requests TO service_role;
