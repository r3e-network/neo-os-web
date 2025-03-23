-- Initialize Service Layer Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    api_key VARCHAR(64) UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Functions table
CREATE TABLE IF NOT EXISTS functions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    source_code TEXT NOT NULL,
    secrets_access TEXT[], -- Names of secrets this function can access
    trigger_type VARCHAR(20), -- 'manual', 'scheduled', 'event'
    trigger_config JSONB, -- Configuration for the trigger
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Function execution logs
CREATE TABLE IF NOT EXISTS function_logs (
    id SERIAL PRIMARY KEY,
    function_id INTEGER NOT NULL REFERENCES functions(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL, -- 'success', 'error', 'timeout'
    execution_time TIMESTAMP NOT NULL DEFAULT NOW(),
    duration_ms INTEGER NOT NULL,
    memory_usage_bytes BIGINT,
    params JSONB,
    result JSONB,
    error_message TEXT
);

-- Secrets management
CREATE TABLE IF NOT EXISTS secrets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    encrypted_value BYTEA NOT NULL,
    data_key_id VARCHAR(64) NOT NULL, -- References the data key used for envelope encryption
    description TEXT,
    metadata JSONB,
    expiration TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Data keys for envelope encryption
CREATE TABLE IF NOT EXISTS data_keys (
    id VARCHAR(64) PRIMARY KEY,
    encrypted_key BYTEA NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Secret access audit log
CREATE TABLE IF NOT EXISTS secret_access_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    secret_id INTEGER NOT NULL REFERENCES secrets(id),
    action VARCHAR(20) NOT NULL, -- 'create', 'read', 'update', 'delete', 'rotate'
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    source_ip VARCHAR(45),
    user_agent TEXT
);

-- Gas Bank transactions
CREATE TABLE IF NOT EXISTS gas_bank_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    transaction_hash VARCHAR(64),
    amount NUMERIC(20, 8) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'pending', 'confirmed', 'failed'
    transaction_type VARCHAR(20) NOT NULL, -- 'deposit', 'withdrawal', 'fee'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Oracle data sources
CREATE TABLE IF NOT EXISTS oracle_data_sources (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    auth_type VARCHAR(20), -- 'none', 'apikey', 'basic', 'jwt', 'oauth'
    auth_params JSONB,
    headers JSONB,
    response_path TEXT,
    transform_function TEXT, -- JavaScript function to transform the response
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Price Feed data
CREATE TABLE IF NOT EXISTS price_feeds (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    symbol VARCHAR(20) NOT NULL,
    price NUMERIC(20, 8) NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    sources JSONB, -- List of sources with their individual prices
    contract_address VARCHAR(42), -- Neo N3 contract address
    last_update_tx VARCHAR(64) -- Transaction hash of the last update
);

-- Automation rules
CREATE TABLE IF NOT EXISTS automation_rules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(20) NOT NULL, -- 'time', 'blockchain_event', 'price', 'webhook'
    trigger_config JSONB NOT NULL,
    action_type VARCHAR(20) NOT NULL, -- 'function', 'transaction', 'notification'
    action_config JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Automation execution logs
CREATE TABLE IF NOT EXISTS automation_logs (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER NOT NULL REFERENCES automation_rules(id),
    execution_time TIMESTAMP NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL, -- 'success', 'error'
    trigger_details JSONB,
    action_result JSONB,
    error_message TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_functions_user_id ON functions(user_id);
CREATE INDEX IF NOT EXISTS idx_function_logs_function_id ON function_logs(function_id);
CREATE INDEX IF NOT EXISTS idx_function_logs_user_id ON function_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_secrets_user_id ON secrets(user_id);
CREATE INDEX IF NOT EXISTS idx_gas_bank_transactions_user_id ON gas_bank_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_data_sources_user_id ON oracle_data_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_price_feeds_symbol ON price_feeds(symbol);
CREATE INDEX IF NOT EXISTS idx_price_feeds_user_id ON price_feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_user_id ON automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule_id ON automation_logs(rule_id);

-- Create timestamp indexes for time-series data
CREATE INDEX IF NOT EXISTS idx_function_logs_execution_time ON function_logs(execution_time);
CREATE INDEX IF NOT EXISTS idx_price_feeds_timestamp ON price_feeds(timestamp);
CREATE INDEX IF NOT EXISTS idx_automation_logs_execution_time ON automation_logs(execution_time);

-- Add cascading delete for certain tables
ALTER TABLE function_logs
    DROP CONSTRAINT IF EXISTS function_logs_function_id_fkey,
    ADD CONSTRAINT function_logs_function_id_fkey
    FOREIGN KEY (function_id) REFERENCES functions(id) ON DELETE CASCADE;

ALTER TABLE secret_access_logs
    DROP CONSTRAINT IF EXISTS secret_access_logs_secret_id_fkey,
    ADD CONSTRAINT secret_access_logs_secret_id_fkey
    FOREIGN KEY (secret_id) REFERENCES secrets(id) ON DELETE CASCADE;

ALTER TABLE automation_logs
    DROP CONSTRAINT IF EXISTS automation_logs_rule_id_fkey,
    ADD CONSTRAINT automation_logs_rule_id_fkey
    FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE;