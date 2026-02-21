-- Migration: Contract Events Table
-- Description: Index chain events for real-time data

CREATE TABLE IF NOT EXISTS contract_events (
    id BIGSERIAL PRIMARY KEY,
    app_id TEXT NOT NULL,
    contract_hash TEXT NOT NULL,
    event_name TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    block_index BIGINT NOT NULL,
    block_time TIMESTAMPTZ NOT NULL,

    -- Event data
    event_data JSONB DEFAULT '{}',

    -- Indexing metadata
    indexed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_contract_events_app_id ON contract_events(app_id);
CREATE INDEX idx_contract_events_contract ON contract_events(contract_hash);
CREATE INDEX idx_contract_events_block ON contract_events(block_index DESC);
CREATE INDEX idx_contract_events_time ON contract_events(block_time DESC);
CREATE INDEX idx_contract_events_tx ON contract_events(tx_hash);
CREATE UNIQUE INDEX idx_contract_events_unique ON contract_events(tx_hash, event_name);

-- Enable RLS
ALTER TABLE contract_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for contract_events"
    ON contract_events FOR SELECT USING (true);

CREATE POLICY "Service write for contract_events"
    ON contract_events FOR ALL
    USING (auth.role() = 'service_role');
