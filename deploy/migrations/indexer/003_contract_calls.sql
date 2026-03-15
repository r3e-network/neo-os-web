-- Contract calls table
CREATE TABLE IF NOT EXISTS indexer_contract_calls (
    id BIGSERIAL PRIMARY KEY,
    tx_hash VARCHAR(66) NOT NULL REFERENCES indexer_transactions(hash),
    call_index INTEGER NOT NULL,
    contract_hash VARCHAR(66) NOT NULL,
    method VARCHAR(100) NOT NULL,
    args_json JSONB,
    gas_consumed VARCHAR(50),
    success BOOLEAN NOT NULL DEFAULT true,
    parent_call_id BIGINT REFERENCES indexer_contract_calls(id)
);

CREATE INDEX idx_call_tx ON indexer_contract_calls(tx_hash);
CREATE INDEX idx_call_contract ON indexer_contract_calls(contract_hash);
CREATE INDEX idx_call_method ON indexer_contract_calls(method);
