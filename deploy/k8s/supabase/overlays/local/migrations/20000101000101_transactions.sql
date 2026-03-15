-- Neo Indexer Database Schema
-- ISOLATED from MiniApp platform - uses separate Supabase project

-- Transactions table (core entity)
CREATE TABLE IF NOT EXISTS indexer_transactions (
    hash VARCHAR(66) PRIMARY KEY,
    network VARCHAR(20) NOT NULL,
    block_index BIGINT NOT NULL,
    block_time TIMESTAMPTZ NOT NULL,
    size INTEGER NOT NULL,
    version INTEGER NOT NULL,
    nonce BIGINT NOT NULL,
    sender VARCHAR(66) NOT NULL,
    system_fee VARCHAR(50) NOT NULL,
    network_fee VARCHAR(50) NOT NULL,
    valid_until_block BIGINT NOT NULL,
    script TEXT NOT NULL,
    vm_state VARCHAR(20) NOT NULL,
    gas_consumed VARCHAR(50) NOT NULL,
    exception TEXT,
    signers_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tx_network ON indexer_transactions(network);
CREATE INDEX idx_tx_block_index ON indexer_transactions(block_index);
CREATE INDEX idx_tx_sender ON indexer_transactions(sender);
CREATE INDEX idx_tx_block_time ON indexer_transactions(block_time DESC);
