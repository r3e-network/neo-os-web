-- =============================================================================
-- Neo Service Layer - API key prefix length
-- Align prefix storage with generated keys: "sl_" + 8 hex chars (11 total).
-- =============================================================================

ALTER TABLE public.api_keys
    ALTER COLUMN prefix TYPE VARCHAR(11);

-- Keep helper function consistent with the stored prefix length.
DROP FUNCTION IF EXISTS public.generate_api_key();

CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS TABLE(key TEXT, prefix VARCHAR(11), hash VARCHAR(64)) AS $$
DECLARE
    random_bytes BYTEA;
    full_key TEXT;
    key_prefix VARCHAR(11);
    key_hash VARCHAR(64);
BEGIN
    random_bytes := gen_random_bytes(32);
    full_key := 'sl_' || encode(random_bytes, 'hex');
    key_prefix := substring(full_key from 1 for 11);
    key_hash := encode(digest(full_key, 'sha256'), 'hex');

    RETURN QUERY SELECT full_key, key_prefix, key_hash;
END;
$$ LANGUAGE plpgsql;

