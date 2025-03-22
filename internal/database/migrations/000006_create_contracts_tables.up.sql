-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    encrypted_key BYTEA NOT NULL,
    path VARCHAR(255) NOT NULL,
    iv BYTEA NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index on user_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- Create contracts table
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source TEXT,
    bytecode BYTEA,
    manifest BYTEA,
    address VARCHAR(255),
    network VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    user_id INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    tx_hash VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for contracts table
CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_address_network ON contracts(address, network);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- Create contract_verifications table
CREATE TABLE IF NOT EXISTS contract_verifications (
    id UUID PRIMARY KEY,
    contract_id UUID NOT NULL,
    verified BOOLEAN NOT NULL,
    message TEXT,
    details JSONB,
    created_at TIMESTAMP NOT NULL,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index on contract_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_contract_verifications_contract_id ON contract_verifications(contract_id); 