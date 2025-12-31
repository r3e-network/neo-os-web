-- Migration: Add tx_type column to indexer_transactions
-- Purpose: Distinguish simple transfers from complex contract invocations
-- to optimize opcode storage (only store opcodes for complex transactions)

-- Add tx_type column with default 'simple' for backward compatibility
ALTER TABLE indexer_transactions
ADD COLUMN IF NOT EXISTS tx_type VARCHAR(20) DEFAULT 'simple';

-- Create index for efficient filtering by transaction type
CREATE INDEX IF NOT EXISTS idx_indexer_transactions_tx_type
ON indexer_transactions(tx_type);

-- Add check constraint to ensure valid values
ALTER TABLE indexer_transactions
ADD CONSTRAINT chk_tx_type CHECK (tx_type IN ('simple', 'complex'));

-- Comment for documentation
COMMENT ON COLUMN indexer_transactions.tx_type IS
'Transaction complexity type: simple (NEP-17 transfers) or complex (contract invocations)';
