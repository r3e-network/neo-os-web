-- Create price_feeds table
CREATE TABLE IF NOT EXISTS price_feeds (
    id SERIAL PRIMARY KEY,
    base_token VARCHAR(32) NOT NULL,
    quote_token VARCHAR(32) NOT NULL,
    pair VARCHAR(64) NOT NULL UNIQUE,
    update_interval VARCHAR(32) NOT NULL,
    deviation_threshold DECIMAL(10, 5) NOT NULL,
    heartbeat_interval VARCHAR(32) NOT NULL,
    contract_address VARCHAR(42),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create index on pair
CREATE INDEX IF NOT EXISTS idx_price_feeds_pair ON price_feeds(pair);

-- Create price_sources table
CREATE TABLE IF NOT EXISTS price_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(32) NOT NULL UNIQUE,
    url VARCHAR(255) NOT NULL,
    weight DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
    timeout VARCHAR(16) NOT NULL DEFAULT '5s',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create index on name
CREATE INDEX IF NOT EXISTS idx_price_sources_name ON price_sources(name);

-- Create price_data table
CREATE TABLE IF NOT EXISTS price_data (
    id SERIAL PRIMARY KEY,
    price_feed_id INTEGER NOT NULL,
    price DECIMAL(24, 8) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    round_id BIGINT NOT NULL,
    tx_hash VARCHAR(66),
    source VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    FOREIGN KEY (price_feed_id) REFERENCES price_feeds(id) ON DELETE CASCADE
);

-- Create indexes on price_data
CREATE INDEX IF NOT EXISTS idx_price_data_price_feed_id ON price_data(price_feed_id);
CREATE INDEX IF NOT EXISTS idx_price_data_timestamp ON price_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_price_data_round_id ON price_data(round_id);

-- Insert default price sources
INSERT INTO price_sources (name, url, weight, timeout, active, created_at, updated_at)
VALUES
    ('binance', 'https://api.binance.com', 1.0, '5s', TRUE, NOW(), NOW()),
    ('coingecko', 'https://api.coingecko.com', 1.0, '5s', TRUE, NOW(), NOW()),
    ('coinmarketcap', 'https://pro-api.coinmarketcap.com', 1.0, '5s', TRUE, NOW(), NOW()),
    ('huobi', 'https://api.huobi.pro', 1.0, '5s', TRUE, NOW(), NOW()),
    ('okx', 'https://www.okx.com', 1.0, '5s', TRUE, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Insert default price feeds
INSERT INTO price_feeds (base_token, quote_token, pair, update_interval, deviation_threshold, heartbeat_interval, active, created_at, updated_at)
VALUES
    ('NEO', 'USD', 'NEO/USD', '1h', 0.5, '24h', TRUE, NOW(), NOW()),
    ('GAS', 'USD', 'GAS/USD', '1h', 0.5, '24h', TRUE, NOW(), NOW()),
    ('BTC', 'USD', 'BTC/USD', '1h', 0.5, '24h', TRUE, NOW(), NOW()),
    ('ETH', 'USD', 'ETH/USD', '1h', 0.5, '24h', TRUE, NOW(), NOW()),
    ('FLM', 'USD', 'FLM/USD', '1h', 0.5, '24h', TRUE, NOW(), NOW())
ON CONFLICT (pair) DO NOTHING; 