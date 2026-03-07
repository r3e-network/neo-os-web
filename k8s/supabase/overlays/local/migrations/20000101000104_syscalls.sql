-- Syscalls table
CREATE TABLE IF NOT EXISTS indexer_syscalls (
    id BIGSERIAL PRIMARY KEY,
    tx_hash VARCHAR(66) NOT NULL REFERENCES indexer_transactions(hash),
    call_index INTEGER NOT NULL,
    syscall_name VARCHAR(100) NOT NULL,
    args_json JSONB,
    result_json JSONB,
    gas_consumed VARCHAR(50),
    contract_hash VARCHAR(66)
);

CREATE INDEX idx_syscall_tx ON indexer_syscalls(tx_hash);
CREATE INDEX idx_syscall_name ON indexer_syscalls(syscall_name);
