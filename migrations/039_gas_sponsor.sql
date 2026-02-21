-- Gas Sponsor Quotas Table
-- Tracks daily sponsorship quota usage per user

CREATE TABLE IF NOT EXISTS gas_sponsor_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    used_amount NUMERIC(20, 8) NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_gas_sponsor_quotas_user_date
    ON gas_sponsor_quotas(user_id, date DESC);

-- Gas Sponsor Requests Table
-- Tracks individual sponsorship requests
CREATE TABLE IF NOT EXISTS gas_sponsor_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(20, 8) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    tx_hash TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gas_sponsor_requests_user
    ON gas_sponsor_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gas_sponsor_requests_status
    ON gas_sponsor_requests(status) WHERE status = 'pending';

-- Function to bump quota and return current usage
CREATE OR REPLACE FUNCTION gas_sponsor_bump_quota(
    p_user_id UUID,
    p_amount NUMERIC(20, 8)
)
RETURNS TABLE(used_amount NUMERIC(20, 8), request_count INTEGER) AS $$
BEGIN
    INSERT INTO gas_sponsor_quotas (user_id, date, used_amount, request_count)
    VALUES (p_user_id, CURRENT_DATE, p_amount, 1)
    ON CONFLICT (user_id, date) DO UPDATE SET
        used_amount = gas_sponsor_quotas.used_amount + p_amount,
        request_count = gas_sponsor_quotas.request_count + 1,
        updated_at = NOW();

    RETURN QUERY
    SELECT q.used_amount, q.request_count
    FROM gas_sponsor_quotas q
    WHERE q.user_id = p_user_id AND q.date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON gas_sponsor_quotas TO service_role;
GRANT SELECT, INSERT, UPDATE ON gas_sponsor_requests TO service_role;
GRANT EXECUTE ON FUNCTION gas_sponsor_bump_quota TO service_role;
