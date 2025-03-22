-- Create random_requests table
CREATE TABLE IF NOT EXISTS random_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL,
    callback_address VARCHAR(42),
    callback_method VARCHAR(64),
    seed BYTEA,
    block_height BIGINT,
    num_bytes INTEGER NOT NULL DEFAULT 32,
    delay_blocks INTEGER NOT NULL DEFAULT 0,
    gas_fee DECIMAL(24, 8) NOT NULL DEFAULT 0,
    commitment_hash VARCHAR(66),
    random_number BYTEA,
    proof BYTEA,
    commitment_tx_hash VARCHAR(66),
    reveal_tx_hash VARCHAR(66),
    callback_tx_hash VARCHAR(66),
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revealed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for random_requests
CREATE INDEX IF NOT EXISTS idx_random_requests_user_id ON random_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_random_requests_status ON random_requests(status);
CREATE INDEX IF NOT EXISTS idx_random_requests_created_at ON random_requests(created_at);

-- Create entropy_sources table
CREATE TABLE IF NOT EXISTS entropy_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    type VARCHAR(32) NOT NULL,
    weight DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Insert default entropy sources
INSERT INTO entropy_sources (name, type, weight, active, created_at, updated_at)
VALUES
    ('tee_hardware', 'hardware', 3.0, TRUE, NOW(), NOW()),
    ('system_entropy', 'system', 2.0, TRUE, NOW(), NOW()),
    ('blockchain', 'blockchain', 2.0, TRUE, NOW(), NOW()),
    ('time_based', 'time', 1.0, TRUE, NOW(), NOW())
ON CONFLICT (name) DO NOTHING; 