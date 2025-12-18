-- =============================================================================
-- Neo Service Layer - Rate Limit Atomic Increment Helper
-- =============================================================================
--
-- Supabase Edge functions implement rate limiting by calling this RPC with the
-- service role key. The function performs an atomic upsert + increment and
-- returns the updated count for the current window.
--
-- Schema dependency: public.rate_limits (created in 002_auth_enhancements.sql)
--
-- NOTE: This function is intentionally generic: callers can encode endpoint or
-- app_id into the identifier string (e.g. "user:<uuid>:pay-gas").

CREATE OR REPLACE FUNCTION public.rate_limit_bump(
  p_identifier TEXT,
  p_identifier_type TEXT,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE(window_start TIMESTAMPTZ, request_count INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_window_seconds INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_seconds := GREATEST(1, COALESCE(p_window_seconds, 60));
  v_window_start := to_timestamp(floor(extract(epoch from now()) / v_window_seconds) * v_window_seconds);

  INSERT INTO public.rate_limits(identifier, identifier_type, window_start, request_count)
  VALUES (p_identifier, p_identifier_type, v_window_start, 1)
  ON CONFLICT (identifier, identifier_type, window_start)
  DO UPDATE SET request_count = public.rate_limits.request_count + 1
  RETURNING public.rate_limits.window_start, public.rate_limits.request_count
  INTO window_start, request_count;

  RETURN NEXT;
END;
$$;

