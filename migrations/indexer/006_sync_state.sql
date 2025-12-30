-- Sync state table
CREATE TABLE IF NOT EXISTS indexer_sync_state (
    id BIGSERIAL PRIMARY KEY,
    network VARCHAR(20) UNIQUE NOT NULL,
    last_block_index BIGINT NOT NULL,
    last_block_time TIMESTAMPTZ NOT NULL,
    total_tx_indexed BIGINT DEFAULT 0,
    last_sync_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
