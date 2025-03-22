-- Create event subscriptions table
CREATE TABLE IF NOT EXISTS event_subscriptions (
    id UUID PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    contract_address VARCHAR(255),
    event_name VARCHAR(255),
    parameters JSONB,
    start_block INTEGER,
    end_block INTEGER,
    callback_url VARCHAR(255),
    notification_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    last_triggered_at TIMESTAMP,
    trigger_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for event subscriptions table
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_user_id ON event_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_contract_address ON event_subscriptions(contract_address);
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_event_name ON event_subscriptions(event_name);
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_status ON event_subscriptions(status);

-- Create blockchain events table
CREATE TABLE IF NOT EXISTS blockchain_events (
    id UUID PRIMARY KEY,
    contract_address VARCHAR(255) NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    parameters JSONB,
    transaction_hash VARCHAR(255) NOT NULL,
    block_number INTEGER NOT NULL,
    block_hash VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL
);

-- Create indexes for blockchain events table
CREATE INDEX IF NOT EXISTS idx_blockchain_events_contract_address ON blockchain_events(contract_address);
CREATE INDEX IF NOT EXISTS idx_blockchain_events_event_name ON blockchain_events(event_name);
CREATE INDEX IF NOT EXISTS idx_blockchain_events_transaction_hash ON blockchain_events(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_blockchain_events_block_number ON blockchain_events(block_number);
CREATE INDEX IF NOT EXISTS idx_blockchain_events_timestamp ON blockchain_events(timestamp);

-- Create event notifications table
CREATE TABLE IF NOT EXISTS event_notifications (
    id UUID PRIMARY KEY,
    subscription_id UUID NOT NULL,
    event_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL,
    delivery_attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP,
    delivered_at TIMESTAMP,
    response TEXT,
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (subscription_id) REFERENCES event_subscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES blockchain_events(id) ON DELETE CASCADE
);

-- Create indexes for event notifications table
CREATE INDEX IF NOT EXISTS idx_event_notifications_subscription_id ON event_notifications(subscription_id);
CREATE INDEX IF NOT EXISTS idx_event_notifications_event_id ON event_notifications(event_id);
CREATE INDEX IF NOT EXISTS idx_event_notifications_status ON event_notifications(status);

-- Create block processing tracker table
CREATE TABLE IF NOT EXISTS block_processing (
    id SERIAL PRIMARY KEY,
    network VARCHAR(50) NOT NULL UNIQUE,
    last_processed_block INTEGER NOT NULL,
    is_processing BOOLEAN DEFAULT FALSE,
    last_processed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Insert default network
INSERT INTO block_processing (network, last_processed_block, last_processed_at, created_at, updated_at)
VALUES ('mainnet', 0, NOW(), NOW(), NOW()),
       ('testnet', 0, NOW(), NOW(), NOW())
ON CONFLICT DO NOTHING; 