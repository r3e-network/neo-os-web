-- Create oracles table
CREATE TABLE IF NOT EXISTS oracles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    type VARCHAR(32) NOT NULL,
    url TEXT NOT NULL,
    method VARCHAR(16) NOT NULL DEFAULT 'GET',
    headers JSONB NOT NULL DEFAULT '{}',
    body TEXT,
    auth_type VARCHAR(32) NOT NULL DEFAULT 'none',
    auth_params JSONB NOT NULL DEFAULT '{}',
    path TEXT,
    transform TEXT,
    schedule VARCHAR(128),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for oracles
CREATE INDEX IF NOT EXISTS idx_oracles_user_id ON oracles(user_id);
CREATE INDEX IF NOT EXISTS idx_oracles_name ON oracles(name);
CREATE INDEX IF NOT EXISTS idx_oracles_type ON oracles(type);
CREATE INDEX IF NOT EXISTS idx_oracles_active ON oracles(active);

-- Create oracle_requests table
CREATE TABLE IF NOT EXISTS oracle_requests (
    id SERIAL PRIMARY KEY,
    oracle_id INTEGER,
    user_id INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL,
    url TEXT NOT NULL,
    method VARCHAR(16) NOT NULL DEFAULT 'GET',
    headers JSONB NOT NULL DEFAULT '{}',
    body TEXT,
    auth_type VARCHAR(32) NOT NULL DEFAULT 'none',
    auth_params JSONB NOT NULL DEFAULT '{}',
    path TEXT,
    transform TEXT,
    callback_address VARCHAR(42),
    callback_method VARCHAR(128),
    gas_fee DECIMAL(24, 8) NOT NULL DEFAULT 0,
    result JSONB,
    raw_result TEXT,
    error TEXT,
    tx_hash VARCHAR(66),
    block_height BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (oracle_id) REFERENCES oracles(id) ON DELETE SET NULL
);

-- Create indexes for oracle_requests
CREATE INDEX IF NOT EXISTS idx_oracle_requests_oracle_id ON oracle_requests(oracle_id);
CREATE INDEX IF NOT EXISTS idx_oracle_requests_user_id ON oracle_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_requests_status ON oracle_requests(status);
CREATE INDEX IF NOT EXISTS idx_oracle_requests_created_at ON oracle_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_oracle_requests_completed_at ON oracle_requests(completed_at);

-- Insert default oracles for common data sources
INSERT INTO oracles (name, description, type, url, method, headers, auth_type, path, active, user_id, created_at, updated_at)
VALUES
    ('crypto_price', 'Cryptocurrency price feed', 'rest', 'https://api.coingecko.com/api/v3/simple/price?ids={{symbol}}&vs_currencies=usd', 'GET', '{}', 'none', '{{symbol}}.usd', TRUE, 1, NOW(), NOW()),
    ('weather_data', 'Weather data feed', 'rest', 'https://api.openweathermap.org/data/2.5/weather?q={{city}}&appid={{api_key}}', 'GET', '{}', 'api_key', 'main.temp', TRUE, 1, NOW(), NOW()),
    ('exchange_rates', 'Currency exchange rates', 'rest', 'https://api.exchangerate-api.com/v4/latest/{{base}}', 'GET', '{}', 'none', 'rates.{{quote}}', TRUE, 1, NOW(), NOW()),
    ('stock_price', 'Stock price data', 'rest', 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={{symbol}}&apikey={{api_key}}', 'GET', '{}', 'api_key', 'Global Quote.05. price', TRUE, 1, NOW(), NOW())
ON CONFLICT (name) DO NOTHING; 