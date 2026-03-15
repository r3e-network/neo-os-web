-- Persistent replay protection for TEE services (VRF, TxProxy)
-- Replaces in-memory maps that lose data on restart

CREATE TABLE IF NOT EXISTS seen_requests (
    service_id VARCHAR(32) NOT NULL,
    request_id VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (service_id, request_id)
);

CREATE INDEX idx_seen_requests_expires ON seen_requests (expires_at);

-- Atomic mark-seen: returns true if newly inserted, false if already exists
CREATE OR REPLACE FUNCTION mark_request_seen(
    p_service_id TEXT,
    p_request_id TEXT,
    p_window_seconds INT DEFAULT 600
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
    v_expires TIMESTAMPTZ;
    v_row_count INT;
BEGIN
    v_expires := NOW() + (p_window_seconds || ' seconds')::INTERVAL;

    -- Atomic upsert: insert if not exists, or refresh if expired
    INSERT INTO seen_requests (service_id, request_id, expires_at, created_at)
    VALUES (p_service_id, p_request_id, v_expires, NOW())
    ON CONFLICT (service_id, request_id) DO UPDATE
        SET expires_at = v_expires, created_at = NOW()
        WHERE seen_requests.expires_at <= NOW();

    GET DIAGNOSTICS v_row_count = ROW_COUNT;

    -- Row affected = new request (inserted) or expired entry refreshed -> true
    -- No row affected = entry exists and not expired (duplicate) -> false
    RETURN v_row_count > 0;
END;
$$;

-- Cleanup expired entries
CREATE OR REPLACE FUNCTION cleanup_seen_requests(p_service_id TEXT DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    v_count INT;
BEGIN
    IF p_service_id IS NOT NULL THEN
        DELETE FROM seen_requests WHERE service_id = p_service_id AND expires_at < NOW();
    ELSE
        DELETE FROM seen_requests WHERE expires_at < NOW();
    END IF;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
