# Neo N3 Service Layer Database Schema

## Overview

The Neo N3 Service Layer uses PostgreSQL as its primary database. This document outlines the database schema design, including tables, relationships, and indexes.

## Schema Diagram

```
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│    users      │       │   functions   │       │  executions   │
├───────────────┤       ├───────────────┤       ├───────────────┤
│ id            │       │ id            │       │ id            │
│ username      │       │ user_id       │───┐   │ function_id   │───┐
│ email         │       │ name          │   │   │ status        │   │
│ password_hash │       │ description   │   │   │ start_time    │   │
│ created_at    │       │ source_code   │   │   │ end_time      │   │
│ updated_at    │       │ version       │   │   │ duration      │   │
└───────┬───────┘       │ status        │   │   │ result        │   │
        │               │ timeout       │   │   │ error         │   │
        │               │ memory        │   │   └───────────────┘   │
        │               │ created_at    │   │                       │
        │               │ updated_at    │   │                       │
        │               └───────────────┘   │                       │
        │                                   │                       │
        │               ┌───────────────┐   │                       │
        └───────────────│   secrets     │   │                       │
        │               ├───────────────┤   │                       │
        │               │ id            │   │                       │
        └───────────────│ user_id       │   │                       │
                        │ name          │   │                       │
                        │ value         │   │                       │
                        │ version       │   │                       │
                        │ created_at    │   │                       │
                        │ updated_at    │   │                       │
                        └───────────────┘   │                       │
                                            │                       │
                        ┌───────────────┐   │                       │
                        │function_secrets│  │                       │
                        ├───────────────┤   │                       │
                        │ function_id   │───┘                       │
                        │ secret_name   │                           │
                        └───────────────┘                           │
                                                                    │
                        ┌───────────────┐                           │
                        │ execution_logs│                           │
                        ├───────────────┤                           │
                        │ id            │                           │
                        │ execution_id  │───────────────────────────┘
                        │ timestamp     │
                        │ level         │
                        │ message       │
                        └───────────────┘

┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│   triggers    │       │  price_feeds  │       │ gas_accounts  │
├───────────────┤       ├───────────────┤       ├───────────────┤
│ id            │       │ id            │       │ id            │
│ user_id       │       │ user_id       │       │ user_id       │
│ function_id   │       │ asset_pair    │       │ address       │
│ name          │       │ frequency     │       │ balance       │
│ description   │       │ sources       │       │ created_at    │
│ trigger_type  │       │ aggregation   │       │ updated_at    │
│ trigger_config│       │ deviation     │       └───────────────┘
│ status        │       │ status        │
│ created_at    │       │ created_at    │       ┌───────────────┐
│ updated_at    │       │ updated_at    │       │ transactions  │
└───────────────┘       └───────────────┘       ├───────────────┤
                                                │ id            │
┌───────────────┐       ┌───────────────┐       │ user_id       │
│ trigger_events│       │  price_data   │       │ account_id    │
├───────────────┤       ├───────────────┤       │ type          │
│ id            │       │ id            │       │ amount        │
│ trigger_id    │       │ feed_id       │       │ tx_hash       │
│ timestamp     │       │ timestamp     │       │ status        │
│ status        │       │ price         │       │ created_at    │
│ execution_id  │       │ sources_used  │       └───────────────┘
└───────────────┘       └───────────────┘
```

## Table Definitions

### users

Stores user account information.

```sql
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
```

### functions

Stores JavaScript functions created by users.

```sql
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
```

### secrets

Stores encrypted secrets that can be used by functions.

```sql
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
```

### function_secrets

Maps functions to the secrets they use.

```sql
CREATE TABLE function_secrets (
    function_id INTEGER NOT NULL REFERENCES functions(id) ON DELETE CASCADE,
    secret_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (function_id, secret_name)
);

CREATE INDEX idx_function_secrets_function_id ON function_secrets(function_id);
```

### executions

Records function execution instances.

```sql
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
```

### execution_logs

Stores logs generated during function execution.

```sql
CREATE TABLE execution_logs (
    id SERIAL PRIMARY KEY,
    execution_id INTEGER NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL
);

CREATE INDEX idx_execution_logs_execution_id ON execution_logs(execution_id);
CREATE INDEX idx_execution_logs_timestamp ON execution_logs(timestamp);
```

### triggers

Defines triggers that cause functions to execute automatically.

```sql
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
```

### trigger_events

Records instances when triggers are fired.

```sql
CREATE TABLE trigger_events (
    id SERIAL PRIMARY KEY,
    trigger_id INTEGER NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL,
    execution_id INTEGER REFERENCES executions(id)
);

CREATE INDEX idx_trigger_events_trigger_id ON trigger_events(trigger_id);
CREATE INDEX idx_trigger_events_timestamp ON trigger_events(timestamp);
```

### price_feeds

Configures price feed services.

```sql
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
```

### price_data

Stores historical price data.

```sql
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
```

### gas_accounts

Manages gas for users' on-chain transactions.

```sql
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
```

### transactions

Records gas transactions.

```sql
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
```

## Data Types

### Trigger Types
- `cron`: Time-based triggers using cron syntax
- `price`: Price threshold triggers
- `blockchain`: Neo N3 blockchain event triggers
- `webhook`: External webhook triggers

### Trigger Config Example (JSON)

Cron Trigger:
```json
{
  "schedule": "0 */6 * * *",
  "timezone": "UTC"
}
```

Price Trigger:
```json
{
  "asset_pair": "NEO/USD",
  "condition": "above",
  "threshold": 50.0,
  "duration": 300
}
```

Blockchain Trigger:
```json
{
  "contract_hash": "0x1234567890abcdef",
  "event_name": "Transfer"
}
```

### Transaction Types
- `deposit`: Gas deposit
- `withdraw`: Gas withdrawal
- `function`: Gas used by function execution
- `pricefeed`: Gas used by price feed updates

## Indexes and Performance Considerations

- Each table has appropriate indexes on foreign keys and frequently queried columns
- JSONB data types are used for flexible configurations
- Timestamp columns have indexes to support efficient time-range queries
- User-specific data is partitioned by user_id for better scalability