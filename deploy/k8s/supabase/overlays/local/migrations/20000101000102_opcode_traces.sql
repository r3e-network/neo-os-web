-- Opcode traces table
CREATE TABLE IF NOT EXISTS indexer_opcode_traces (
    id BIGSERIAL PRIMARY KEY,
    tx_hash VARCHAR(66) NOT NULL REFERENCES indexer_transactions(hash),
    step_index INTEGER NOT NULL,
    opcode VARCHAR(50) NOT NULL,
    opcode_hex VARCHAR(10) NOT NULL,
    gas_consumed VARCHAR(50),
    stack_size INTEGER,
    contract_hash VARCHAR(66),
    instruction_ptr INTEGER NOT NULL
);

CREATE INDEX idx_opcode_tx ON indexer_opcode_traces(tx_hash);
CREATE INDEX idx_opcode_contract ON indexer_opcode_traces(contract_hash);
