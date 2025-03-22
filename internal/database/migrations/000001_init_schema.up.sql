-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    api_key VARCHAR(64) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_api_key ON users(api_key);

-- Create functions table
CREATE TABLE functions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    source_code TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active',
    timeout INTEGER DEFAULT 30,
    memory INTEGER DEFAULT 128,
    execution_count INTEGER DEFAULT 0,
    last_execution TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE INDEX idx_functions_user_id ON functions(user_id);
CREATE INDEX idx_functions_status ON functions(status);

-- Create secrets table
CREATE TABLE secrets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE INDEX idx_secrets_user_id ON secrets(user_id);

-- Create function_secrets table
CREATE TABLE function_secrets (
    function_id INTEGER NOT NULL REFERENCES functions(id) ON DELETE CASCADE,
    secret_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (function_id, secret_name)
);

CREATE INDEX idx_function_secrets_function_id ON function_secrets(function_id);

-- Create executions table
CREATE TABLE executions (
    id SERIAL PRIMARY KEY,
    function_id INTEGER NOT NULL REFERENCES functions(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER,
    result JSONB,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_executions_function_id ON executions(function_id);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_start_time ON executions(start_time);

-- Create execution_logs table
CREATE TABLE execution_logs (
    id SERIAL PRIMARY KEY,
    execution_id INTEGER NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL
);

CREATE INDEX idx_execution_logs_execution_id ON execution_logs(execution_id);
CREATE INDEX idx_execution_logs_timestamp ON execution_logs(timestamp);

-- Create triggers table
CREATE TABLE triggers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    function_id INTEGER NOT NULL REFERENCES functions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_config JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE INDEX idx_triggers_user_id ON triggers(user_id);
CREATE INDEX idx_triggers_function_id ON triggers(function_id);
CREATE INDEX idx_triggers_trigger_type ON triggers(trigger_type);
CREATE INDEX idx_triggers_status ON triggers(status);

-- Create trigger_events table
CREATE TABLE trigger_events (
    id SERIAL PRIMARY KEY,
    trigger_id INTEGER NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL,
    execution_id INTEGER REFERENCES executions(id)
);

CREATE INDEX idx_trigger_events_trigger_id ON trigger_events(trigger_id);
CREATE INDEX idx_trigger_events_timestamp ON trigger_events(timestamp);

-- Create price_feeds table
CREATE TABLE price_feeds (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_pair VARCHAR(20) NOT NULL,
    frequency INTEGER NOT NULL,
    sources JSONB NOT NULL,
    aggregation VARCHAR(20) DEFAULT 'median',
    deviation DECIMAL(10, 2) DEFAULT 0.5,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_price_feeds_user_id ON price_feeds(user_id);
CREATE INDEX idx_price_feeds_asset_pair ON price_feeds(asset_pair);
CREATE INDEX idx_price_feeds_status ON price_feeds(status);

-- Create price_data table
CREATE TABLE price_data (
    id SERIAL PRIMARY KEY,
    feed_id INTEGER NOT NULL REFERENCES price_feeds(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    price DECIMAL(20, 8) NOT NULL,
    sources_used INTEGER NOT NULL,
    source_data JSONB
);

CREATE INDEX idx_price_data_feed_id ON price_data(feed_id);
CREATE INDEX idx_price_data_timestamp ON price_data(timestamp);

-- Create gas_accounts table
CREATE TABLE gas_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR(42) NOT NULL,
    balance DECIMAL(20, 8) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, address)
);

CREATE INDEX idx_gas_accounts_user_id ON gas_accounts(user_id);
CREATE INDEX idx_gas_accounts_address ON gas_accounts(address);

-- Create transactions table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES gas_accounts(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    tx_hash VARCHAR(66),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- Create random_numbers table
CREATE TABLE random_numbers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    min INTEGER NOT NULL,
    max INTEGER NOT NULL,
    seed BYTEA,
    proof JSONB,
    tx_hash VARCHAR(66),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_random_numbers_user_id ON random_numbers(user_id);
CREATE INDEX idx_random_numbers_status ON random_numbers(status);
CREATE INDEX idx_random_numbers_created_at ON random_numbers(created_at);

-- Create oracle_configs table
CREATE TABLE oracle_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    data_source VARCHAR(255) NOT NULL,
    endpoint TEXT NOT NULL,
    parameters JSONB,
    transform_script TEXT,
    frequency INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE INDEX idx_oracle_configs_user_id ON oracle_configs(user_id);
CREATE INDEX idx_oracle_configs_status ON oracle_configs(status);

-- Create oracle_data table
CREATE TABLE oracle_data (
    id SERIAL PRIMARY KEY,
    oracle_id INTEGER NOT NULL REFERENCES oracle_configs(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    raw_data JSONB,
    transformed_data JSONB,
    tx_hash VARCHAR(66),
    status VARCHAR(20) NOT NULL
);

CREATE INDEX idx_oracle_data_oracle_id ON oracle_data(oracle_id);
CREATE INDEX idx_oracle_data_timestamp ON oracle_data(timestamp);
CREATE INDEX idx_oracle_data_status ON oracle_data(status);