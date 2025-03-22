BEGIN;

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    hash VARCHAR(66) UNIQUE,
    service VARCHAR(50) NOT NULL,
    entity_id UUID,
    entity_type VARCHAR(50),
    status VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    gas_consumed BIGINT,
    gas_price BIGINT NOT NULL,
    system_fee BIGINT NOT NULL,
    network_fee BIGINT NOT NULL,
    block_height BIGINT,
    block_time TIMESTAMP,
    sender VARCHAR(42) NOT NULL,
    error TEXT,
    result JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(hash);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_service ON transactions(service);
CREATE INDEX IF NOT EXISTS idx_transactions_entity ON transactions(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

CREATE TABLE IF NOT EXISTS transaction_events (
    id UUID PRIMARY KEY,
    transaction_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL,
    details JSONB,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_transaction_id FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_events_tx_id ON transaction_events(transaction_id);

CREATE TABLE IF NOT EXISTS wallet_accounts (
    id UUID PRIMARY KEY,
    service VARCHAR(50) NOT NULL,
    address VARCHAR(42) NOT NULL UNIQUE,
    encrypted_private_key TEXT NOT NULL,
    public_key TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_accounts_service ON wallet_accounts(service);
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_address ON wallet_accounts(address);

COMMIT; 