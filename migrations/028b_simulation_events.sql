-- Simulation events and transactions storage
-- Stores all MiniApp platform transactions and contract events

-- Simulation transactions table
CREATE TABLE IF NOT EXISTS simulation_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_hash VARCHAR(64) NOT NULL UNIQUE,
    tx_type VARCHAR(50) NOT NULL, -- payment, request, fulfill, randomness, payout, topup
    app_id VARCHAR(100),
    account_address VARCHAR(50),
    contract_hash VARCHAR(42),
    method_name VARCHAR(100),
    amount BIGINT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, success, failed
    error_message TEXT,
    block_index BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

-- Contract events table
CREATE TABLE IF NOT EXISTS contract_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_hash VARCHAR(64) NOT NULL,
    contract_hash VARCHAR(42) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}',
    block_index BIGINT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_tx FOREIGN KEY (tx_hash)
        REFERENCES simulation_transactions(tx_hash) ON DELETE CASCADE
);

-- Service requests table (detailed tracking)
CREATE TABLE IF NOT EXISTS service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id BIGINT NOT NULL UNIQUE,
    app_id VARCHAR(100) NOT NULL,
    service_type VARCHAR(50) NOT NULL,
    requester VARCHAR(50) NOT NULL,
    callback_contract VARCHAR(42),
    callback_method VARCHAR(100),
    payload JSONB,
    status VARCHAR(20) DEFAULT 'pending', -- pending, fulfilled, failed
    success BOOLEAN,
    result BYTEA,
    error_message TEXT,
    request_tx VARCHAR(64),
    fulfill_tx VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    fulfilled_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sim_tx_type ON simulation_transactions(tx_type);
CREATE INDEX IF NOT EXISTS idx_sim_tx_app ON simulation_transactions(app_id);
CREATE INDEX IF NOT EXISTS idx_sim_tx_status ON simulation_transactions(status);
CREATE INDEX IF NOT EXISTS idx_sim_tx_created ON simulation_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_tx ON contract_events(tx_hash);
CREATE INDEX IF NOT EXISTS idx_events_contract ON contract_events(contract_hash);
CREATE INDEX IF NOT EXISTS idx_events_name ON contract_events(event_name);

CREATE INDEX IF NOT EXISTS idx_requests_app ON service_requests(app_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON service_requests(status);

-- Grant permissions
GRANT ALL ON simulation_transactions TO service_role;
GRANT ALL ON contract_events TO service_role;
GRANT ALL ON service_requests TO service_role;
