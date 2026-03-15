-- Address-Transaction relationships
CREATE TABLE IF NOT EXISTS indexer_address_txs (
    id BIGSERIAL PRIMARY KEY,
    address VARCHAR(66) NOT NULL,
    tx_hash VARCHAR(66) NOT NULL REFERENCES indexer_transactions(hash),
    role VARCHAR(20) NOT NULL,
    network VARCHAR(20) NOT NULL,
    block_time TIMESTAMPTZ NOT NULL,
    UNIQUE(address, tx_hash, role)
);

CREATE INDEX idx_addr_tx_address ON indexer_address_txs(address);
CREATE INDEX idx_addr_tx_time ON indexer_address_txs(block_time DESC);
